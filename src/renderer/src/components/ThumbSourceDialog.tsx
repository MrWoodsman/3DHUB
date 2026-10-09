import { useHub } from '../store'
import Modal from './Modal'

const options = [
  {
    id: 'embedded' as const,
    title: 'Z pliku 3MF',
    badge: 'Zalecane',
    text: 'Bierzemy obraz zapisany w pliku przez Bambu Studio, taki sam jak w slicerze. Jest natychmiast, bez renderowania. Jeśli pliku brakuje miniatury, wygenerujemy ją sami.'
  },
  {
    id: 'generated' as const,
    title: 'Generowane w aplikacji',
    text: 'Aplikacja sama renderuje każdy model, tak jak pliki STL i OBJ. Wygląd jest spójny, ale generowanie trwa dłużej, zwłaszcza za pierwszym razem.'
  }
]

/** Shown once, when the library contains 3MF files and no source has been chosen yet. */
export default function ThumbSourceDialog() {
  const setThumbSource = useHub((s) => s.setThumbSource)

  return (
    <Modal title="Miniatury plików 3MF" onClose={() => setThumbSource('embedded')}>
      <div className="space-y-3 px-6 py-5">
        <p className="text-[13px] leading-relaxed text-muted">
          Pliki 3MF zwykle mają w środku gotową miniaturę. Skąd ją brać? Możesz to zmienić później w ustawieniach.
        </p>
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => setThumbSource(o.id)}
            className="block w-full rounded-xl border border-line bg-raised p-4 text-left transition-colors hover:border-accent"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{o.title}</span>
              {o.badge && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{o.badge}</span>}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{o.text}</p>
          </button>
        ))}
      </div>
    </Modal>
  )
}
