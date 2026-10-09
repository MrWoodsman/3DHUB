import { useHub, type View } from '../store'
import PrinterWidget from './PrinterWidget'
import { Combo } from './Kbd'
import { IconCube, IconKeyboard, IconLayers, IconPrinter, IconSettings } from './Icons'

const items: { id: View; label: string; icon: typeof IconCube; key: string }[] = [
  { id: 'library', label: 'Biblioteka', icon: IconCube, key: '1' },
  { id: 'projects', label: 'Projekty', icon: IconLayers, key: '2' },
  { id: 'printers', label: 'Drukarki', icon: IconPrinter, key: '3' }
]

const item = 'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors'

export default function Sidebar() {
  const { view, setView, setSettingsOpen, setShortcutsOpen } = useHub()
  const statuses = useHub((s) => s.printerStatuses) // select the stable object, derive below (a new array here loops forever)
  const printing = Object.values(statuses).filter((p) => p.conn === 'online' && p.state === 'RUNNING')

  return (
    <nav className="flex w-52 shrink-0 flex-col gap-0.5 px-2.5 pb-1 pt-2">
      {items.map(({ id, label, icon: Icon, key }) => (
        <button
          key={id}
          onClick={() => setView(id)}
          title={`${label} (Ctrl+${key})`}
          className={`${item} ${view === id ? 'bg-raised text-text' : 'text-muted hover:bg-raised/60 hover:text-text'}`}
        >
          <Icon className={view === id ? 'text-accent' : ''} />
          {label}
          <span className="ml-auto flex items-center gap-1.5">
            {id === 'printers' && printing.length > 0 && (
              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent" title="Drukuje teraz">
                {printing.length === 1 ? `${printing[0].percent ?? 0}%` : printing.length}
              </span>
            )}
            <span className="opacity-60 transition-opacity group-hover:opacity-100"><Combo keys={['Ctrl', key]} subtle /></span>
          </span>
        </button>
      ))}
      <div className="mt-auto flex flex-col gap-1.5">
        <PrinterWidget />
        <div className="flex gap-1">
          <button onClick={() => setSettingsOpen(true)} title="Ustawienia (Ctrl+,)" className={`${item} flex-1 text-muted hover:bg-raised/60 hover:text-text`}>
            <IconSettings />
            Ustawienia
          </button>
          <button
            onClick={() => setShortcutsOpen(true)}
            aria-label="Skróty klawiszowe"
            title="Skróty klawiszowe (?)"
            className="flex w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised/60 hover:text-text"
          >
            <IconKeyboard />
          </button>
        </div>
      </div>
    </nav>
  )
}
