import { useHub } from '../store'
import ProjectDetail from '../components/ProjectDetail'
import { IconLayers, IconPlus } from '../components/Icons'

export default function ProjectsView() {
  const { projects, activeProject, setActiveProject, createProject } = useHub()
  const active = projects.find((p) => p.id === activeProject)

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-line">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <h2 className="text-[13px] font-semibold">Projekty</h2>
          <button onClick={createProject} className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-accent-dim">
            <IconPlus width={13} height={13} strokeWidth={2.4} /> Nowy
          </button>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {projects.map((p) => {
            const files = p.parts.reduce((n, x) => n + x.versions.length, 0)
            return (
              <li key={p.id}>
                <button
                  onClick={() => setActiveProject(p.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${p.id === activeProject ? 'bg-raised' : 'hover:bg-raised/60'}`}
                >
                  <div className="truncate text-[13px] font-medium">{p.name || 'Bez nazwy'}</div>
                  <div className="text-xs text-faint">{p.parts.length} części · {files} plików</div>
                </button>
              </li>
            )
          })}
          {projects.length === 0 && <li className="px-3 py-6 text-center text-xs text-faint">Brak projektów</li>}
        </ul>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        {active ? (
          <ProjectDetail key={active.id} project={active} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-raised text-accent">
              <IconLayers width={26} height={26} />
            </span>
            <div className="text-base font-semibold">Zbierz modele w projekty</div>
            <p className="max-w-sm text-sm text-muted">
              Projekt składa się z części, np. obudowy i uchwytu. Każda część ma wersje, a jedna z nich jest aktualna.
            </p>
            <button onClick={createProject} className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim">
              Utwórz projekt
            </button>
          </div>
        )}
      </section>
    </div>
  )
}