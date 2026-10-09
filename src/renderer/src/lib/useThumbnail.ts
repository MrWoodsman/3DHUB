import { useEffect, useState } from 'react'
import type { ModelFile } from '@shared/types'
import { getThumbnail, onThumbnailReady } from './thumbnails'

/** Loads a model's thumbnail once `enabled`, and updates when it gets generated. */
export function useThumbnail(model: ModelFile | undefined, enabled = true): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!model || !enabled) return
    let alive = true
    const load = () => getThumbnail(model).then((u) => alive && u && setUrl(u))
    load()
    const off = onThumbnailReady(model.id, load)
    return () => { alive = false; off() }
  }, [model, enabled])

  return url
}