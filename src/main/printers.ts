import { app, ipcMain, Notification, safeStorage, type BrowserWindow } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import tls from 'tls'
import mqtt, { type MqttClient } from 'mqtt'
import { jpegCameraModels } from '../shared/printers'
import type { AmsUnit, PrinterCommand, PrinterInfo, PrinterInput, PrinterStatus } from '../shared/printers'

// Bambu Lab LAN protocol: MQTT over TLS, port 8883, user "bblp", password = access code.
// Reports arrive on device/<serial>/report, requests go to device/<serial>/request.

interface Stored extends PrinterInfo {
  code: string // access code, encrypted with safeStorage when available
  encrypted: boolean
}

const file = () => join(app.getPath('userData'), 'printers.json')
const clients = new Map<string, { client: MqttClient; poll: ReturnType<typeof setInterval>; serial: string }>()
const cameras = new Map<string, tls.TLSSocket>()
let sequence = 0
const statuses = new Map<string, PrinterStatus>()
const emitTimers = new Map<string, ReturnType<typeof setTimeout>>()
let getWindow: () => BrowserWindow | null = () => null

async function load(): Promise<Stored[]> {
  try {
    return JSON.parse(await fs.readFile(file(), 'utf8'))
  } catch {
    return []
  }
}
const save = (list: Stored[]) => fs.writeFile(file(), JSON.stringify(list, null, 2))

const encrypt = (code: string): Pick<Stored, 'code' | 'encrypted'> =>
  safeStorage.isEncryptionAvailable()
    ? { code: safeStorage.encryptString(code).toString('base64'), encrypted: true }
    : { code, encrypted: false }
const decrypt = (s: Stored): string => (s.encrypted ? safeStorage.decryptString(Buffer.from(s.code, 'base64')) : s.code)
const toInfo = ({ id, name, model, ip, serial }: Stored): PrinterInfo => ({ id, name, model, ip, serial })

function setStatus(id: string, patch: Partial<PrinterStatus>): void {
  statuses.set(id, { ...(statuses.get(id) ?? { conn: 'connecting' }), ...patch, updated: Date.now() })
  if (emitTimers.has(id)) return // throttle: at most ~2 updates per second per printer
  emitTimers.set(id, setTimeout(() => {
    emitTimers.delete(id)
    getWindow()?.webContents.send('printers:status', { id, status: statuses.get(id) })
  }, 500))
}

function friendlyError(err: Error & { code?: string | number }): string {
  const m = `${err.code ?? ''} ${err.message}`
  if (/not authorized|bad user name|password/i.test(m)) return 'Zły kod dostępu'
  if (/ECONNREFUSED/.test(m)) return 'Drukarka odrzuciła połączenie. Sprawdź adres IP i czy tryb LAN jest włączony'
  if (/ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/.test(m)) return 'Brak odpowiedzi. Sprawdź adres IP i czy komputer jest w tej samej sieci'
  if (/ENOTFOUND/.test(m)) return 'Nieprawidłowy adres drukarki'
  return err.message || 'Błąd połączenia'
}

type Report = Record<string, unknown>
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

const ACTIVE = ['RUNNING', 'PREPARE', 'PAUSE']

function notifyStateChange(name: string, before: string | undefined, after: string | undefined): void {
  if (!before || !after || before === after || !ACTIVE.includes(before)) return
  if (after === 'FINISH') new Notification({ title: 'Druk zakończony', body: name }).show()
  else if (after === 'FAILED') new Notification({ title: 'Druk nieudany', body: name }).show()
}

/** Bambu reports fan speed as a 0-15 gear, sometimes as a string. */
const fanPercent = (v: unknown): number | undefined => {
  const n = Number(v)
  return v === undefined || v === '' || !Number.isFinite(n) ? undefined : Math.round((n / 15) * 100)
}

function parseAms(raw: unknown): AmsUnit[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.map((u: Report) => ({
    id: Number(u.id),
    humidity: Number(u.humidity) || undefined,
    trays: (Array.isArray(u.tray) ? u.tray : []).map((t: Report) => ({
      id: Number(t.id),
      type: str(t.tray_type),
      color: str(t.tray_color) ? '#' + String(t.tray_color).slice(0, 6) : undefined,
      remain: num(t.remain) !== undefined && (t.remain as number) >= 0 ? (t.remain as number) : undefined
    }))
  }))
}

function applyReport(id: string, name: string, p: Report): void {
  const prev = statuses.get(id)
  const patch: Partial<PrinterStatus> = { conn: 'online', error: undefined }
  const set = <K extends keyof PrinterStatus>(k: K, v: PrinterStatus[K] | undefined) => { if (v !== undefined) patch[k] = v }

  set('speedLevel', num(p.spd_lvl))
  set('nozzleDiameter', str(p.nozzle_diameter))
  if (Array.isArray(p.hms)) patch.hmsCount = p.hms.length
  const chamberLight = (p.lights_report as { node: string; mode: string }[] | undefined)?.find((l) => l.node === 'chamber_light')
  if (chamberLight) patch.light = chamberLight.mode === 'on'
  const fans = {
    part: fanPercent(p.cooling_fan_speed) ?? prev?.fans?.part,
    aux: fanPercent(p.big_fan1_speed) ?? prev?.fans?.aux,
    chamber: fanPercent(p.big_fan2_speed) ?? prev?.fans?.chamber,
    heatbreak: fanPercent(p.heatbreak_fan_speed) ?? prev?.fans?.heatbreak
  }
  if (Object.values(fans).some((v) => v !== undefined)) patch.fans = fans
  const ams = p.ams as { ams?: unknown; tray_now?: string } | undefined
  set('ams', parseAms(ams?.ams))
  if (ams?.tray_now !== undefined) {
    const n = Number(ams.tray_now)
    patch.activeTray = n >= 0 && n < 254 ? n : undefined
  }
  notifyStateChange(name, prev?.state, str(p.gcode_state))
  set('state', str(p.gcode_state))
  set('percent', num(p.mc_percent))
  set('remainingMin', num(p.mc_remaining_time))
  set('layer', num(p.layer_num))
  set('totalLayers', num(p.total_layer_num))
  set('nozzle', num(p.nozzle_temper))
  set('nozzleTarget', num(p.nozzle_target_temper))
  set('bed', num(p.bed_temper))
  set('bedTarget', num(p.bed_target_temper))
  set('chamber', num(p.chamber_temper))
  set('file', str(p.subtask_name) ?? str(p.gcode_file))
  set('wifi', str(p.wifi_signal))
  setStatus(id, patch)
}

function connect(p: Stored): void {
  disconnect(p.id)
  setStatus(p.id, { conn: 'connecting', error: undefined })

  const client = mqtt.connect({
    protocol: 'mqtts',
    host: p.ip,
    port: 8883,
    username: 'bblp',
    password: decrypt(p),
    rejectUnauthorized: false, // printers use a self-signed certificate
    clientId: `3dhub_${randomUUID().slice(0, 8)}`,
    keepalive: 30,
    connectTimeout: 10_000,
    reconnectPeriod: 5_000
  })

  const request = () =>
    client.publish(`device/${p.serial}/request`, JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } }))

  client.on('connect', () => {
    client.subscribe(`device/${p.serial}/report`, (err) => {
      if (err) return setStatus(p.id, { conn: 'error', error: friendlyError(err) })
      setStatus(p.id, { conn: 'online', error: undefined })
      request()
    })
  })
  client.on('message', (_topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString())
      if (msg.print) applyReport(p.id, p.name, msg.print)
    } catch { /* ignore malformed packets */ }
  })
  client.on('error', (err) => setStatus(p.id, { conn: 'error', error: friendlyError(err) }))
  client.on('close', () => {
    if (statuses.get(p.id)?.conn !== 'error') setStatus(p.id, { conn: 'offline' })
  })

  // some models (P1/A1) only send a full report on request
  clients.set(p.id, { client, serial: p.serial, poll: setInterval(() => client.connected && request(), 30_000) })
}

function sendCommand(id: string, cmd: PrinterCommand): void {
  const c = clients.get(id)
  if (!c?.client.connected) throw new Error('Drukarka nie jest połączona')
  const sequence_id = String(++sequence)
  let payload: object
  switch (cmd.type) {
    case 'pause':
    case 'resume':
    case 'stop':
      payload = { print: { sequence_id, command: cmd.type, param: '' } }
      break
    case 'light':
      payload = { system: { sequence_id, command: 'ledctrl', led_node: 'chamber_light', led_mode: cmd.on ? 'on' : 'off', led_on_time: 500, led_off_time: 500, loop_times: 0, interval_time: 0 } }
      setStatus(id, { light: cmd.on }) // optimistic, the next report confirms it
      break
    case 'speed':
      payload = { print: { sequence_id, command: 'print_speed', param: String(cmd.level) } }
      setStatus(id, { speedLevel: cmd.level })
      break
  }
  c.client.publish(`device/${c.serial}/request`, JSON.stringify(payload))
  setTimeout(() => c.client.connected && c.client.publish(`device/${c.serial}/request`, JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } })), 1500)
}

// Camera of P1/A1 printers: TLS socket on port 6000, 80-byte auth packet, then JPEG frames with a 16-byte header.
async function startCamera(id: string): Promise<void> {
  stopCamera(id)
  const p = (await load()).find((x) => x.id === id)
  if (!p) return
  if (!jpegCameraModels.includes(p.model)) throw new Error('Kamera tego modelu (RTSP) nie jest jeszcze obsługiwana')

  const send = (channel: string, data: object) => getWindow()?.webContents.send(channel, { id, ...data })
  const auth = Buffer.alloc(80)
  auth.writeUInt32LE(0x40, 0)
  auth.writeUInt32LE(0x3000, 4)
  auth.write('bblp', 16, 'ascii')
  auth.write(decrypt(p), 48, 'ascii')

  const sock = tls.connect({ host: p.ip, port: 6000, rejectUnauthorized: false })
  cameras.set(id, sock)
  sock.on('secureConnect', () => sock.write(auth))

  let buf = Buffer.alloc(0)
  let need = 0
  sock.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk])
    for (;;) {
      if (need === 0) {
        if (buf.length < 16) return
        need = buf.readUInt32LE(0)
        buf = buf.subarray(16)
        if (need === 0 || need > 8_000_000) return void sock.destroy()
      }
      if (buf.length < need) return
      const jpeg = buf.subarray(0, need)
      buf = buf.subarray(need)
      need = 0
      if (jpeg[0] === 0xff && jpeg[1] === 0xd8) send('printers:frame', { frame: 'data:image/jpeg;base64,' + jpeg.toString('base64') })
    }
  })
  sock.on('error', (e) => send('printers:camera-error', { error: friendlyError(e) }))
  sock.on('close', () => { if (cameras.get(id) === sock) cameras.delete(id) })
  sock.setTimeout(15_000, () => {
    send('printers:camera-error', { error: 'Brak obrazu z kamery. Włącz kamerę w ustawieniach drukarki (tryb LAN)' })
    sock.destroy()
  })
}

function stopCamera(id: string): void {
  cameras.get(id)?.destroy()
  cameras.delete(id)
}

function disconnect(id: string): void {
  stopCamera(id)
  const c = clients.get(id)
  if (!c) return
  clearInterval(c.poll)
  c.client.end(true)
  clients.delete(id)
}

export function registerPrinters(window: () => BrowserWindow | null): void {
  getWindow = window

  ipcMain.handle('printers:list', async () => (await load()).map(toInfo))
  ipcMain.handle('printers:statuses', () => Object.fromEntries(statuses))
  ipcMain.handle('printers:add', async (_e, input: PrinterInput) => {
    const ip = input.ip.trim()
    const serial = input.serial.trim().toUpperCase()
    if (!ip || !serial || !input.accessCode.trim()) throw new Error('Uzupełnij adres IP, numer seryjny i kod dostępu')
    const stored: Stored = {
      id: randomUUID(),
      name: input.name.trim() || 'Drukarka Bambu',
      model: input.model,
      ip,
      serial,
      ...encrypt(input.accessCode.trim())
    }
    await save([...(await load()), stored])
    connect(stored)
    return toInfo(stored)
  })
  ipcMain.handle('printers:command', (_e, id: string, cmd: PrinterCommand) => sendCommand(id, cmd))
  ipcMain.handle('printers:camera-start', (_e, id: string) => startCamera(id))
  ipcMain.handle('printers:camera-stop', (_e, id: string) => stopCamera(id))
  ipcMain.handle('printers:remove', async (_e, id: string) => {
    disconnect(id)
    statuses.delete(id)
    await save((await load()).filter((p) => p.id !== id))
  })

  app.whenReady().then(async () => (await load()).forEach(connect))
  app.on('before-quit', () => [...clients.keys()].forEach(disconnect))
}
