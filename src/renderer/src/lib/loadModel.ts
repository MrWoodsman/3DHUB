import * as THREE from 'three'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import type { ModelFile } from '@shared/types'
import type { ParsedPart, ParseRequest, ParseResponse } from './parse.worker'

const SOLID = '#8b9bff'

// Parsing runs in a Web Worker so big files do not freeze the UI.
let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, { resolve: (p: ParsedPart[]) => void; reject: (e: Error) => void }>()

function parseInWorker(format: ModelFile['format'], buf: ArrayBuffer): Promise<ParsedPart[]> {
  if (!worker) {
    worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ParseResponse>) => {
      const w = waiting.get(e.data.id)
      if (!w) return
      waiting.delete(e.data.id)
      if (e.data.parts) w.resolve(e.data.parts)
      else w.reject(new Error(e.data.error ?? 'parse failed'))
    }
  }
  const id = ++seq
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    // 3MF: send a copy and keep the original, three's loader is the fallback when the worker fails
    const transferred = format === '3mf' ? buf.slice(0) : buf
    worker!.postMessage({ id, format, buf: transferred } satisfies ParseRequest, [transferred])
  })
}

/** Switches between the filament colors stored in a 3MF and one solid color. */
export function applyColorMode(root: THREE.Object3D, colored: boolean): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mats = m.userData.materials as { solid: THREE.Material; colored: THREE.Material } | undefined
    if (mats) m.material = colored ? mats.colored : mats.solid
  })
}

export const hasColors = (root: THREE.Object3D): boolean => root.userData.hasColors === true

function buildGroup(parts: ParsedPart[]): THREE.Group {
  const group = new THREE.Group()
  const solid = new THREE.MeshStandardMaterial({ color: SOLID, roughness: 0.55, metalness: 0.1 })
  const byColor = new Map<string, THREE.MeshStandardMaterial>()
  for (const part of parts) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(part.position, 3))
    if (part.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(part.normal, 3))
    else geometry.computeVertexNormals()

    const mesh = new THREE.Mesh(geometry, solid)
    if (part.color) {
      let mat = byColor.get(part.color)
      if (!mat) {
        const c = new THREE.Color(part.color)
        if (c.getHSL({ h: 0, s: 0, l: 0 }).l < 0.12) c.setHSL(0, 0, 0.12) // pure black would vanish against the dark UI
        byColor.set(part.color, (mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05 })))
      }
      mesh.userData = { materials: { solid, colored: mat } }
      mesh.material = mat
    }
    group.add(mesh)
  }
  group.userData.hasColors = byColor.size > 0
  return group
}

async function parse(model: ModelFile, buf: ArrayBuffer): Promise<THREE.Object3D> {
  if (model.format === '3mf') {
    try {
      return buildGroup(await parseInWorker('3mf', buf))
    } catch (e) {
      console.warn('3mf worker parse failed, using three loader', e)
      return new ThreeMFLoader().parse(buf)
    }
  }
  return buildGroup(await parseInWorker(model.format, buf))
}

/** Loads a model (colored when the 3MF has filament colors) and returns it Y-up. */
export async function loadModel(model: ModelFile): Promise<THREE.Group> {
  const obj = await parse(model, await window.hub.readModel(model.path))
  obj.rotation.x = -Math.PI / 2
  const group = new THREE.Group()
  group.add(obj)
  group.userData.hasColors = obj.userData.hasColors === true
  return group
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    const mats = m.userData.materials as { solid: THREE.Material; colored: THREE.Material } | undefined
    ;(mats ? [mats.solid, mats.colored] : Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose())
  })
}
