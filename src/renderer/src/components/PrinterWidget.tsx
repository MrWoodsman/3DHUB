import { useState } from 'react'
import { useFavoritePrinter, useHub } from '../store'
import { describe, fmtEta, fmtRemaining, temp, toneDot } from '../lib/printerStatus'
import PrinterIcon from './PrinterIcon'
import { IconCheck, IconChevron, IconPlus, IconStar } from './Icons'

/** Sidebar summary of the favorite printer: status, progress, time left and temperatures. */
export default function PrinterWidget() {
  const printers = useHub((s) => s.printers)
  const favorite = useHub((s) => s.favoritePrinter)
  const { setView, setFavoritePrinter } = useHub.getState()
  const { printer, status } = useFavoritePrinter()
  const [picking, setPicking] = useState(false)

  if (printers.length === 0)
    return (
      <button
        onClick={() => setView('printers')}
        className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-accent/60 hover:text-text"
      >
        <IconPlus width={15} height={15} /> Dodaj drukarkę
      </button>
    )

  const picker = picking && (
    <>
      <div className="fixed inset-0 z-30" onMouseDown={() => setPicking(false)} />
      <div className="animate-pop absolute inset-x-0 bottom-full z-40 mb-1.5 rounded-xl border border-line-strong bg-panel p-1">
        <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">Ulubiona drukarka</div>
        {printers.map((p) => (
          <button
            key={p.id}
            onClick={() => { setFavoritePrinter(p.id); setPicking(false) }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-hover"
          >
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {printer?.id === p.id && <IconCheck width={14} height={14} className="text-accent" />}
          </button>
        ))}
      </div>
    </>
  )

  // several printers and none chosen yet
  if (!printer)
    return (
      <div className="relative">
        {picker}
        <button
          onClick={() => setPicking(true)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-line-strong hover:text-text"
        >
          <IconStar width={15} height={15} /> Wybierz ulubioną drukarkę
        </button>
      </div>
    )

  const { label, tone } = describe(status)
  const online = status?.conn === 'online'
  const printing = online && (status.state === 'RUNNING' || status.state === 'PAUSE' || status.state === 'PREPARE')
  const percent = Math.max(0, Math.min(100, status?.percent ?? 0))

  return (
    <div className="relative">
      {picker}
      <div className="rounded-xl border border-line bg-raised p-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => setView('printers')} title="Otwórz drukarki" className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="shrink-0 text-muted"><PrinterIcon model={printer.model} size={28} /></span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{printer.name}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]} ${tone === 'accent' ? 'animate-pulse' : ''}`} />
                <span className="truncate">{label}</span>
              </span>
            </span>
          </button>
          {printers.length > 1 && (
            <button
              onClick={() => setPicking(!picking)}
              aria-label="Zmień ulubioną drukarkę"
              title={favorite ? 'Zmień ulubioną drukarkę' : 'Wybierz ulubioną drukarkę'}
              className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-hover hover:text-text"
            >
              <IconChevron width={14} height={14} className="-rotate-90" />
            </button>
          )}
        </div>

        {status?.conn === 'error' && <p className="mt-2 text-[11px] leading-snug text-bad">{status.error}</p>}

        {printing && (
          <div className="mt-2.5">
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div className={`h-full rounded-full transition-[width] duration-500 ${status.state === 'PAUSE' ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between text-[11px] tabular-nums">
              <span className="font-medium text-text">{percent}%</span>
              {status.remainingMin !== undefined && <span className="text-muted">{fmtRemaining(status.remainingMin)} · {fmtEta(status.remainingMin)}</span>}
            </div>
            {status.file && <div className="mt-1 truncate text-[11px] text-faint" title={status.file}>{status.file}</div>}
          </div>
        )}

        {online && (
          <div className="mt-2.5 flex justify-between text-[11px] tabular-nums text-muted">
            <span>Dysza <span className="text-text">{temp(status.nozzle)}</span></span>
            <span>Stół <span className="text-text">{temp(status.bed)}</span></span>
          </div>
        )}
      </div>
    </div>
  )
}
