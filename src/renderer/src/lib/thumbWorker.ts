import type { ModelFile } from '@shared/types'
import { renderThumbnail } from './thumbRenderer'

/** Entry point of the hidden window (#thumbs): renders queued models one by one. */
export function startThumbWorker(): void {
  let queue: ModelFile[] = []
  let running = false

  const run = async (): Promise<void> => {
    running = true
    while (queue.length) {
      const model = queue.shift()!
      let url: string | null = null
      try {
        url = await renderThumbnail(model)
      } catch (e) {
        console.error('thumbnail failed', model.path, e)
      }
      await window.hub.thumbRendered(model, url)
    }
    running = false
  }

  window.hub.onThumbJob((models) => {
    queue = [...models] // a new job replaces the old queue
    if (!running) run()
  })
  window.hub.thumbWorkerReady()
}