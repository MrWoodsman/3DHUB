import { useHub } from '../store'
import { SHORTCUT_GROUPS } from '../lib/shortcuts'
import { Combo } from './Kbd'
import Modal from './Modal'

/** Cheat sheet with every shortcut. Opens with "?" or F1. */
export default function ShortcutsModal() {
  const setShortcutsOpen = useHub((s) => s.setShortcutsOpen)
  return (
    <Modal title="Skróty klawiszowe" onClose={() => setShortcutsOpen(false)} wide>
      <div className="grid gap-x-8 gap-y-6 px-6 py-5 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group, i) => (
          <section key={group.title} className={i === 0 ? 'sm:row-span-2' : ''}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{group.title}</h3>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="text-muted">{item.label}</span>
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
                    {item.keys.map((combo, j) => (
                      <span key={j} className="flex items-center gap-1.5">
                        {j > 0 && <span className="text-[10px] text-faint">lub</span>}
                        <Combo keys={combo} />
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="border-t border-line px-6 py-3 text-xs text-faint">Skróty działają, gdy nie piszesz w polu tekstowym. Wciśnij ? w dowolnym momencie, żeby wrócić do tej listy.</p>
    </Modal>
  )
}
