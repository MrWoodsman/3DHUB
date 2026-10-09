import * as THREE from 'three'
import type { ModelFile } from '@shared/types'
import { loadModel, disposeObject } from './loadModel'

const SIZE = 512
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null

function setup() {
  if (!renderer || !scene) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(SIZE, SIZE)
    renderer.setPixelRatio(1)
    scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#ffffff', '#3b3f52', 1.1))
    const key = new THREE.DirectionalLight('#ffffff', 2)
    key.position.set(1, 2, 1.5)
    scene.add(key)
  }
  return { renderer, scene }
}

/** Renders one model to a PNG data URL. Runs only in the hidden thumbnail window. */
export async function renderThumbnail(model: ModelFile): Promise<string> {
  const { renderer, scene } = setup()
  const obj = await loadModel(model)
  const box = new THREE.Box3().setFromObject(obj)
  const center = box.getCenter(new THREE.Vector3())
  const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1
  obj.position.sub(center)
  scene.add(obj)

  const camera = new THREE.PerspectiveCamera(35, 1, radius / 100, radius * 100)
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(35 / 2))
  camera.position.set(1, 0.8, 1.2).normalize().multiplyScalar(dist * 0.95)
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(obj)
  disposeObject(obj)
  return url
}