import type { PrinterCommand, PrinterInfo, PrinterInput, PrinterStatus } from './printers'

export type ModelFormat = 'stl' | 'obj' | '3mf'

export interface ModelFile {
  id: string // absolute path
  rel: string // path relative to the library root, with "/" separators
  name: string
  path: string
  format: ModelFormat
  size: number // bytes
  modified: number // ms epoch
}

/** User data stored per model in <library>/.3dhub/data.json */
export interface ModelMeta {
  tags: string[]
  notes: string
  favorite: boolean
}

/** One file that is a version of a project part (e.g. "Obudowa" v2). */
export interface ProjectVersion {
  rel: string // model path relative to the library
  label: string // "v1", "v2 - cieńsze ścianki"
  note: string
}

/** A part of a project (obudowa, uchwyt...) with its versions. */
export interface ProjectPart {
  id: string
  name: string
  versions: ProjectVersion[]
  current: string | null // rel of the version currently used
}

/** Stored in <library>/.3dhub/projects.json */
export interface Project {
  id: string
  name: string
  description: string
  created: number
  updated: number
  parts: ProjectPart[]
}

export interface ThumbProgress {
  done: number
  total: number
}

export interface ThreeMFFilament {
  type: string
  color: string
  usedG: number
}

export interface ThreeMFPlate {
  id: number
  name: string
  thumbnail: string | null // PNG data URL
  objects: string[]
  printTimeSec?: number // only when the file was sliced
  weightG?: number
  filaments?: ThreeMFFilament[]
}

/** What a Bambu Studio / Orca .3mf says about itself. */
export interface ThreeMFInfo {
  printer: string | null // e.g. "Bambu Lab P1S"
  nozzle?: string
  thumbnail: string | null // project thumbnail when there are no plates
  plates: ThreeMFPlate[]
}

/** Cheap per-file summary of a .3mf, used for badges and filters in the library. */
export interface ModelSummary {
  plates: number
  printTimeSec?: number // total over all plates, only when the file was sliced
  weightG?: number
  printer?: string | null
}

/** Where .3mf thumbnails come from: the image saved in the file, or rendered by the app. */
export type ThumbSource = 'embedded' | 'generated'

export interface AppSettings {
  thumbSource: ThumbSource | null // null = not chosen yet (asked on first start)
}

export interface HubApi {
  getSettings: () => Promise<AppSettings>
  setThumbSource: (source: ThumbSource) => Promise<void>
  getSummaries: (models: ModelFile[]) => Promise<Record<string, ModelSummary>>
  getLibraryPath: () => Promise<string | null>
  selectLibraryFolder: () => Promise<string | null>
  scanLibrary: () => Promise<ModelFile[]>
  getFolders: () => Promise<string[]> // every library folder (relative, "/" separated), empty ones included
  createFolder: (parentRel: string, name: string) => Promise<string>
  moveItem: (rel: string, destRel: string) => Promise<string> // file or folder; returns the new rel
  renameItem: (rel: string, name: string) => Promise<string> // file keeps its extension; returns the new rel
  trashItem: (rel: string) => Promise<void> // to the Recycle Bin
  openItem: (rel: string) => Promise<void> // default program (the slicer for 3MF)
  revealItem: (rel: string) => Promise<void> // show in Explorer
  importFiles: (paths: string[], destRel: string) => Promise<{ imported: number; skipped: string[] }>
  getPathForFile: (file: File) => string // real path of a file dropped from Explorer
  readModel: (path: string) => Promise<ArrayBuffer>
  getModelInfo: (path: string) => Promise<ThreeMFInfo | null>
  getMeta: () => Promise<Record<string, ModelMeta>>
  setMeta: (rel: string, meta: ModelMeta) => Promise<void>
  getProjects: () => Promise<Project[]>
  saveProjects: (projects: Project[]) => Promise<void>
  openDataFolder: () => Promise<void>
  // thumbnails: rendered in a hidden window, read from <library>/.3dhub/thumbs
  getThumbnail: (model: ModelFile) => Promise<string | null>
  clearThumbnails: () => Promise<void>
  ensureThumbnails: (models: ModelFile[]) => Promise<void>
  onThumbProgress: (cb: (p: ThumbProgress) => void) => () => void
  onThumbReady: (cb: (id: string) => void) => () => void
  // used only by the hidden renderer window
  onThumbJob: (cb: (models: ModelFile[]) => void) => () => void
  thumbRendered: (model: ModelFile, dataUrl: string | null) => Promise<void>
  thumbWorkerReady: () => void
  // printers (Bambu Lab over MQTT)
  listPrinters: () => Promise<PrinterInfo[]>
  addPrinter: (input: PrinterInput) => Promise<PrinterInfo>
  removePrinter: (id: string) => Promise<void>
  getPrinterStatuses: () => Promise<Record<string, PrinterStatus>>
  onPrinterStatus: (cb: (v: { id: string; status: PrinterStatus }) => void) => () => void
  sendPrinterCommand: (id: string, command: PrinterCommand) => Promise<void>
  startPrinterCamera: (id: string) => Promise<void>
  stopPrinterCamera: (id: string) => Promise<void>
  onPrinterFrame: (cb: (v: { id: string; frame: string }) => void) => () => void
  onPrinterCameraError: (cb: (v: { id: string; error: string }) => void) => () => void
}
