import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { Mesh } from 'three'
import { parse3mf } from './parse3mf'

export interface ParsedPart {
  position: Float32Array
  normal?: Float32Array
  color?: string // "#RRGGBB", only for 3MF files with filament colors
}
export interface ParseRequest { id: number; format: 'stl' | 'obj' | '3mf'; buf: ArrayBuffer }
export interface ParseResponse { id: number; parts?: ParsedPart[]; error?: string }

const ctx = self as unknown as Worker

function parse({ format, buf }: ParseRequest): ParsedPart[] {
  if (format === '3mf') return parse3mf(buf)
  const parts: ParsedPart[] = []
  if (format === 'stl') {
    const g = new STLLoader().parse(buf)
    parts.push({ position: g.attributes.position.array as Float32Array, normal: g.attributes.normal?.array as Float32Array | undefined })
  } else {
    new OBJLoader().parse(new TextDecoder().decode(buf)).traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      parts.push({
        position: m.geometry.attributes.position.array as Float32Array,
        normal: m.geometry.attributes.normal?.array as Float32Array | undefined
      })
    })
  }
  return parts
}

ctx.onmessage = (e: MessageEvent<ParseRequest>) => {
  try {
    const parts = parse(e.data)
    const transfer = parts.flatMap((p) => [p.position.buffer, p.normal?.buffer].filter((b): b is ArrayBuffer => !!b))
    ctx.postMessage({ id: e.data.id, parts } satisfies ParseResponse, transfer)
  } catch (err) {
    ctx.postMessage({ id: e.data.id, error: String(err) } satisfies ParseResponse)
  }
}
