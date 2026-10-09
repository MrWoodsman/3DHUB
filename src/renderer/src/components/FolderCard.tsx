import { useState } from 'react'
import type { ModelFile } from '@shared/types'
import { FOLDER_DRAG, useItemDrop, type Dropped } from '../lib/dnd'
import LazyThumb from './LazyThumb'
import { IconFolder, IconPencil, IconTrash } from './Icons'

// How the preview cards fan out, by how many files the folder has (1, 2 or 3+). Back to front.
const FANS: Record<number, { rotate: number; x: number; y: number }[]> = {
  1: [{ rotate: 0, x: 0, y: 0 }],
  2: [{ rotate: -7, x: -15, y: 2 }, { rotate: 6, x: 13, y: -2 }],
  3: [{ rotate: -10, x: -24, y: 3 }, { rotate: 9, x: 24, y: 0 }, { rotate: 0, x: 0, y: -3 }]
}

const action = 'rounded-md bg-bg/75 p-1 text-muted opacity-0 transition hover:text-text group-hover:opacity-100 focus-visible:opacity-100'

/** A folder drawn as a small stack of the cards inside it. Accepts dropped models and folders, can be renamed and deleted. */
export default function FolderCard({ rel, name, count, previews, onOpen, onDrop, onRename, onDelete }: {
  rel: string
  name: string
  count: number
  previews: ModelFile[] // up to 3 models from inside, recursively
  onOpen: () => void
  onDrop: (dropped: Dropped) => void
  onRename: (name: string) => Promise<boolean>
  onDelete: () => void
}) {
  const { over, props } = useItemDrop(onDrop)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const fan = FANS[Math.min(3, previews.length)]
  // the first preview is the front card, so draw the list back to front
  const stack = [...previews.slice(0, 3)].reverse()

  const startRename = () => { setDraft(name); setEditing(true) }
  const commit = async () => {
    if (draft.trim() && draft.trim() !== name) {
      if (await onRename(draft)) return setEditing(false)
      return // the error toast says why; stay in the field
    }
    setEditing(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData(FOLDER_DRAG, rel)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => !editing && onOpen()}
      onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      {...props}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-colors ${
        over ? 'border-accent bg-accent/5' : 'border-line bg-raised hover:border-line-strong'
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-[#15181c]">
        {stack.length === 0 ? (
          <div className="pointer-events-none absolute inset-[22%] flex items-center justify-center rounded-xl border border-dashed border-line-strong text-line-strong">
            <IconFolder width="40%" height="40%" />
          </div>
        ) : (
          stack.map((m, i) => {
            const pos = fan[i]
            return (
              <div
                key={m.id}
                className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[56%] overflow-hidden rounded-lg border border-line-strong bg-raised transition-transform duration-200 group-hover:scale-[1.03]"
                style={{ transform: `translate(calc(-50% + ${pos.x}%), calc(-50% + ${pos.y}%)) rotate(${pos.rotate}deg)` }}
              >
                <LazyThumb model={m} className="h-full w-full !rounded-none" />
              </div>
            )
          })
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-bg/75 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
          <IconFolder width={11} height={11} /> {count}
        </span>
        <div className="absolute right-2 top-2 flex gap-1">
          <button aria-label="Zmień nazwę folderu" title="Zmień nazwę" onClick={(e) => { e.stopPropagation(); startRename() }} className={action}>
            <IconPencil width={13} height={13} />
          </button>
          <button aria-label="Usuń folder" title="Usuń (do Kosza)" onClick={(e) => { e.stopPropagation(); onDelete() }} className={`${action} hover:!text-bad`}>
            <IconTrash width={13} height={13} />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3 pt-2.5" onClick={(e) => editing && e.stopPropagation()}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={() => setEditing(false)}
            aria-label="Nowa nazwa folderu"
            className="w-full rounded-md border border-accent bg-bg px-2 py-1 text-[13px] outline-none"
          />
        ) : (
          <>
            <div className="truncate text-[13px] font-medium" title={`${name} (dwuklik: zmień nazwę)`} onDoubleClick={(e) => { e.stopPropagation(); startRename() }}>{name}</div>
            <div className="mt-0.5 text-xs text-muted">{count === 0 ? 'Pusty folder' : `${count} ${count === 1 ? 'model' : 'modeli'}`}</div>
          </>
        )}
      </div>
    </div>
  )
}
