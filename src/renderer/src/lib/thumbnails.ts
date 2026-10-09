import type { ModelFile } from '@shared/types'

const memory = new Map<string, string>()
const listeners = new Map<string, Set<() => void>>()
let subscribed = false

const key = (m: ModelFile) => `${m.id}|${m.modified}|${m.size}`

export const clearThumbnailMemory = (): void => memory.clear()

/** Thumbnail from memory or from <library>/.3dhub/thumbs. null = not generated yet. */
export async function getThumbnail(model: ModelFile): Promise<string | null> {
  const k = key(model)
  const hit = memory.get(k)
  if (hit) return hit
  const url = await window.hub.getThumbnail(model)
  if (url) memory.set(k, url)
  return url
}

/** Calls cb when the hidden window finishes this model's thumbnail. */
export function onThumbnailReady(id: string, cb: () => void): () => void {
  if (!subscribed) {
    subscribed = true
    window.hub.onThumbReady((readyId) => listeners.get(readyId)?.forEach((fn) => fn()))
  }
  const set = listeners.get(id) ?? new Set()
  set.add(cb)
  listeners.set(id, set)
  return () => { set.delete(cb) }
}