import { useEffect, useRef, useState } from 'react'
import type { ModelFile } from '@shared/types'
import { MODEL_DRAG } from '../lib/dnd'
import { useThumbnail } from '../lib/useThumbnail'
import { fmtDurationShort, fmtSize } from '../lib/format'
import { useHub } from '../store'
import { IconCube, IconStar } from './Icons'

export default function ModelCard({ model, selected, onSelect }: { model: ModelFile; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const thumb = useThumbnail(model, visible)
  const meta = useHub((s) => s.meta[model.rel])
  const summary = useHub((s) => s.summaries[model.rel])
  const updateMeta = useHub((s) => s.updateMeta)
  const tags = meta?.tags ?? []
  const favorite = meta?.favorite ?? false

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisible(true), io.disconnect()), { rootMargin: '300px' })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-model-id={model.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(MODEL_DRAG, model.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === ' ') { e.preventDefault(); onSelect() }
        if (e.key === 'Enter') {
          e.preventDefault()
          if (!selected) onSelect()
          else if (e.shiftKey) window.hub.revealItem(model.rel)
          else window.hub.openItem(model.rel)
        }
      }}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-raised text-left transition-colors ${
        selected ? 'border-accent' : 'border-line hover:border-line-strong'
      }`}
    >
      <div className="relative flex aspect-square items-center justify-center bg-[#15181c]">
        {thumb ? (
          <img src={thumb} alt="" draggable={false} className="animate-fade h-full w-full object-contain p-2" />
        ) : (
          <IconCube width="26%" height="26%" strokeWidth={1.2} className={`text-line-strong ${visible ? 'animate-pulse' : ''}`} />
        )}
        <span className="absolute right-2 top-2 rounded-md bg-bg/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted">
          {model.format.toUpperCase()}
        </span>
        {summary && summary.plates > 1 && (
          <span className="absolute bottom-2 left-2 rounded-md bg-bg/75 px-1.5 py-0.5 text-[10px] font-semibold text-text/90" title="Liczba plate w projekcie">
            {summary.plates} plate
          </span>
        )}
        <button
          aria-label={favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          onClick={(e) => { e.stopPropagation(); updateMeta(model.rel, { favorite: !favorite }) }}
          className={`absolute left-2 top-2 rounded-md bg-bg/70 p-1 transition ${
            favorite ? 'text-accent' : 'text-muted opacity-0 hover:text-text group-hover:opacity-100'
          }`}
        >
          <IconStar width={14} height={14} filled={favorite} />
        </button>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="truncate text-[13px] font-medium" title={model.name}>{model.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-muted">
          <span>{fmtSize(model.size)}</span>
          {summary?.printTimeSec ? (
            <>
              <span className="text-line-strong">·</span>
              <span className="truncate text-text/80" title="Czas druku i waga ze slicingu">
                {fmtDurationShort(summary.printTimeSec)}
                {summary.weightG ? ` · ${Math.round(summary.weightG)} g` : ''}
              </span>
            </>
          ) : null}
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 flex gap-1 overflow-hidden">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="truncate rounded-md bg-hover px-1.5 py-0.5 text-[10px] text-muted">{t}</span>
            ))}
            {tags.length > 3 && <span className="shrink-0 py-0.5 text-[10px] text-faint">+{tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  )
}