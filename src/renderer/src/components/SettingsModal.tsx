import { useState } from 'react'
import { useHub, type LibraryMode } from '../store'
import { clearThumbnailMemory } from '../lib/thumbnails'
import Modal from './Modal'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const btn = 'rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-xs font-medium text-text transition hover:bg-hover'

export default function SettingsModal() {
  const { setSettingsOpen, libraryPath, pickFolder, rescan, libraryMode, setLibraryMode, tileSize, setTileSize, models, thumbSource, setThumbSource } = useHub()
  const [cleared, setCleared] = useState(false)

  const modes: [LibraryMode, string][] = [['folders', 'Foldery'], ['flat', 'Wszystkie modele']]

  const clearCache = async () => {
    await window.hub.clearThumbnails()
    clearThumbnailMemory()
    setCleared(true)
    setTimeout(() => location.reload(), 600)
  }

  return (
    <Modal title="Ustawienia" onClose={() => setSettingsOpen(false)}>
      <div className="divide-y divide-line">
        <Section title="Biblioteka">
          <div className="rounded-xl border border-line bg-bg px-3.5 py-2.5">
            <div className="text-[11px] text-faint">Folder biblioteki</div>
            <div className="mt-0.5 break-all text-sm" style={{ userSelect: 'text' }}>{libraryPath ?? 'nie wybrano'}</div>
            <div className="mt-1 text-xs text-muted">{models.length} modeli</div>
          </div>
          <div className="flex gap-2">
            <button onClick={pickFolder} className={btn}>Zmień folder</button>
            <button onClick={rescan} className={btn}>Przeskanuj ponownie</button>
          </div>
        </Section>

        <Section title="Widok">
          <Row label="Sposób wyświetlania" hint="Foldery pokazują strukturę z dysku, drugi tryb wszystkie modele naraz.">
            <div className="flex rounded-lg bg-bg p-0.5 text-xs">
              {modes.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setLibraryMode(id)}
                  className={`rounded-md px-3 py-1.5 transition ${libraryMode === id ? 'bg-hover text-text' : 'text-muted hover:text-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Rozmiar kafelków">
            <input type="range" min={120} max={360} step={10} value={tileSize} onChange={(e) => setTileSize(Number(e.target.value))} className="w-36" />
          </Row>
        </Section>

        <Section title="Miniatury">
          <Row label="Miniatury plików 3MF" hint="Z pliku: obraz zapisany przez Bambu Studio. Brakujące i tak się wygenerują. Zmiana odświeża widok.">
            <div className="flex rounded-lg bg-bg p-0.5 text-xs">
              {([['embedded', 'Z pliku'], ['generated', 'Generowane']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => thumbSource !== id && setThumbSource(id)}
                  className={`rounded-md px-3 py-1.5 transition-colors ${(thumbSource ?? 'embedded') === id ? 'bg-hover text-text' : 'text-muted hover:text-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title="Dane aplikacji">
          <p className="text-xs leading-relaxed text-muted">
            Miniatury, tagi, notatki i ulubione zapisują się w ukrytym folderze <code className="rounded bg-bg px-1 py-0.5 text-text">.3dhub</code> wewnątrz biblioteki.
            Skaner go pomija, a po przeniesieniu biblioteki dane jadą razem z nią.
          </p>
          <div className="flex gap-2">
            <button onClick={() => window.hub.openDataFolder()} className={btn}>Otwórz folder danych</button>
            <button onClick={clearCache} disabled={cleared} className={btn}>{cleared ? 'Wyczyszczono…' : 'Wyczyść miniatury'}</button>
          </div>
        </Section>
      </div>
    </Modal>
  )
}