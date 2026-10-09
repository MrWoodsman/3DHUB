import { useState } from 'react'
import { PRINTER_MODELS, jpegCameraModels, type AmsUnit, type PrinterCommand, type PrinterInfo, type PrinterStatus } from '@shared/printers'
import { useFavoritePrinter, useHub } from '../store'
import ConfirmModal from '../components/ConfirmModal'
import PrinterIcon from '../components/PrinterIcon'
import AddPrinterModal from '../components/AddPrinterModal'
import CameraModal from '../components/CameraModal'
import { IconPlus, IconPrinter, IconStar, IconTrash } from '../components/Icons'
import { describe, fmtEta, fmtRemaining, temp, toneClass } from '../lib/printerStatus'

const SPEEDS: [1 | 2 | 3 | 4, string][] = [[1, 'Cichy'], [2, 'Standard'], [3, 'Sport'], [4, 'Szalony']]

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-bg/50 px-2.5 py-1.5">
      <div className="text-[10px] text-faint">{label}</div>
      <div className="truncate text-[13px] font-medium tabular-nums">{value}</div>
    </div>
  )
}

function Ams({ units, activeTray }: { units: AmsUnit[]; activeTray: number | undefined }) {
  return (
    <div className="space-y-2">
      {units.map((u) => (
        <div key={u.id} className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[10px] text-faint">AMS {u.id + 1}</span>
          <div className="grid flex-1 grid-cols-4 gap-1.5">
            {u.trays.map((t) => {
              const active = activeTray === u.id * 4 + t.id
              return (
                <div key={t.id} className={`rounded-lg border px-2 py-1.5 ${active ? 'border-accent' : 'border-line'}`} title={t.type ? `${t.type}${t.remain !== undefined ? ` · ${t.remain}%` : ''}` : 'Pusty slot'}>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 shrink-0 rounded-full border border-line-strong" style={{ background: t.color ?? 'transparent' }} />
                    <span className="truncate text-[11px] text-muted">{t.type ?? 'pusty'}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full" style={{ width: `${t.remain ?? 0}%`, background: t.color ?? 'transparent' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const ghost = 'rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-text disabled:opacity-40'

function PrinterCard({ printer, status, onRemove }: { printer: PrinterInfo; status: PrinterStatus | undefined; onRemove: () => void }) {
  const isFavorite = useFavoritePrinter().printer?.id === printer.id
  const setFavoritePrinter = useHub((s) => s.setFavoritePrinter)
  const [confirm, setConfirm] = useState<'remove' | 'stop' | null>(null)
  const [camera, setCamera] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)

  const { label, tone } = describe(status)
  const model = PRINTER_MODELS.find((m) => m.id === printer.model)
  const online = status?.conn === 'online'
  const printing = online && (status.state === 'RUNNING' || status.state === 'PAUSE' || status.state === 'PREPARE')
  const percent = Math.max(0, Math.min(100, status?.percent ?? 0))

  const send = async (cmd: PrinterCommand) => {
    setCommandError(null)
    try {
      await window.hub.sendPrinterCommand(printer.id, cmd)
    } catch (e) {
      setCommandError(String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-raised p-4">
      <header className="flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#15181c] text-muted">
          <PrinterIcon model={printer.model} size={38} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">{printer.name}</h3>
          <div className="truncate text-xs text-faint">
            {model ? `Bambu Lab ${model.label}` : 'Bambu Lab'} · {printer.ip}
            {status?.nozzleDiameter ? ` · dysza ${status.nozzleDiameter}` : ''}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClass[tone]}`}>{label}</span>
            {online && status.hmsCount ? (
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClass.warn}`} title="Ostrzeżenia drukarki (HMS)">
                {status.hmsCount} {status.hmsCount === 1 ? 'ostrzeżenie' : 'ostrzeżeń'}
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => setFavoritePrinter(isFavorite ? null : printer.id)}
          aria-label={isFavorite ? 'Usuń z ulubionych' : 'Ustaw jako ulubioną'}
          title={isFavorite ? 'Ulubiona drukarka (widoczna w pasku bocznym)' : 'Pokaż w pasku bocznym jako ulubioną'}
          className={`rounded-lg p-2 transition-colors hover:bg-hover ${isFavorite ? 'text-accent' : 'text-muted hover:text-text'}`}
        >
          <IconStar width={16} height={16} filled={isFavorite} />
        </button>
        <button onClick={() => setConfirm('remove')} aria-label="Usuń drukarkę" title="Usuń drukarkę" className="rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-bad">
          <IconTrash width={16} height={16} />
        </button>
      </header>

      {status?.conn === 'error' && <p className="text-xs leading-relaxed text-bad">{status.error}</p>}

      {online && (
        <>
          {printing && (
            <div>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium" title={status.file}>{status.file ?? 'Druk w toku'}</span>
                <span className="shrink-0 tabular-nums text-muted">{percent}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div className={`h-full rounded-full transition-[width] duration-500 ${status.state === 'PAUSE' ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-2 flex justify-between gap-3 text-xs tabular-nums text-faint">
                <span>{status.layer !== undefined && status.totalLayers ? `Warstwa ${status.layer} / ${status.totalLayers}` : ''}</span>
                <span>
                  {status.remainingMin !== undefined ? `Zostało ${fmtRemaining(status.remainingMin)} · koniec ${fmtEta(status.remainingMin)}` : ''}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Tile label="Dysza" value={temp(status.nozzle, status.nozzleTarget)} />
            <Tile label="Stół" value={temp(status.bed, status.bedTarget)} />
            <Tile label="Komora" value={temp(status.chamber)} />
          </div>

          {status.fans && (
            <div className="grid grid-cols-4 gap-2">
              <Tile label="Wentyl. modelu" value={status.fans.part !== undefined ? `${status.fans.part}%` : '-'} />
              <Tile label="Wentyl. pomocn." value={status.fans.aux !== undefined ? `${status.fans.aux}%` : '-'} />
              <Tile label="Wentyl. komory" value={status.fans.chamber !== undefined ? `${status.fans.chamber}%` : '-'} />
              <Tile label="Hotend" value={status.fans.heatbreak !== undefined ? `${status.fans.heatbreak}%` : '-'} />
            </div>
          )}

          {status.ams && status.ams.length > 0 && <Ams units={status.ams} activeTray={status.activeTray} />}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line p-0.5 text-xs" title="Prędkość druku">
              {SPEEDS.map(([level, name]) => (
                <button
                  key={level}
                  onClick={() => send({ type: 'speed', level })}
                  className={`rounded-md px-2.5 py-1 transition-colors ${status.speedLevel === level ? 'bg-hover text-text' : 'text-muted hover:text-text'}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <button onClick={() => send({ type: 'light', on: !status.light })} className={`${ghost} ${status.light ? 'border-warn/50 text-warn' : ''}`}>
              Światło {status.light ? 'włączone' : 'wyłączone'}
            </button>
            {jpegCameraModels.includes(printer.model) && (
              <button onClick={() => setCamera(true)} className={ghost}>Kamera</button>
            )}
          </div>

          {printing && (
            <div className="flex items-center gap-2 border-t border-line pt-3">
              {status.state === 'PAUSE' ? (
                <button onClick={() => send({ type: 'resume' })} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-accent-dim">Wznów</button>
              ) : (
                <button onClick={() => send({ type: 'pause' })} className={ghost}>Wstrzymaj</button>
              )}
              <button onClick={() => setConfirm('stop')} className={`${ghost} hover:text-bad`}>Przerwij druk</button>
            </div>
          )}
          {commandError && <p className="text-xs text-bad">{commandError}</p>}
        </>
      )}

      {camera && <CameraModal printerId={printer.id} name={printer.name} onClose={() => setCamera(false)} />}
      {confirm === 'remove' && (
        <ConfirmModal title="Usunąć drukarkę?" onConfirm={onRemove} onClose={() => setConfirm(null)}>
          <span className="font-medium text-text">{printer.name}</span> zniknie z aplikacji razem z zapisanym kodem dostępu. Sama drukarka nie zostanie ruszona. Możesz ją dodać ponownie w każdej chwili.
        </ConfirmModal>
      )}
      {confirm === 'stop' && (
        <ConfirmModal title="Przerwać druk?" confirmLabel="Przerwij druk" onConfirm={() => send({ type: 'stop' })} onClose={() => setConfirm(null)}>
          Drukarka <span className="font-medium text-text">{printer.name}</span> zatrzyma bieżący druk{status?.file ? <> „{status.file}”</> : ''}. Tego nie da się cofnąć.
        </ConfirmModal>
      )}
    </article>
  )
}

export default function PrintersView() {
  const { printers, printerStatuses, setPrinters } = useHub()
  const [adding, setAdding] = useState(false)

  const remove = async (id: string) => {
    await window.hub.removePrinter(id)
    setPrinters((p) => p.filter((x) => x.id !== id))
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-6 pb-3 pt-5">
        <h2 className="text-lg font-semibold">Drukarki</h2>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent-dim">
          <IconPlus width={14} height={14} strokeWidth={2.4} /> Dodaj drukarkę
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {printers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-raised text-accent">
              <IconPrinter width={26} height={26} />
            </span>
            <div className="text-base font-semibold">Podłącz drukarkę Bambu Lab</div>
            <p className="max-w-sm text-sm text-muted">Status druku, postęp, temperatury i sterowanie na żywo przez sieć lokalną (MQTT).</p>
            <button onClick={() => setAdding(true)} className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim">
              Dodaj drukarkę
            </button>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
            {printers.map((p) => (
              <PrinterCard key={p.id} printer={p} status={printerStatuses[p.id]} onRemove={() => remove(p.id)} />
            ))}
          </div>
        )}
      </div>

      {adding && <AddPrinterModal onClose={() => setAdding(false)} onAdded={(p) => { setPrinters((x) => [...x, p]); setAdding(false) }} />}
    </div>
  )
}
