import { useState } from 'react'
import type { ModelSummary } from '@shared/types'

export interface Filters {
  maxMinutes: number | null // print time up to
  maxWeight: number | null // grams, up to
  minPlates: number | null
  slicedOnly: boolean
}

export const noFilters: Filters = { maxMinutes: null, maxWeight: null, minPlates: null, slicedOnly: false }

export const activeFilterCount = (f: Filters): number =>
  [f.maxMinutes, f.maxWeight, f.minPlates].filter((v) => v !== null).length + (f.slicedOnly ? 1 : 0)

/** Files without slicing data never match a time or weight limit. */
export function matchesFilters(f: Filters, s: ModelSummary | undefined): boolean {
  if (f.slicedOnly && !s?.printTimeSec) return false
  if (f.maxMinutes !== null && !(s?.printTimeSec !== undefined && s.printTimeSec / 60 <= f.maxMinutes)) return false
  if (f.maxWeight !== null && !(s?.weightG !== undefined && s.weightG <= f.maxWeight)) return false
  if (f.minPlates !== null && (s?.plates ?? 1) < f.minPlates) return false
  return true
}

const chip = (on: boolean) =>
  `rounded-md border px-2 py-1 text-[11px] transition-colors ${on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-strong hover:text-text'}`

function NumberField({ label, unit, value, presets, onChange }: { label: string; unit: string; value: number | null; presets: [string, number][]; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
          placeholder="bez limitu"
          className="w-28 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[13px] tabular-nums outline-none placeholder:text-faint focus:border-line-strong"
        />
        <span className="text-xs text-faint">{unit}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map(([text, v]) => (
          <button key={text} onClick={() => onChange(value === v ? null : v)} className={chip(value === v)}>{text}</button>
        ))}
      </div>
    </div>
  )
}

export default function FiltersPopover({ filters, onChange, buttonClass }: { filters: Filters; onChange: (f: Filters) => void; buttonClass: string }) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(filters)
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen(!open)} className={`${buttonClass} ${count ? 'border-accent/60 text-accent' : 'text-muted hover:border-line-strong hover:text-text'}`}>
        Filtry
        {count > 0 && <span className="rounded bg-accent/20 px-1.5 text-[10px] font-semibold tabular-nums">{count}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setOpen(false)} />
          <div className="animate-pop absolute left-0 top-11 z-40 w-80 space-y-4 rounded-xl border border-line-strong bg-panel p-4">
            <NumberField
              label="Czas druku do"
              unit="min"
              value={filters.maxMinutes}
              presets={[['30 min', 30], ['1 h', 60], ['2 h', 120], ['4 h', 240]]}
              onChange={(v) => set({ maxMinutes: v })}
            />
            <NumberField
              label="Waga do"
              unit="g"
              value={filters.maxWeight}
              presets={[['20 g', 20], ['50 g', 50], ['100 g', 100], ['200 g', 200]]}
              onChange={(v) => set({ maxWeight: v })}
            />
            <div>
              <div className="mb-1.5 text-xs text-muted">Liczba plate</div>
              <div className="flex gap-1.5">
                {[[null, 'Dowolna'], [2, '2+'], [3, '3+'], [5, '5+']].map(([v, text]) => (
                  <button key={String(text)} onClick={() => set({ minPlates: v as number | null })} className={chip(filters.minPlates === v)}>{text}</button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={filters.slicedOnly} onChange={(e) => set({ slicedOnly: e.target.checked })} className="accent-[#ff8a2b]" />
              Tylko pocięte pliki 3MF
            </label>
            <p className="text-[11px] leading-relaxed text-faint">
              Czas i waga pochodzą z pliku 3MF zapisanego po slicingu w Bambu Studio. Pliki bez tych danych nie pasują do limitów.
            </p>
            {count > 0 && (
              <button onClick={() => onChange(noFilters)} className="text-xs text-muted underline-offset-2 hover:text-text hover:underline">Wyczyść filtry</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
