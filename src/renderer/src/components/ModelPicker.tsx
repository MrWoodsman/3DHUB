import { useMemo, useState } from 'react'
import type { ModelFile } from '@shared/types'
import { useHub } from '../store'
import Modal from './Modal'
import LazyThumb from './LazyThumb'
import { IconSearch } from './Icons'

/** Modal for choosing a model from the library. */
export default function ModelPicker({ title, exclude, onPick, onClose }: { title: string; exclude: Set<string>; onPick: (m: ModelFile) => void; onClose: () => void }) {
  const models = useHub((s) => s.models)
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return models.filter((m) => !exclude.has(m.rel) && (!q || m.rel.toLowerCase().includes(q)))
  }, [models, query, exclude])

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="sticky top-0 border-b border-line bg-panel px-6 py-3">
        <div className="relative">
          <IconSearch width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj w bibliotece"
            className="w-full rounded-xl border border-line bg-raised py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-line-strong"
          />
        </div>
      </div>
      <ul className="p-3">
        {list.map((m) => (
          <li key={m.id}>
            <button onClick={() => onPick(m)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-raised">
              <LazyThumb model={m} className="h-12 w-12" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{m.name}</span>
                <span className="block truncate text-xs text-faint">{m.rel}</span>
              </span>
              <span className="text-[10px] font-semibold text-faint">{m.format.toUpperCase()}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="p-8 text-center text-sm text-muted">Nic nie znaleziono.</li>}
      </ul>
    </Modal>
  )
}