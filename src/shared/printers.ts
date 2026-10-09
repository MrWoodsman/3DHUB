export type PrinterFamily = 'enclosed' | 'open' | 'bedslinger'

export interface PrinterModel {
  id: string
  label: string
  family: PrinterFamily // decides which icon is drawn
}

export const PRINTER_MODELS: PrinterModel[] = [
  { id: 'x1c', label: 'X1 Carbon', family: 'enclosed' },
  { id: 'x1e', label: 'X1E', family: 'enclosed' },
  { id: 'p1s', label: 'P1S', family: 'enclosed' },
  { id: 'p1p', label: 'P1P', family: 'open' },
  { id: 'a1', label: 'A1', family: 'bedslinger' },
  { id: 'a1mini', label: 'A1 mini', family: 'bedslinger' },
  { id: 'h2d', label: 'H2D', family: 'enclosed' }
]

/** Finds a model from a slicer string such as "Bambu Lab P1S" or "Bambu Lab A1 mini 0.4 nozzle". */
export function modelFromName(name: string | null | undefined): PrinterModel | null {
  if (!name) return null
  const n = name.toLowerCase().replace(/\s+/g, '')
  const sorted = [...PRINTER_MODELS].sort((a, b) => b.label.length - a.label.length) // "A1 mini" before "A1"
  return sorted.find((m) => n.includes(m.label.toLowerCase().replace(/\s+/g, '').replace('carbon', ''))) ?? null
}

export interface PrinterInfo {
  id: string
  name: string
  model: string // PrinterModel.id
  ip: string
  serial: string
}

export interface PrinterInput {
  name: string
  model: string
  ip: string
  serial: string
  accessCode: string
}

export type PrinterConn = 'connecting' | 'online' | 'offline' | 'error'

export interface AmsTray {
  id: number
  type?: string // PLA, PETG...
  color?: string // "#RRGGBB"
  remain?: number // 0-100, undefined when unknown
}

export interface AmsUnit {
  id: number
  humidity?: number // 1 (wet) .. 5 (dry)
  trays: AmsTray[]
}

export interface PrinterFans {
  part?: number // % - part cooling
  aux?: number
  chamber?: number
  heatbreak?: number
}

export type PrinterCommand =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'light'; on: boolean }
  | { type: 'speed'; level: 1 | 2 | 3 | 4 } // silent, standard, sport, ludicrous

/** Models whose camera is a JPEG stream on port 6000 (X1 / H2D use RTSP, not supported yet). */
export const jpegCameraModels = ['p1s', 'p1p', 'a1', 'a1mini']

export interface PrinterStatus {
  conn: PrinterConn
  error?: string
  speedLevel?: number
  light?: boolean
  fans?: PrinterFans
  ams?: AmsUnit[]
  activeTray?: number // global tray index, undefined when none
  hmsCount?: number
  nozzleDiameter?: string
  state?: string // gcode_state: IDLE, RUNNING, PAUSE, FINISH, FAILED, PREPARE
  percent?: number
  remainingMin?: number
  layer?: number
  totalLayers?: number
  nozzle?: number
  nozzleTarget?: number
  bed?: number
  bedTarget?: number
  chamber?: number
  file?: string
  wifi?: string
  updated: number
}
