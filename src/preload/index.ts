import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { HubApi } from '../shared/types'

const listen = <T>(channel: string, cb: (v: T) => void): (() => void) => {
  const handler = (_e: unknown, v: T) => cb(v)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: HubApi = {
  getLibraryPath: () => ipcRenderer.invoke('library:get'),
  selectLibraryFolder: () => ipcRenderer.invoke('library:select'),
  scanLibrary: () => ipcRenderer.invoke('library:scan'),
  getFolders: () => ipcRenderer.invoke('library:folders'),
  createFolder: (parentRel, name) => ipcRenderer.invoke('library:mkdir', parentRel, name),
  moveItem: (rel, destRel) => ipcRenderer.invoke('library:move', rel, destRel),
  renameItem: (rel, name) => ipcRenderer.invoke('library:rename', rel, name),
  trashItem: (rel) => ipcRenderer.invoke('library:trash', rel),
  openItem: (rel) => ipcRenderer.invoke('library:open', rel),
  revealItem: (rel) => ipcRenderer.invoke('library:reveal', rel),
  importFiles: (paths, destRel) => ipcRenderer.invoke('library:import', paths, destRel),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  readModel: (path) => ipcRenderer.invoke('model:read', path),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setThumbSource: (source) => ipcRenderer.invoke('settings:thumb-source', source),
  getSummaries: (models) => ipcRenderer.invoke('index:summaries', models),
  getModelInfo: (path) => ipcRenderer.invoke('model:info', path),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  addPrinter: (input) => ipcRenderer.invoke('printers:add', input),
  removePrinter: (id) => ipcRenderer.invoke('printers:remove', id),
  getPrinterStatuses: () => ipcRenderer.invoke('printers:statuses'),
  onPrinterStatus: (cb) => listen('printers:status', cb),
  sendPrinterCommand: (id, command) => ipcRenderer.invoke('printers:command', id, command),
  startPrinterCamera: (id) => ipcRenderer.invoke('printers:camera-start', id),
  stopPrinterCamera: (id) => ipcRenderer.invoke('printers:camera-stop', id),
  onPrinterFrame: (cb) => listen('printers:frame', cb),
  onPrinterCameraError: (cb) => listen('printers:camera-error', cb),
  getMeta: () => ipcRenderer.invoke('meta:get'),
  setMeta: (rel, meta) => ipcRenderer.invoke('meta:set', rel, meta),
  getProjects: () => ipcRenderer.invoke('projects:get'),
  saveProjects: (projects) => ipcRenderer.invoke('projects:save', projects),
  openDataFolder: () => ipcRenderer.invoke('data:open'),
  getThumbnail: (model) => ipcRenderer.invoke('thumb:get', model),
  clearThumbnails: () => ipcRenderer.invoke('thumb:clear'),
  ensureThumbnails: (models) => ipcRenderer.invoke('thumbs:ensure', models),
  onThumbProgress: (cb) => listen('thumbs:progress', cb),
  onThumbReady: (cb) => listen('thumbs:ready', cb),
  onThumbJob: (cb) => listen('thumbs:job', cb),
  thumbRendered: (model, dataUrl) => ipcRenderer.invoke('thumbs:rendered', model, dataUrl),
  thumbWorkerReady: () => ipcRenderer.send('thumbs:worker-ready')
}

contextBridge.exposeInMainWorld('hub', api)