import { useEffect } from 'react'
import { useHub } from './store'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import SettingsModal from './components/SettingsModal'
import LibraryView from './views/LibraryView'
import ProjectsView from './views/ProjectsView'
import ThumbSourceDialog from './components/ThumbSourceDialog'
import ThumbProgress from './components/ThumbProgress'
import Toast from './components/Toast'
import ShortcutsModal from './components/ShortcutsModal'
import PrintersView from './views/PrintersView'

export default function App() {
  const view = useHub((s) => s.view)
  const settingsOpen = useHub((s) => s.settingsOpen)
  const init = useHub((s) => s.init)
  const askThumbSource = useHub((s) => s.thumbSource === null && s.models.some((m) => m.format === '3mf'))
  const shortcutsOpen = useHub((s) => s.shortcutsOpen)
  useEffect(() => { init() }, [init])

  // Global shortcuts (see lib/shortcuts.ts for the list shown to the user). Library-specific ones live in LibraryView.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable
      const ctrl = e.ctrlKey || e.metaKey
      const { setView, setSettingsOpen, setShortcutsOpen, shortcutsOpen: open } = useHub.getState()

      if (e.key === 'F1' || (e.key === '?' && !typing && !ctrl)) {
        e.preventDefault()
        return setShortcutsOpen(!open)
      }
      if (document.querySelector('[role=dialog]')) return // a modal is open: only Esc (handled by the modal) and the list above
      const views = { '1': 'library', '2': 'projects', '3': 'printers' } as const
      if (ctrl && e.key in views) {
        e.preventDefault()
        return setView(views[e.key as keyof typeof views])
      }
      if (ctrl && e.key === ',') {
        e.preventDefault()
        return setSettingsOpen(true)
      }
      if (ctrl && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault()
        if (useHub.getState().view === 'projects') useHub.getState().createProject()
        else window.dispatchEvent(new Event('hub:new-folder')) // LibraryView listens
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1 pb-2 pr-2">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-panel">
          {view === 'library' ? <LibraryView /> : view === 'projects' ? <ProjectsView /> : <PrintersView />}
        </main>
      </div>
      {settingsOpen && <SettingsModal />}
      {shortcutsOpen && <ShortcutsModal />}
      {askThumbSource && <ThumbSourceDialog />}
      <ThumbProgress />
      <Toast />
    </div>
  )
}