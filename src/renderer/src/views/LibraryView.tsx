import { useEffect, useMemo, useRef, useState } from 'react'
import { useHub } from '../store'
import ModelCard from '../components/ModelCard'
import FolderCard from '../components/FolderCard'
import ConfirmModal from '../components/ConfirmModal'
import Kbd from '../components/Kbd'
import DetailsPanel from '../components/DetailsPanel'
import ResizablePanel from '../components/ResizablePanel'
import FiltersPopover, { activeFilterCount, matchesFilters, noFilters, type Filters } from '../components/FiltersPopover'
import { IconChevron, IconCube, IconRefresh, IconSearch, IconStar } from '../components/Icons'
import { useItemDrop, type Dropped } from '../lib/dnd'
import type { ModelFile, ModelSummary } from '@shared/types'

const segmentsOf = (m: ModelFile): string[] => m.rel.split('/').slice(0, -1)
const startsWith = (a: string[], prefix: string[]): boolean => prefix.every((p, i) => a[i] === p)

// Shared look for header controls: same height, radius, border and text size.
const control = 'h-9 rounded-lg border border-line bg-raised text-[13px]'

const chip = (active: boolean) =>
  `flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
    active ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-strong hover:text-text'
  }`

interface FolderInfo { name: string; count: number; previews: ModelFile[] }

/** One breadcrumb segment; a dragged model dropped on it moves up to that folder. */
function Crumb({ label, last, onOpen, onDrop }: { label: string; last: boolean; onOpen: () => void; onDrop: (dropped: Dropped) => void }) {
  const { over, props } = useItemDrop(onDrop)
  return (
    <button
      disabled={last && !over}
      onClick={onOpen}
      {...props}
      className={`rounded-md px-1.5 py-0.5 transition-colors ${over ? 'bg-accent/15 text-accent' : last ? 'font-medium' : 'text-muted hover:text-text'}`}
    >
      {label}
    </button>
  )
}

type Sort = 'name' | 'newest' | 'largest' | 'time'
const SORTS: [Sort, string][] = [
  ['name', 'Nazwa A-Z'],
  ['newest', 'Najnowsze'],
  ['largest', 'Największe'],
  ['time', 'Najkrótszy druk']
]
const SORT_KEY = 'librarySort'
const loadSort = (): Sort => {
  try {
    const v = localStorage.getItem(SORT_KEY) as Sort | null
    return v && SORTS.some(([id]) => id === v) ? v : 'name'
  } catch {
    return 'name'
  }
}

function sortModels(list: ModelFile[], sort: Sort, summaries: Record<string, ModelSummary>): ModelFile[] {
  const byName = (a: ModelFile, b: ModelFile) => a.name.localeCompare(b.name, 'pl', { numeric: true })
  const out = [...list]
  switch (sort) {
    case 'newest': return out.sort((a, b) => b.modified - a.modified || byName(a, b))
    case 'largest': return out.sort((a, b) => b.size - a.size || byName(a, b))
    case 'time': // files without slicing data go last
      return out.sort((a, b) => (summaries[a.rel]?.printTimeSec ?? Infinity) - (summaries[b.rel]?.printTimeSec ?? Infinity) || byName(a, b))
    default: return out.sort(byName)
  }
}

function SkeletonGrid({ tileSize }: { tileSize: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-line bg-raised">
          <div className="aspect-square bg-[#15181c]" />
          <div className="space-y-2 px-3 pb-3 pt-2.5">
            <div className="h-3 w-3/4 rounded bg-hover" />
            <div className="h-2.5 w-1/3 rounded bg-hover" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LibraryView() {
  const { libraryPath, models, meta, selected, select, pickFolder, rescan, libraryMode, setLibraryMode, folder, openFolder, tileSize, setTileSize } = useHub()
  const scanning = useHub((s) => s.scanning)
  const folderPaths = useHub((s) => s.folderPaths)
  const { moveItem, renameItem, trashItem, createFolder, importFiles } = useHub.getState()
  const [deleting, setDeleting] = useState<{ rel: string; name: string; count: number } | null>(null)
  const [fileOver, setFileOver] = useState(false) // files being dragged in from Explorer
  const [creating, setCreating] = useState(false)
  const [folderName, setFolderName] = useState('')
  const summaries = useHub((s) => s.summaries)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [onlyFav, setOnlyFav] = useState(false)
  const [filters, setFilters] = useState<Filters>(noFilters)
  const [sort, setSortState] = useState<Sort>(loadSort)
  const searchRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const setSort = (s: Sort) => {
    setSortState(s)
    try { localStorage.setItem(SORT_KEY, s) } catch { /* ignore */ }
  }

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    Object.values(meta).forEach((m) => m.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [meta])

  const filtering = query.trim() !== '' || tag !== null || onlyFav || activeFilterCount(filters) > 0

  const { folders, files, total } = useMemo(() => {
    if (filtering || libraryMode === 'flat') {
      const q = query.trim().toLowerCase()
      const list = models.filter((m) => {
        const mm = meta[m.rel]
        return (
          (!q || m.name.toLowerCase().includes(q) || mm?.tags.some((t) => t.includes(q))) &&
          (!tag || mm?.tags.includes(tag)) &&
          (!onlyFav || mm?.favorite) &&
          matchesFilters(filters, summaries[m.rel])
        )
      })
      return { folders: [] as FolderInfo[], files: sortModels(list, sort, summaries), total: list.length }
    }
    const subs = new Map<string, FolderInfo>()
    const sub = (name: string): FolderInfo => subs.get(name) ?? (subs.set(name, { name, count: 0, previews: [] }), subs.get(name)!)
    const here: ModelFile[] = []
    for (const m of sortModels(models, 'name', summaries)) {
      const seg = segmentsOf(m)
      if (!startsWith(seg, folder)) continue
      if (seg.length === folder.length) here.push(m)
      else {
        const s = sub(seg[folder.length])
        s.count++
        if (s.previews.length < 3) s.previews.push(m) // first files by name become the stack on the card
      }
    }
    for (const path of folderPaths) {
      const seg = path.split('/')
      if (seg.length > folder.length && startsWith(seg, folder)) sub(seg[folder.length]) // empty folders too
    }
    const sorted = [...subs.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }))
    return { folders: sorted, files: sortModels(here, sort, summaries), total: here.length + sorted.length }
  }, [models, meta, summaries, folderPaths, query, tag, onlyFav, filters, filtering, libraryMode, folder, sort])

  // Library shortcuts (the full list is in lib/shortcuts.ts): search, Esc, arrows, Backspace, and keys for the selected model.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable
      const ctrl = e.ctrlKey || e.metaKey
      const dialogOpen = !!document.querySelector('[role=dialog]')
      if (e.key === 'Escape') {
        if (typing) return void el.blur()
        if (dialogOpen) return // the dialog closes itself
        if (selected) select(null)
        else if (filtering) { setQuery(''); setTag(null); setOnlyFav(false); setFilters(noFilters) }
        return
      }
      if (dialogOpen) return
      if ((e.key === '/' && !typing) || (ctrl && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (typing || ctrl || e.altKey) return

      if (e.key === 'Backspace' && libraryMode === 'folders' && !filtering && folder.length) {
        e.preventDefault()
        return openFolder(folder.slice(0, -1))
      }
      if (!selected) return

      if (e.key === 'F2') { e.preventDefault(); return void window.dispatchEvent(new Event('hub:rename')) }
      if (e.key === 'Delete') { e.preventDefault(); return void window.dispatchEvent(new Event('hub:delete')) }
      if (e.key.toLowerCase() === 'c') return void window.dispatchEvent(new Event('hub:toggle-color'))
      if (e.key.toLowerCase() === 'f') {
        const { meta: all, updateMeta } = useHub.getState()
        return updateMeta(selected.rel, { favorite: !all[selected.rel]?.favorite })
      }
      // Enter on a focused card is handled by the card itself
      if (e.key === 'Enter' && !el.closest('[data-model-id]')) {
        e.preventDefault()
        return void (e.shiftKey ? window.hub.revealItem(selected.rel) : window.hub.openItem(selected.rel))
      }

      if (!e.key.startsWith('Arrow') || !gridRef.current) return
      const columns = Math.max(1, getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length)
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[e.key]
      const i = files.findIndex((m) => m.id === selected.id)
      const next = files[i + (step ?? 0)]
      if (step && next) {
        e.preventDefault()
        select(next)
        const card = [...gridRef.current.children].find((c) => (c as HTMLElement).dataset.modelId === next.id)
        card?.scrollIntoView({ block: 'nearest' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [files, selected, select, filtering, libraryMode, folder, openFolder])

  // Ctrl+N (sent by App) starts the "new folder" field
  useEffect(() => {
    const start = () => libraryMode === 'folders' && !filtering && setCreating(true)
    window.addEventListener('hub:new-folder', start)
    return () => window.removeEventListener('hub:new-folder', start)
  }, [libraryMode, filtering])

  if (!libraryPath)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-raised text-accent">
          <IconCube width={30} height={30} />
        </span>
        <div>
          <div className="text-base font-semibold">Wybierz folder z modelami</div>
          <div className="mt-1 text-sm text-muted">Obsługiwane formaty: STL, OBJ, 3MF.</div>
        </div>
        <button onClick={pickFolder} className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim">
          Wybierz folder
        </button>
      </div>
    )

  const crumbs = libraryMode === 'folders' && !filtering
  const moveHere = (dropped: Dropped, dest: string[]) => {
    if (dropped.kind === 'files') return void importFiles(dropped.paths, dest)
    if (dropped.kind === 'folder') return void moveItem(dropped.rel, dest, dropped.rel.split('/').pop() ?? dropped.rel)
    const model = models.find((m) => m.id === dropped.id)
    if (model) moveItem(model.rel, dest, model.name)
  }
  const iconOnly = 'hidden @4xl:inline' // button labels disappear when the library area gets narrow

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="@container">
          <header className="flex items-center gap-2 px-5 pb-3 pt-4">
            <div className="relative min-w-[9rem] max-w-sm flex-1">
              <IconSearch width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj po nazwie lub tagu"
                aria-label="Szukaj modeli"
                className={`${control} w-full pl-9 pr-8 outline-none placeholder:text-faint focus:border-line-strong`}
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1 text-[10px] text-faint">/</kbd>
            </div>
            <button
              onClick={() => setOnlyFav(!onlyFav)}
              title="Tylko ulubione"
              className={`${control} flex shrink-0 items-center gap-1.5 px-3 transition-colors ${onlyFav ? 'border-accent/60 text-accent' : 'text-muted hover:border-line-strong hover:text-text'}`}
            >
              <IconStar width={14} height={14} filled={onlyFav} /> <span className={iconOnly}>Ulubione</span>
            </button>
            <FiltersPopover filters={filters} onChange={setFilters} buttonClass={`${control} flex items-center gap-1.5 px-3 transition-colors`} />
            <div className={`${control} flex shrink-0 items-center p-0.5`}>
              {([['folders', 'Foldery'], ['flat', 'Wszystkie']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setLibraryMode(id)} className={`h-full rounded-md px-3 transition-colors ${libraryMode === id ? 'bg-hover text-text' : 'text-muted hover:text-text'}`}>
                  {label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sortowanie"
              title="Sortowanie"
              className={`${control} shrink-0 cursor-pointer px-2.5 text-muted outline-none transition-colors hover:border-line-strong hover:text-text focus:border-line-strong`}
            >
              {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <label className="ml-auto hidden shrink-0 items-center gap-2 text-faint @5xl:flex" title="Rozmiar kafelków">
              <span className="h-2 w-2 rounded-sm bg-current" />
              <input type="range" min={120} max={360} step={10} value={tileSize} onChange={(e) => setTileSize(Number(e.target.value))} className="w-24" aria-label="Rozmiar kafelków" />
              <span className="h-3.5 w-3.5 rounded-sm bg-current" />
            </label>
            <button onClick={rescan} aria-label="Odśwież bibliotekę" title="Odśwież" className={`${control} ml-auto flex w-9 shrink-0 items-center justify-center text-muted transition-colors hover:border-line-strong hover:text-text @5xl:ml-0`}>
              <IconRefresh width={15} height={15} className={scanning ? 'animate-spin' : ''} />
            </button>
          </header>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-3">
            {allTags.map((t) => (
              <button key={t} onClick={() => setTag(tag === t ? null : t)} className={chip(tag === t)}>{t}</button>
            ))}
          </div>
        )}

        <div className="flex h-9 items-center gap-1 border-y border-line px-5 text-[13px]">
          {crumbs ? (
            [null, ...folder].map((name, i) => {
              const last = i === folder.length
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <IconChevron width={13} height={13} className="text-faint" />}
                  <Crumb label={name ?? 'Biblioteka'} last={last} onOpen={() => openFolder(folder.slice(0, i))} onDrop={(d) => moveHere(d, folder.slice(0, i))} />
                </span>
              )
            })
          ) : (
            <span className="text-muted">{libraryMode === 'flat' && !filtering ? 'Wszystkie modele' : 'Wyniki'}</span>
          )}
          {filtering && (
            <button
              onClick={() => { setQuery(''); setTag(null); setOnlyFav(false); setFilters(noFilters) }}
              className="ml-2 rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-text"
            >
              Wyczyść filtry
            </button>
          )}
          {crumbs && (
            creating ? (
              <input
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Escape') { setCreating(false); setFolderName('') }
                  if (e.key === 'Enter' && folderName.trim() && (await createFolder(folderName))) { setCreating(false); setFolderName('') }
                }}
                onBlur={() => { setCreating(false); setFolderName('') }}
                placeholder="Nazwa folderu i Enter"
                aria-label="Nazwa nowego folderu"
                className="ml-3 h-7 w-52 rounded-md border border-line-strong bg-raised px-2 text-xs outline-none placeholder:text-faint focus:border-accent"
              />
            ) : (
              <button onClick={() => setCreating(true)} className="ml-3 rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-text">
                + Nowy folder <Kbd subtle>Ctrl N</Kbd>
              </button>
            )
          )}
          <span className="ml-auto text-xs tabular-nums text-faint">{files.length} modeli</span>
        </div>

        <div
          className="relative min-h-0 flex-1"
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setFileOver(true) } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false) }}
          onDrop={(e) => {
            setFileOver(false)
            const paths = [...e.dataTransfer.files].map((file) => window.hub.getPathForFile(file)).filter(Boolean)
            if (paths.length) { e.preventDefault(); importFiles(paths, folder) }
          }}
        >
          {fileOver && (
            <div className="animate-fade pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-bg/80 text-sm font-medium text-accent">
              Upuść pliki STL, OBJ lub 3MF, aby dodać do „{folder.length ? folder[folder.length - 1] : 'Biblioteka'}”
            </div>
          )}
        <div className="h-full overflow-y-auto p-5">
          {scanning && models.length === 0 ? (
            <SkeletonGrid tileSize={tileSize} />
          ) : total === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-raised text-faint">
                <IconSearch width={22} height={22} />
              </span>
              <div className="text-sm font-medium">{filtering ? 'Nic nie pasuje do filtrów' : 'Ten folder jest pusty'}</div>
              <div className="text-xs text-muted">{filtering ? 'Zmień wyszukiwanie albo wyczyść filtry.' : 'Obsługiwane formaty: STL, OBJ, 3MF.'}</div>
            </div>
          ) : (
            <div ref={gridRef} className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}>
              {folders.map((f) => (
                <FolderCard
                  key={'d:' + f.name}
                  rel={[...folder, f.name].join('/')}
                  name={f.name}
                  count={f.count}
                  previews={f.previews}
                  onOpen={() => openFolder([...folder, f.name])}
                  onDrop={(d) => moveHere(d, [...folder, f.name])}
                  onRename={(name) => renameItem([...folder, f.name].join('/'), name, true)}
                  onDelete={() => setDeleting({ rel: [...folder, f.name].join('/'), name: f.name, count: f.count })}
                />
              ))}
              {files.map((m) => (
                <ModelCard key={m.id} model={m} selected={selected?.id === m.id} onSelect={() => select(m)} />
              ))}
            </div>
          )}
        </div>
        </div>
      </section>
      {selected && (
        <ResizablePanel>
          <DetailsPanel model={selected} onClose={() => select(null)} />
        </ResizablePanel>
      )}
      {deleting && (
        <ConfirmModal
          title="Usunąć folder?"
          confirmLabel="Przenieś do Kosza"
          onConfirm={() => trashItem(deleting.rel, true, deleting.name)}
          onClose={() => setDeleting(null)}
        >
          Folder <span className="font-medium text-text">{deleting.name}</span> trafi do Kosza
          {deleting.count > 0 ? ` razem z ${deleting.count} ${deleting.count === 1 ? 'modelem' : 'modelami'}` : ''}. Możesz go stamtąd przywrócić.
          Tagi i notatki tych modeli zostaną usunięte.
        </ConfirmModal>
      )}
    </div>
  )
}
