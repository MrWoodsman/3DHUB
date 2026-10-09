import { create } from 'zustand'
import type { ModelFile, ModelMeta, ModelSummary, Project, ProjectPart, ThumbSource } from '@shared/types'
import type { PrinterInfo, PrinterStatus } from '@shared/printers'

export type View = 'library' | 'projects' | 'printers'
export type LibraryMode = 'folders' | 'flat'

const read = (k: string): string | null => {
  try { return localStorage.getItem(k) } catch { return null }
}
const write = (k: string, v: string): void => {
  try { localStorage.setItem(k, v) } catch { /* ignore */ }
}

/** Electron wraps main-process errors as "Error invoking remote method ...: Error: <message>". */
const errorText = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export const emptyMeta = (): ModelMeta => ({ tags: [], notes: '', favorite: false })
export const newPart = (name = 'Nowa część'): ProjectPart => ({ id: crypto.randomUUID(), name, versions: [], current: null })

let saveTimer: ReturnType<typeof setTimeout> | undefined

interface HubState {
  view: View
  libraryPath: string | null
  models: ModelFile[]
  meta: Record<string, ModelMeta>
  summaries: Record<string, ModelSummary> // 3MF plates / time / weight, by model.rel
  scanning: boolean // true until the first library scan finishes (drives the skeleton grid)
  folderPaths: string[] // every folder in the library, empty ones included
  toast: { text: string; tone: 'ok' | 'bad'; id: number } | null
  showToast: (text: string, tone?: 'ok' | 'bad') => void
  createFolder: (name: string) => Promise<boolean>
  moveItem: (rel: string, destFolder: string[], label: string) => Promise<void> // a file or a whole folder
  renameItem: (rel: string, name: string, isDir: boolean) => Promise<boolean>
  trashItem: (rel: string, isDir: boolean, label: string) => Promise<void>
  importFiles: (paths: string[], destFolder: string[]) => Promise<void> // copy model files in from Explorer
  thumbSource: ThumbSource | null // null = not chosen yet
  setThumbSource: (s: ThumbSource) => Promise<void>
  projects: Project[]
  activeProject: string | null
  printers: PrinterInfo[]
  printerStatuses: Record<string, PrinterStatus>
  favoritePrinter: string | null // shown as a summary above Settings in the sidebar
  setFavoritePrinter: (id: string | null) => void
  setPrinters: (updater: (p: PrinterInfo[]) => PrinterInfo[]) => void
  selected: ModelFile | null
  libraryMode: LibraryMode
  tileSize: number // px, min tile width
  folder: string[] // current path relative to the library root
  settingsOpen: boolean
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
  setView: (v: View) => void
  select: (m: ModelFile | null) => void
  setLibraryMode: (m: LibraryMode) => void
  setTileSize: (n: number) => void
  openFolder: (path: string[]) => void
  setSettingsOpen: (open: boolean) => void
  updateMeta: (rel: string, patch: Partial<ModelMeta>) => void
  setActiveProject: (id: string | null) => void
  createProject: () => string
  editProject: (id: string, fn: (p: Project) => Project) => void
  deleteProject: (id: string) => void
  showInLibrary: (rel: string) => void
  init: () => Promise<void>
  pickFolder: () => Promise<void>
  rescan: () => Promise<void>
}

export const useHub = create<HubState>((set, get) => {
  /** Re-reads everything after a file or folder changed path (newRel null = deleted) and keeps the UI pointing at it. */
  const afterChange = async (oldRel: string, newRel: string | null) => {
    const inside = (rel: string) => rel === oldRel || rel.startsWith(oldRel + '/')
    const moved = (rel: string) => (newRel === null ? null : newRel + rel.slice(oldRel.length))
    const selectedRel = get().selected?.rel
    const here = get().folder.join('/')
    set({ projects: await window.hub.getProjects() }) // main rewrote the paths inside projects
    await get().rescan()
    if (selectedRel !== undefined) {
      const next = inside(selectedRel) ? moved(selectedRel) : selectedRel
      set({ selected: get().models.find((m) => m.rel === next) ?? null })
    }
    if (here && inside(here)) {
      const next = moved(here) ?? oldRel.split('/').slice(0, -1).join('/')
      set({ folder: next ? next.split('/') : [] })
    }
  }

  const persistProjects = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => window.hub.saveProjects(get().projects), 300)
  }

  return {
    view: 'library',
    libraryPath: null,
    models: [],
    meta: {},
    summaries: {},
    scanning: true,
    folderPaths: [],
    toast: null,
    showToast: (text, tone = 'ok') => {
      const id = Date.now()
      set({ toast: { text, tone, id } })
      setTimeout(() => get().toast?.id === id && set({ toast: null }), 3500)
    },
    createFolder: async (name) => {
      try {
        await window.hub.createFolder(get().folder.join('/'), name)
        await get().rescan()
        return true
      } catch (e) {
        get().showToast(errorText(e), 'bad')
        return false
      }
    },
    moveItem: async (rel, destFolder, label) => {
      try {
        const newRel = await window.hub.moveItem(rel, destFolder.join('/'))
        if (newRel === rel) return
        await afterChange(rel, newRel)
        get().showToast(`Przeniesiono „${label}” do ${destFolder.length ? destFolder[destFolder.length - 1] : 'głównego folderu'}`)
      } catch (e) {
        get().showToast(errorText(e), 'bad')
      }
    },
    renameItem: async (rel, name, isDir) => {
      try {
        const newRel = await window.hub.renameItem(rel, name)
        if (newRel !== rel) await afterChange(rel, newRel)
        return true
      } catch (e) {
        get().showToast(errorText(e), 'bad')
        return false
      }
    },
    importFiles: async (paths, destFolder) => {
      try {
        const { imported, skipped } = await window.hub.importFiles(paths, destFolder.join('/'))
        if (imported > 0) await get().rescan()
        const added = imported ? `Dodano ${imported} ${imported === 1 ? 'plik' : 'plików'}` : 'Nic nie dodano (obsługiwane: STL, OBJ, 3MF)'
        const skippedText = skipped.length ? `. Pominięto ${skipped.length}, bo już istnieją: ${skipped.slice(0, 2).join(', ')}${skipped.length > 2 ? '…' : ''}` : ''
        get().showToast(added + skippedText, imported || !skipped.length ? 'ok' : 'bad')
      } catch (e) {
        get().showToast(errorText(e), 'bad')
      }
    },
    trashItem: async (rel, isDir, label) => {
      try {
        await window.hub.trashItem(rel)
        await afterChange(rel, null)
        get().showToast(`„${label}” przeniesiono do Kosza`)
      } catch (e) {
        get().showToast(errorText(e), 'bad')
      }
    },
    thumbSource: null,
    setThumbSource: async (source) => {
      const changing = get().thumbSource !== null
      await window.hub.setThumbSource(source)
      set({ thumbSource: source })
      if (changing) location.reload() // cards cache their thumbnails: start clean with the other source
      else window.hub.ensureThumbnails(get().models)
    },
    projects: [],
    activeProject: null,
    printers: [],
    printerStatuses: {},
    favoritePrinter: read('favoritePrinter'),
    setFavoritePrinter: (id) => {
      try { id ? localStorage.setItem('favoritePrinter', id) : localStorage.removeItem('favoritePrinter') } catch { /* ignore */ }
      set({ favoritePrinter: id })
    },
    setPrinters: (updater) => set({ printers: updater(get().printers) }),
    selected: null,
    libraryMode: read('libraryMode') === 'flat' ? 'flat' : 'folders',
    tileSize: Math.min(360, Math.max(120, Number(read('tileSize')) || 190)),
    folder: [],
    settingsOpen: false,
    shortcutsOpen: false,
    setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
    setView: (view) => set({ view }),
    select: (selected) => set({ selected }),
    setLibraryMode: (libraryMode) => {
      write('libraryMode', libraryMode)
      set({ libraryMode, folder: [] })
    },
    setTileSize: (tileSize) => {
      write('tileSize', String(tileSize))
      set({ tileSize })
    },
    openFolder: (folder) => set({ folder }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    updateMeta: (rel, patch) => {
      const next = { ...(get().meta[rel] ?? emptyMeta()), ...patch }
      set({ meta: { ...get().meta, [rel]: next } })
      window.hub.setMeta(rel, next)
    },
    setActiveProject: (activeProject) => set({ activeProject }),
    createProject: () => {
      const now = Date.now()
      const p: Project = { id: crypto.randomUUID(), name: 'Nowy projekt', description: '', created: now, updated: now, parts: [] }
      set({ projects: [p, ...get().projects], activeProject: p.id })
      persistProjects()
      return p.id
    },
    editProject: (id, fn) => {
      set({ projects: get().projects.map((p) => (p.id === id ? { ...fn(p), updated: Date.now() } : p)) })
      persistProjects()
    },
    deleteProject: (id) => {
      const projects = get().projects.filter((p) => p.id !== id)
      set({ projects, activeProject: get().activeProject === id ? (projects[0]?.id ?? null) : get().activeProject })
      persistProjects()
    },
    showInLibrary: (rel) => {
      const model = get().models.find((m) => m.rel === rel)
      if (!model) return
      set({ view: 'library', selected: model, folder: get().libraryMode === 'folders' ? rel.split('/').slice(0, -1) : [] })
    },
    init: async () => {
      // printers are global (not tied to the library): load them and follow live status for the whole session
      window.hub.listPrinters().then((printers) => set({ printers }))
      window.hub.getPrinterStatuses().then((printerStatuses) => set({ printerStatuses }))
      window.hub.onPrinterStatus(({ id, status }) => set({ printerStatuses: { ...get().printerStatuses, [id]: status } }))
      set({ libraryPath: await window.hub.getLibraryPath(), thumbSource: (await window.hub.getSettings()).thumbSource })
      const projects = await window.hub.getProjects()
      set({ projects, activeProject: projects[0]?.id ?? null })
      await get().rescan()
    },
    pickFolder: async () => {
      const p = await window.hub.selectLibraryFolder()
      if (p) {
        set({ libraryPath: p, selected: null, folder: [] })
        const projects = await window.hub.getProjects()
        set({ projects, activeProject: projects[0]?.id ?? null })
        await get().rescan()
      }
    },
    rescan: async () => {
      const [models, meta, folderPaths] = await Promise.all([window.hub.scanLibrary(), window.hub.getMeta(), window.hub.getFolders()])
      set({ models, meta, folderPaths, scanning: false })
      // the first time a library has 3MF files we ask where their thumbnails should come from (see App)
      if (get().thumbSource !== null || !models.some((m) => m.format === '3mf')) window.hub.ensureThumbnails(models)
      window.hub.getSummaries(models).then((summaries) => set({ summaries }))
    }
  }
})

/** The printer shown in the sidebar: the chosen favorite, or the only printer when there is just one. */
export function useFavoritePrinter(): { printer: PrinterInfo | undefined; status: PrinterStatus | undefined } {
  const printers = useHub((s) => s.printers)
  const favorite = useHub((s) => s.favoritePrinter)
  const statuses = useHub((s) => s.printerStatuses)
  const printer = printers.find((p) => p.id === favorite) ?? (printers.length === 1 ? printers[0] : undefined)
  return { printer, status: printer ? statuses[printer.id] : undefined }
}
