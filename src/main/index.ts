import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, extname, basename, dirname, relative, sep } from 'path'
import { promises as fs, constants as fsConstants } from 'fs'
import { execFile } from 'child_process'
import { createHash } from 'crypto'
import type { ModelFile, ModelFormat, ModelMeta, ModelSummary, Project, ThumbSource } from '../shared/types'
import { registerPrinters } from './printers'
import { extractEmbeddedThumbnail, readThreeMFInfo, readThreeMFSummary } from './threemf'

const FORMATS: ModelFormat[] = ['stl', 'obj', '3mf']
const DATA_DIR = '.3dhub' // lives inside the library folder; the scanner ignores it

const configFile = () => join(app.getPath('userData'), 'config.json')

interface Config {
  libraryPath?: string
  thumbSource?: ThumbSource
}

async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await fs.readFile(configFile(), 'utf8'))
  } catch {
    return {}
  }
}
const writeConfig = (c: object) => fs.writeFile(configFile(), JSON.stringify(c, null, 2))
const libraryRoot = async () => (await readConfig()).libraryPath ?? null

// ---- <library>/.3dhub: thumbnails + user data (tags, notes, favorites) ----

const dataDir = (root: string) => join(root, DATA_DIR)

async function ensureDataDir(root: string): Promise<string> {
  const dir = dataDir(root)
  const existed = await fs.stat(dir).then(() => true, () => false)
  await fs.mkdir(join(dir, 'thumbs'), { recursive: true })
  if (!existed && process.platform === 'win32') execFile('attrib', ['+h', dir], () => undefined)
  return dir
}

/** 3MF thumbnails taken from the file get their own cache key, so switching the source never mixes them up. */
const thumbPath = (root: string, m: ModelFile, source: ThumbSource | undefined) => {
  const key = m.format === '3mf' && source === 'embedded' ? `v5|emb|${m.rel}|${m.modified}|${m.size}` : `v3|${m.rel}|${m.modified}|${m.size}`
  return join(dataDir(root), 'thumbs', createHash('sha1').update(key).digest('hex') + '.png')
}

let metaCache: { root: string; data: Record<string, ModelMeta> } | null = null
let writeQueue: Promise<unknown> = Promise.resolve()

async function loadMeta(root: string): Promise<Record<string, ModelMeta>> {
  if (metaCache?.root === root) return metaCache.data
  let data: Record<string, ModelMeta> = {}
  try {
    data = JSON.parse(await fs.readFile(join(dataDir(root), 'data.json'), 'utf8')).models ?? {}
  } catch { /* no data yet */ }
  metaCache = { root, data }
  return data
}

/** Atomic, serialized write of a JSON file inside .3dhub. */
function writeData(root: string, name: string, content: unknown): Promise<unknown> {
  const job = writeQueue.catch(() => undefined).then(async () => {
    const dir = await ensureDataDir(root)
    const file = join(dir, name)
    await fs.writeFile(file + '.tmp', JSON.stringify(content, null, 2))
    // Windows can refuse the rename for a moment while something is reading the target
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(file + '.tmp', file)
        return
      } catch (e) {
        if (attempt < 5) await new Promise((r) => setTimeout(r, 40 * (attempt + 1)))
        else {
          await fs.copyFile(file + '.tmp', file) // last resort: not atomic, but never loses the write
          await fs.rm(file + '.tmp', { force: true })
          return
        }
      }
    }
  })
  writeQueue = job.catch(() => undefined) // one failed write must not block the following ones
  return job
}
const saveMeta = (root: string) => writeData(root, 'data.json', { version: 1, models: metaCache?.data ?? {} })

// ---- library scan ----

async function scan(root: string, dir: string, out: ModelFile[] = []): Promise<ModelFile[]> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue // .3dhub and other hidden folders
    const full = join(dir, e.name)
    if (e.isDirectory()) await scan(root, full, out)
    else {
      const ext = extname(e.name).slice(1).toLowerCase() as ModelFormat
      if (!FORMATS.includes(ext)) continue
      const st = await fs.stat(full)
      out.push({
        id: full,
        rel: relative(root, full).split(sep).join('/'),
        name: basename(e.name, '.' + ext),
        path: full,
        format: ext,
        size: st.size,
        modified: st.mtimeMs
      })
    }
  }
  return out
}

function registerIpc(): void {
  ipcMain.handle('library:get', libraryRoot)
  ipcMain.handle('library:select', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (r.canceled) return null
    await writeConfig({ ...(await readConfig()), libraryPath: r.filePaths[0] })
    return r.filePaths[0]
  })
  ipcMain.handle('library:scan', async () => {
    const root = await libraryRoot()
    return root ? scan(root, root) : []
  })
  // ---- folders: list, create, move files between them ----
  const toRel = (root: string, abs: string) => relative(root, abs).split(sep).join('/')
  const inside = (root: string, abs: string) => abs === root || abs.startsWith(root + sep)

  async function listDirs(root: string, dir: string, out: string[] = []): Promise<string[]> {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      const full = join(dir, e.name)
      out.push(toRel(root, full))
      await listDirs(root, full, out)
    }
    return out
  }
  ipcMain.handle('library:folders', async () => {
    const root = await libraryRoot()
    return root ? listDirs(root, root) : []
  })

  ipcMain.handle('library:mkdir', async (_e, parentRel: string, name: string) => {
    const root = await libraryRoot()
    const clean = name.trim()
    if (!root) throw new Error('Nie wybrano biblioteki')
    if (!clean || /[\\/:*?"<>|]/.test(clean) || clean === '.' || clean === '..' || clean.startsWith('.')) throw new Error('Nieprawidłowa nazwa folderu')
    const target = join(root, parentRel, clean)
    if (!inside(root, target)) throw new Error('Folder poza biblioteką')
    try {
      await fs.mkdir(target)
    } catch (e) {
      throw new Error((e as NodeJS.ErrnoException).code === 'EEXIST' ? 'Folder o tej nazwie już istnieje' : 'Nie udało się utworzyć folderu')
    }
    return toRel(root, target)
  })

  // After a file or folder changed its relative path, carry its thumbnails, tags/notes/favorites and
  // project entries over to the new path. `newRel` null means it is gone (deleted).
  async function carryOver(root: string, oldRel: string, newRel: string | null, isDir: boolean): Promise<void> {
    const remap = (rel: string): string | null => {
      const hit = isDir ? rel === oldRel || rel.startsWith(oldRel + '/') : rel === oldRel
      return hit ? (newRel === null ? null : newRel + rel.slice(oldRel.length)) : rel
    }

    if (newRel !== null) {
      // thumbnails are keyed by relative path: rename them instead of re-rendering
      const files = isDir ? await scan(root, join(root, newRel)) : [{ rel: newRel } as ModelFile]
      for (const f of files) {
        const abs = join(root, f.rel)
        const st = await fs.stat(abs).catch(() => null)
        if (!st) continue
        const was = f.rel.replace(newRel, oldRel)
        const asModel = (r: string) => ({ rel: r, modified: st.mtimeMs, size: st.size, format: extname(abs).slice(1).toLowerCase() }) as ModelFile
        for (const source of ['embedded', 'generated'] as const)
          await fs.rename(thumbPath(root, asModel(was), source), thumbPath(root, asModel(f.rel), source)).catch(() => undefined)
      }
    }

    const data = await loadMeta(root)
    let metaChanged = false
    for (const key of Object.keys(data)) {
      const mapped = remap(key)
      if (mapped === key) continue
      if (mapped !== null) data[mapped] = data[key]
      delete data[key]
      metaChanged = true
    }
    if (metaChanged) await saveMeta(root)

    try {
      const projects: Project[] = JSON.parse(await fs.readFile(join(dataDir(root), 'projects.json'), 'utf8')).projects ?? []
      let changed = false
      for (const p of projects)
        for (const part of p.parts) {
          const cur = part.current === null ? null : remap(part.current)
          if (cur !== part.current && newRel !== null) { part.current = cur; changed = true }
          for (const v of part.versions) {
            const mapped = remap(v.rel)
            if (mapped !== v.rel && mapped !== null) { v.rel = mapped; changed = true }
          }
        }
      if (changed) await writeData(root, 'projects.json', { version: 1, projects })
    } catch { /* no projects yet */ }
  }

  const checkName = (name: string): string => {
    const clean = name.trim()
    if (!clean || /[\/:*?"<>|]/.test(clean) || clean === '.' || clean === '..' || clean.startsWith('.')) throw new Error('Nieprawidłowa nazwa')
    return clean
  }
  const exists = (p: string) => fs.stat(p).then(() => true, () => false)

  // Moves a model file or a whole folder into another library folder.
  ipcMain.handle('library:move', async (_e, rel: string, destRel: string) => {
    const root = await libraryRoot()
    if (!root) throw new Error('Nie wybrano biblioteki')
    const from = join(root, rel)
    const destDir = join(root, destRel)
    if (!inside(root, from) || !inside(root, destDir) || from === root) throw new Error('Nieprawidłowa ścieżka')
    const isDir = (await fs.stat(from)).isDirectory()
    if (!isDir && !FORMATS.includes(extname(from).slice(1).toLowerCase() as ModelFormat)) throw new Error('Nieprawidłowa ścieżka')
    if (isDir && (destDir === from || destDir.startsWith(from + sep))) throw new Error('Nie można przenieść folderu do niego samego')
    const to = join(destDir, basename(from))
    if (to === from) return rel
    if (await exists(to)) throw new Error(isDir ? 'W folderze docelowym jest już folder o tej nazwie' : 'W folderze docelowym jest już plik o tej nazwie')
    await fs.rename(from, to)
    const newRel = toRel(root, to)
    await carryOver(root, rel, newRel, isDir)
    return newRel
  })

  // Renames a file (the extension stays) or a folder. Returns the new relative path.
  ipcMain.handle('library:rename', async (_e, rel: string, name: string) => {
    const root = await libraryRoot()
    if (!root) throw new Error('Nie wybrano biblioteki')
    const from = join(root, rel)
    if (!inside(root, from) || from === root) throw new Error('Nieprawidłowa ścieżka')
    const isDir = (await fs.stat(from)).isDirectory()
    const to = join(dirname(from), checkName(name) + (isDir ? '' : extname(from)))
    if (to === from) return rel
    if (await exists(to)) throw new Error('Element o takiej nazwie już istnieje')
    await fs.rename(from, to)
    const newRel = toRel(root, to)
    await carryOver(root, rel, newRel, isDir)
    return newRel
  })

  // Opens a file in its default program (for 3MF usually the slicer), or shows it in Explorer.
  ipcMain.handle('library:open', async (_e, rel: string) => {
    const root = await libraryRoot()
    const target = root ? join(root, rel) : ''
    if (!root || !inside(root, target)) throw new Error('Nieprawidłowa ścieżka')
    const error = await shell.openPath(target)
    if (error) throw new Error('Nie udało się otworzyć pliku')
  })
  ipcMain.handle('library:reveal', async (_e, rel: string) => {
    const root = await libraryRoot()
    const target = root ? join(root, rel) : ''
    if (!root || !inside(root, target)) throw new Error('Nieprawidłowa ścieżka')
    shell.showItemInFolder(target)
  })

  // Copies model files (or the model files inside dropped folders) from anywhere on disk into a library folder.
  ipcMain.handle('library:import', async (_e, paths: string[], destRel: string) => {
    const root = await libraryRoot()
    const destDir = root ? join(root, destRel) : ''
    if (!root || !inside(root, destDir)) throw new Error('Nieprawidłowy folder docelowy')
    let imported = 0
    const skipped: string[] = []
    const copyInto = async (src: string, dir: string): Promise<void> => {
      const st = await fs.stat(src).catch(() => null)
      if (!st) return
      if (st.isDirectory()) {
        for (const e of await fs.readdir(src)) if (!e.startsWith('.')) await copyInto(join(src, e), join(dir, basename(src)))
        return
      }
      if (!FORMATS.includes(extname(src).slice(1).toLowerCase() as ModelFormat)) return
      await fs.mkdir(dir, { recursive: true })
      try {
        await fs.copyFile(src, join(dir, basename(src)), fsConstants.COPYFILE_EXCL)
        imported++
      } catch {
        skipped.push(basename(src)) // a file with that name is already there
      }
    }
    for (const p of paths) await copyInto(p, destDir)
    return { imported, skipped }
  })

  // Sends a file or folder to the Recycle Bin (recoverable).
  ipcMain.handle('library:trash', async (_e, rel: string) => {
    const root = await libraryRoot()
    if (!root) throw new Error('Nie wybrano biblioteki')
    const target = join(root, rel)
    if (!inside(root, target) || target === root) throw new Error('Nieprawidłowa ścieżka')
    const isDir = (await fs.stat(target)).isDirectory()
    await shell.trashItem(target)
    await carryOver(root, rel, null, isDir)
  })

  ipcMain.handle('model:read', async (_e, path: string) => {
    const root = await libraryRoot()
    if (!root || !path.startsWith(root)) throw new Error('Path outside library')
    const buf = await fs.readFile(path)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })

  ipcMain.handle('settings:get', async () => ({ thumbSource: (await readConfig()).thumbSource ?? null }))
  ipcMain.handle('settings:thumb-source', async (_e, source: ThumbSource) => {
    await writeConfig({ ...(await readConfig()), thumbSource: source })
  })

  // Per-file 3MF summary (plates / time / weight), cached in .3dhub/index.json by size + mtime.
  let summariesQueue: Promise<unknown> = Promise.resolve()
  const computeSummaries = async (models: ModelFile[]) => {
    const root = await libraryRoot()
    if (!root) return {}
    type Entry = { key: string; summary: ModelSummary | null }
    let stored: Record<string, Entry> = {}
    try {
      stored = JSON.parse(await fs.readFile(join(dataDir(root), 'index.json'), 'utf8')).items ?? {}
    } catch { /* first run */ }
    const out: Record<string, ModelSummary> = {}
    let dirty = false
    for (const m of models) {
      if (m.format !== '3mf') continue
      const key = `${m.modified}|${m.size}`
      let entry = stored[m.rel]
      if (!entry || entry.key !== key) {
        entry = { key, summary: await readThreeMFSummary(m.path) }
        stored[m.rel] = entry
        dirty = true
        await new Promise((r) => setImmediate(r)) // keep the main process responsive
      }
      if (entry.summary) out[m.rel] = entry.summary
    }
    if (dirty) await writeData(root, 'index.json', { version: 1, items: stored }).catch(() => undefined)
    return out
  }
  ipcMain.handle('index:summaries', (_e, models: ModelFile[]) => {
    const job = summariesQueue.catch(() => undefined).then(() => computeSummaries(models))
    summariesQueue = job
    return job
  })

  ipcMain.handle('thumb:get', async (_e, m: ModelFile) => {
    const root = await libraryRoot()
    if (!root) return null
    try {
      return 'data:image/png;base64,' + (await fs.readFile(thumbPath(root, m, (await readConfig()).thumbSource))).toString('base64')
    } catch {
      return null
    }
  })
  ipcMain.handle('model:info', async (_e, path: string) => {
    const root = await libraryRoot()
    if (!root || !path.startsWith(root) || !path.toLowerCase().endsWith('.3mf')) return null
    return readThreeMFInfo(path)
  })

  registerPrinters(() => mainWin)

  ipcMain.handle('thumbs:ensure', async (_e, models: ModelFile[]) => {
    const root = await libraryRoot()
    if (!root) return
    const source = (await readConfig()).thumbSource
    const has = await Promise.all(models.map((m) => fs.access(thumbPath(root, m, source)).then(() => true, () => false)))
    const missing = models.filter((_, i) => !has[i])
    pendingThumbs = new Set(missing.map((m) => m.id))
    totalThumbs = missing.length
    sendProgress()

    // 3MF: take the image saved in the file; whatever has none falls back to rendering
    const toRender: ModelFile[] = []
    for (const m of missing) {
      const embedded = m.format === '3mf' && source === 'embedded' ? await extractEmbeddedThumbnail(m.path) : null
      if (embedded) {
        await ensureDataDir(root)
        await fs.writeFile(thumbPath(root, m, source), embedded)
        mainWin?.webContents.send('thumbs:ready', m.id)
        pendingThumbs.delete(m.id)
        sendProgress()
        await new Promise((r) => setImmediate(r))
      } else toRender.push(m)
    }
    if (toRender.length) (await getThumbWorker()).webContents.send('thumbs:job', toRender)
  })
  ipcMain.handle('thumbs:rendered', async (_e, m: ModelFile, dataUrl: string | null) => {
    const root = await libraryRoot()
    if (root && dataUrl) {
      await ensureDataDir(root)
      await fs.writeFile(thumbPath(root, m, (await readConfig()).thumbSource), Buffer.from(dataUrl.split(',')[1], 'base64'))
      mainWin?.webContents.send('thumbs:ready', m.id)
    }
    pendingThumbs.delete(m.id)
    sendProgress()
  })
  ipcMain.handle('thumb:clear', async () => {
    const root = await libraryRoot()
    if (root) await fs.rm(join(dataDir(root), 'thumbs'), { recursive: true, force: true })
  })

  ipcMain.handle('meta:get', async () => {
    const root = await libraryRoot()
    return root ? loadMeta(root) : {}
  })
  ipcMain.handle('meta:set', async (_e, rel: string, meta: ModelMeta) => {
    const root = await libraryRoot()
    if (!root) return
    const data = await loadMeta(root)
    if (meta.tags.length === 0 && !meta.notes && !meta.favorite) delete data[rel]
    else data[rel] = meta
    await saveMeta(root)
  })
  ipcMain.handle('projects:get', async () => {
    const root = await libraryRoot()
    if (!root) return []
    try {
      return JSON.parse(await fs.readFile(join(dataDir(root), 'projects.json'), 'utf8')).projects ?? []
    } catch {
      return []
    }
  })
  ipcMain.handle('projects:save', async (_e, projects: Project[]) => {
    const root = await libraryRoot()
    if (root) await writeData(root, 'projects.json', { version: 1, projects })
  })
  ipcMain.handle('data:open', async () => {
    const root = await libraryRoot()
    if (root) shell.openPath(await ensureDataDir(root))
  })
}

let mainWin: BrowserWindow | null = null
let thumbWorker: Promise<BrowserWindow> | null = null
let pendingThumbs = new Set<string>()
let totalThumbs = 0

const sendProgress = () =>
  mainWin?.webContents.send('thumbs:progress', { done: totalThumbs - pendingThumbs.size, total: totalThumbs })

const webPreferences = { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true }

function loadRenderer(win: BrowserWindow, hash?: string): void {
  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) win.loadURL(hash ? `${url}#${hash}` : url)
  else win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
}

/** Hidden window that renders thumbnails, so the UI never freezes. */
function getThumbWorker(): Promise<BrowserWindow> {
  thumbWorker ??= new Promise((resolve) => {
    const w = new BrowserWindow({ show: false, width: 512, height: 512, webPreferences: { ...webPreferences, backgroundThrottling: false } })
    ipcMain.once('thumbs:worker-ready', () => resolve(w))
    w.on('closed', () => { thumbWorker = null })
    loadRenderer(w, 'thumbs')
  })
  return thumbWorker
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c0d0f',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0c0d0f', symbolColor: '#8b929c', height: 38 },
    webPreferences
  })
  mainWin = win
  win.on('closed', () => {
    mainWin = null
    thumbWorker?.then((w) => w.destroy())
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  loadRenderer(win)
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())