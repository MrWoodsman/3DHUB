import { promises as fs } from 'fs'
import { nativeImage } from 'electron'
import { unzipSync } from 'fflate'
import type { ModelSummary, ThreeMFInfo, ThreeMFPlate } from '../shared/types'

const decodeXml = (s: string): string =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const meta = (xml: string, key: string): string | undefined => {
  const m = xml.match(new RegExp(`<metadata key="${key}" value="([^"]*)"`))
  return m ? decodeXml(m[1]) : undefined
}

const blocks = (xml: string, tag: string): string[] =>
  [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1])

const png = (data: Uint8Array | undefined): string | null =>
  data ? 'data:image/png;base64,' + Buffer.from(data).toString('base64') : null

/** True when all four corners are opaque and nearly white (e.g. Fusion exports a flat white background). */
function hasWhiteBackground(png: Buffer): boolean {
  const img = nativeImage.createFromBuffer(png)
  const { width, height } = img.getSize()
  if (!width || !height) return false
  const bgra = img.toBitmap()
  return [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].every(([x, y]) => {
    const i = (y * width + x) * 4
    return bgra[i + 3] > 250 && bgra[i] > 235 && bgra[i + 1] > 235 && bgra[i + 2] > 235
  })
}

/**
 * The image Bambu Studio / MakerWorld saved inside the file: plate 1, else the project thumbnail.
 * Thumbnails with a flat white background (they clash with the dark UI) are rejected, so the caller renders its own.
 */
export async function extractEmbeddedThumbnail(path: string): Promise<Buffer | null> {
  try {
    const files = unzipSync(new Uint8Array(await fs.readFile(path)), {
      filter: (f) => f.name === 'Metadata/plate_1.png' || f.name === 'Metadata/thumbnail.png'
    })
    if (files['Metadata/plate_1.png']) return Buffer.from(files['Metadata/plate_1.png'])
    const thumb = files['Metadata/thumbnail.png'] ? Buffer.from(files['Metadata/thumbnail.png']) : null
    return thumb && !hasWhiteBackground(thumb) ? thumb : null
  } catch {
    return null
  }
}

/** Plates, print time and weight without decoding any images. Null when the file is unreadable. */
export async function readThreeMFSummary(path: string): Promise<ModelSummary | null> {
  try {
    const files = unzipSync(new Uint8Array(await fs.readFile(path)), {
      filter: (f) => /^Metadata\/(project_settings|model_settings|slice_info)\.config$/.test(f.name)
    })
    const text = (name: string): string => (files[name] ? Buffer.from(files[name]).toString('utf8') : '')
    let printer: string | null = null
    try { printer = JSON.parse(text('Metadata/project_settings.config')).printer_model ?? null } catch { /* not Bambu */ }

    const plates = blocks(text('Metadata/model_settings.config'), 'plate').length
    let time = 0
    let weight = 0
    for (const b of blocks(text('Metadata/slice_info.config'), 'plate')) {
      time += Number(meta(b, 'prediction')) || 0
      weight += Number(meta(b, 'weight')) || 0
    }
    return { plates, printer, ...(time ? { printTimeSec: time } : {}), ...(weight ? { weightG: weight } : {}) }
  } catch {
    return null
  }
}

const cache = new Map<string, ThreeMFInfo | null>()

/** Reads plates, printer and slice data from a Bambu Studio / Orca .3mf. Returns null if it is not readable. */
export async function readThreeMFInfo(path: string): Promise<ThreeMFInfo | null> {
  const stat = await fs.stat(path)
  const key = `${path}|${stat.mtimeMs}|${stat.size}`
  if (cache.has(key)) return cache.get(key)!

  let info: ThreeMFInfo | null = null
  try {
    const wanted = /^Metadata\/(project_settings\.config|model_settings\.config|slice_info\.config|thumbnail\.png|plate_\d+\.png)$/
    const files = unzipSync(new Uint8Array(await fs.readFile(path)), { filter: (f) => wanted.test(f.name) })
    const text = (name: string): string => (files[name] ? Buffer.from(files[name]).toString('utf8') : '')

    let printer: string | null = null
    try {
      printer = JSON.parse(text('Metadata/project_settings.config')).printer_model ?? null
    } catch { /* not a Bambu project */ }

    const modelSettings = text('Metadata/model_settings.config')
    const names = new Map<string, string>()
    for (const m of modelSettings.matchAll(/<object id="(\d+)">\s*<metadata key="name" value="([^"]*)"/g)) names.set(m[1], decodeXml(m[2]))

    // slicing results are present only when the file was exported after slicing
    const slice = new Map<number, string>()
    const sliceXml = text('Metadata/slice_info.config')
    for (const b of blocks(sliceXml, 'plate')) slice.set(Number(meta(b, 'index')), b)
    const nozzle = [...slice.values()].map((b) => meta(b, 'nozzle_diameters')).find(Boolean)

    const plates: ThreeMFPlate[] = blocks(modelSettings, 'plate').map((b) => {
      const id = Number(meta(b, 'plater_id') ?? 0)
      const objectIds = [...b.matchAll(/<metadata key="object_id" value="(\d+)"/g)].map((m) => m[1])
      const s = slice.get(id)
      const plate: ThreeMFPlate = {
        id,
        name: meta(b, 'plater_name') ?? '',
        thumbnail: png(files[`Metadata/plate_${id}.png`]),
        objects: [...new Set(objectIds.map((o) => names.get(o)).filter((n): n is string => !!n))]
      }
      if (s) {
        const time = Number(meta(s, 'prediction'))
        const weight = Number(meta(s, 'weight'))
        if (time) plate.printTimeSec = time
        if (weight) plate.weightG = weight
        plate.filaments = [...s.matchAll(/<filament [^>]*>/g)].map((m) => {
          const attr = (k: string) => m[0].match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? ''
          return { type: attr('type'), color: attr('color'), usedG: Number(attr('used_g')) || 0 }
        })
      }
      return plate
    })

    info = { printer, nozzle, thumbnail: png(files['Metadata/thumbnail.png']), plates }
  } catch {
    info = null
  }
  cache.set(key, info)
  return info
}
