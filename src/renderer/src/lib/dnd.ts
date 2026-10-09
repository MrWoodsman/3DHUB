import { useState } from 'react'

/** Drag types: a model card (payload = model id, its absolute path) or a folder card (payload = folder rel path). */
export const MODEL_DRAG = 'application/x-3dhub-model'
export const FOLDER_DRAG = 'application/x-3dhub-folder'

export type Dropped = { kind: 'model'; id: string } | { kind: 'folder'; rel: string } | { kind: 'files'; paths: string[] } // files: dragged in from Explorer

/** Props that make an element a drop target for dragged model and folder cards. */
export function useItemDrop(onDrop: (dropped: Dropped) => void) {
  const [over, setOver] = useState(false)
  const accepts = (e: React.DragEvent) => ['Files', MODEL_DRAG, FOLDER_DRAG].some((type) => e.dataTransfer.types.includes(type))
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (!accepts(e)) return
        e.preventDefault() // allows the drop
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes('Files') ? 'copy' : 'move'
        setOver(true)
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      },
      onDrop: (e: React.DragEvent) => {
        setOver(false)
        const id = e.dataTransfer.getData(MODEL_DRAG)
        const rel = e.dataTransfer.getData(FOLDER_DRAG)
        const paths = [...e.dataTransfer.files].map((f) => window.hub.getPathForFile(f)).filter(Boolean)
        if (!id && !rel && paths.length === 0) return
        e.preventDefault()
        e.stopPropagation()
        onDrop(id ? { kind: 'model', id } : rel ? { kind: 'folder', rel } : { kind: 'files', paths })
      }
    }
  }
}
