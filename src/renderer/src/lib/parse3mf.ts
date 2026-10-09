import { unzipSync } from 'fflate'

/**
 * Minimal .3mf reader that works in a Web Worker (three's loader needs DOMParser).
 *
 * Bambu Studio keeps colors outside the standard 3MF materials:
 *  - every object has an "extruder" number in Metadata/model_settings.config,
 *  - project_settings.config lists the filament colors,
 *  - colors painted with the brush are stored per triangle as `paint_color` (a subdivision tree,
 *    see decodePaint), so a single mesh triangle can end up in several colors.
 */

export interface Part3mf {
  position: Float32Array // triangle soup, already in world (build) coordinates
  color?: string // "#RRGGBB" of the assigned filament
}

type Vec3 = [number, number, number]

/** 3MF row-vector matrix: m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32 (last three = translation). */
type Matrix = number[]
const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]

const parseMatrix = (s: string | undefined): Matrix => {
  const n = s?.trim().split(/\s+/).map(Number)
  return n && n.length === 12 && n.every(Number.isFinite) ? n : IDENTITY
}

/** Apply `a` first, then `b`. */
function mul(a: Matrix, b: Matrix): Matrix {
  const r: Matrix = new Array(12)
  for (let row = 0; row < 4; row++)
    for (let c = 0; c < 3; c++) {
      let v = row === 3 ? b[9 + c] : 0
      for (let k = 0; k < 3; k++) v += a[row * 3 + k] * b[k * 3 + c]
      r[row * 3 + c] = v
    }
  return r
}

const det = (m: Matrix): number =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])

// ---- painted colors ---------------------------------------------------------------------------

type PaintNode = { state: number } | { special: number; children: PaintNode[] }

/**
 * Decodes a `paint_color` value. It is a stream of hex nibbles read from the END of the string.
 * Low 2 bits of a nibble = number of split sides (0 = leaf). A leaf stores the filament number in the
 * next 2 bits (3 means "3 + the following nibble"). A split stores the special side in the next 2 bits
 * and is followed by its (split sides + 1) children.
 */
function decodePaint(hex: string): PaintNode | null {
  const nibbles = [...hex].reverse().map((c) => parseInt(c, 16))
  if (nibbles.some(Number.isNaN)) return null
  let pos = 0
  const read = (depth: number): PaintNode => {
    if (pos >= nibbles.length || depth > 12) throw new Error('bad paint data')
    const n = nibbles[pos++]
    const split = n & 3
    if (split === 0) {
      let state = n >> 2
      if (state === 3) state = 3 + (nibbles[pos++] ?? 0)
      return { state }
    }
    const children: PaintNode[] = []
    for (let i = 0; i <= split; i++) children.push(read(depth + 1))
    return { special: n >> 2, children }
  }
  try { return read(0) } catch { return null }
}

const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

/** Walks the subdivision tree of one triangle and reports every leaf triangle with its state. */
function walkPaint(node: PaintNode, tri: [Vec3, Vec3, Vec3], emit: (state: number, a: Vec3, b: Vec3, c: Vec3) => void): void {
  if ('state' in node) return emit(node.state, tri[0], tri[1], tri[2])
  const s = node.special % 3
  const v0 = tri[s], v1 = tri[(s + 1) % 3], v2 = tri[(s + 2) % 3] // v0 is the vertex the split edges start from
  // Reconstructed from Bambu's TriangleSelector and checked on a painted file: neighbouring triangles agree on
  // the color along their shared edge (284 of ~36000 samples differ, every other variant tried was worse).
  // Children are created in the order below but stored in the stream in reverse.
  let kids: [Vec3, Vec3, Vec3][]
  if (node.children.length === 2) {
    const m01 = mid(v0, v1) // one split side: (v0,v1)
    kids = [[v0, m01, v2], [m01, v1, v2]]
  } else if (node.children.length === 3) {
    const m01 = mid(v0, v1), m02 = mid(v0, v2) // two split sides: (v0,v1) and (v0,v2); (v1,v2) stays whole
    kids = [[v0, m01, m02], [m01, v1, m02], [v1, v2, m02]]
  } else {
    const m01 = mid(v0, v1), m12 = mid(v1, v2), m20 = mid(v2, v0) // all three sides split
    kids = [[v0, m01, m20], [m01, v1, m12], [m12, v2, m20], [m01, m12, m20]]
  }
  kids.reverse()
  node.children.forEach((child, i) => walkPaint(child, kids[i], emit))
}

// ---- 3MF structure ----------------------------------------------------------------------------

interface Mesh {
  vertices: Float32Array
  triangles: Uint32Array
  paint: Map<number, PaintNode> // triangle index -> painted subdivision
}
interface Component { path?: string; id: string; transform: Matrix }
interface Obj { mesh?: Mesh; components: Component[] }

const attr = (tag: string, name: string): string | undefined => {
  const key = ` ${name}="`
  const i = tag.indexOf(key)
  if (i < 0) return undefined
  const start = i + key.length
  return tag.slice(start, tag.indexOf('"', start))
}

function parseMesh(body: string): Mesh | undefined {
  const verts: number[] = []
  const tris: number[] = []
  const paint = new Map<number, PaintNode>()
  for (const m of body.matchAll(/<vertex\b[^>]*>/g)) verts.push(Number(attr(m[0], 'x')), Number(attr(m[0], 'y')), Number(attr(m[0], 'z')))
  for (const m of body.matchAll(/<triangle\b[^>]*>/g)) {
    const tag = m[0]
    const index = tris.length / 3
    tris.push(Number(attr(tag, 'v1')), Number(attr(tag, 'v2')), Number(attr(tag, 'v3')))
    if (tag.length > 48) {
      const p = attr(tag, 'paint_color') ?? attr(tag, 'mmu_segmentation')
      const node = p ? decodePaint(p) : null
      if (node) paint.set(index, node)
    }
  }
  return tris.length ? { vertices: Float32Array.from(verts), triangles: Uint32Array.from(tris), paint } : undefined
}

function parseObjects(xml: string): Map<string, Obj> {
  const objects = new Map<string, Obj>()
  for (const m of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = attr(m[1] + ' ', 'id') ?? attr(' ' + m[1], 'id')
    if (!id) continue
    const components = [...m[2].matchAll(/<component\b[^>]*>/g)].map((c) => ({
      path: attr(c[0], 'p:path')?.replace(/^\//, ''),
      id: attr(c[0], 'objectid') ?? '',
      transform: parseMatrix(attr(c[0], 'transform'))
    }))
    objects.set(id, { mesh: parseMesh(m[2]), components })
  }
  return objects
}

const text = (files: Record<string, Uint8Array>, name: string): string =>
  files[name] ? new TextDecoder().decode(files[name]) : ''

/** Growable Float32 buffer, one per color. */
class Soup {
  data = new Float32Array(3000)
  length = 0
  push(a: Vec3, b: Vec3, c: Vec3): void {
    if (this.length + 9 > this.data.length) {
      const bigger = new Float32Array(this.data.length * 2)
      bigger.set(this.data)
      this.data = bigger
    }
    this.data.set(a, this.length)
    this.data.set(b, this.length + 3)
    this.data.set(c, this.length + 6)
    this.length += 9
  }
}

export function parse3mf(buf: ArrayBuffer): Part3mf[] {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => /\.model$|\.config$/.test(f.name) })
  const rootPath = '3D/3dmodel.model'
  const rootXml = text(files, rootPath)
  if (!rootXml) throw new Error('not a 3mf')

  // filament number -> color (Bambu / Orca)
  let palette: string[] = []
  try { palette = JSON.parse(text(files, 'Metadata/project_settings.config')).filament_colour ?? [] } catch { /* not Bambu */ }
  const colorOfFilament = (n: number): string | undefined => (n >= 1 && palette[n - 1] ? palette[n - 1].slice(0, 7) : undefined)

  // object id -> default filament
  const defaultColor = new Map<string, string>()
  for (const m of text(files, 'Metadata/model_settings.config').matchAll(/<object\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)) {
    const color = colorOfFilament(Number(m[2].match(/<metadata key="extruder" value="(\d+)"/)?.[1]))
    if (color) defaultColor.set(m[1], color)
  }

  const parsed = new Map<string, Map<string, Obj>>([[rootPath, parseObjects(rootXml)]])
  const objectsOf = (path: string): Map<string, Obj> => {
    let m = parsed.get(path)
    if (!m) parsed.set(path, (m = parseObjects(text(files, path))))
    return m
  }

  const soups = new Map<string, Soup>()
  const soup = (color: string | undefined): Soup => {
    const key = color ?? ''
    let s = soups.get(key)
    if (!s) soups.set(key, (s = new Soup()))
    return s
  }

  const place = (t: Matrix, v: Float32Array, i: number): Vec3 => {
    const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2]
    return [x * t[0] + y * t[3] + z * t[6] + t[9], x * t[1] + y * t[4] + z * t[7] + t[10], x * t[2] + y * t[5] + z * t[8] + t[11]]
  }

  const addMesh = (mesh: Mesh, t: Matrix, color: string | undefined): void => {
    const flip = det(t) < 0 // mirrored objects need the winding reversed
    const out = (c: string | undefined, a: Vec3, b: Vec3, d: Vec3) => (flip ? soup(c).push(a, d, b) : soup(c).push(a, b, d))
    const tri = mesh.triangles
    for (let i = 0; i < tri.length / 3; i++) {
      const a = place(t, mesh.vertices, tri[i * 3]), b = place(t, mesh.vertices, tri[i * 3 + 1]), c = place(t, mesh.vertices, tri[i * 3 + 2])
      const painted = mesh.paint.get(i)
      if (painted) walkPaint(painted, [a, b, c], (state, p, q, r) => out(state > 0 ? (colorOfFilament(state) ?? color) : color, p, q, r))
      else out(color, a, b, c)
    }
  }

  // walk the build items, collecting every mesh with its accumulated transform
  let meshes = 0
  const walk = (path: string, id: string, matrix: Matrix, color: string | undefined, depth = 0): void => {
    const obj = objectsOf(path).get(id)
    if (!obj || depth > 8) return
    if (obj.mesh) { addMesh(obj.mesh, matrix, color); meshes++ }
    for (const c of obj.components) walk(c.path ?? path, c.id, mul(c.transform, matrix), color, depth + 1)
  }
  for (const m of rootXml.matchAll(/<item\b[^>]*>/g)) {
    const id = attr(m[0], 'objectid')
    if (id) walk(rootPath, id, parseMatrix(attr(m[0], 'transform')), defaultColor.get(id))
  }
  if (meshes === 0) throw new Error('3mf has no meshes')

  return [...soups].map(([color, s]) => ({ position: s.data.slice(0, s.length), color: color || undefined }))
}
