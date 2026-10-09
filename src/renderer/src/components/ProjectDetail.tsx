import { useMemo, useState } from 'react'
import type { ModelFile, Project, ProjectPart, ProjectVersion } from '@shared/types'
import { newPart, useHub } from '../store'
import { fmtDate } from '../lib/format'
import ConfirmModal from './ConfirmModal'
import LazyThumb from './LazyThumb'
import ModelPicker from './ModelPicker'
import { IconCheck, IconEye, IconPlus, IconTrash } from './Icons'

const field = 'rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none transition-colors placeholder:text-faint hover:border-line focus:border-line-strong focus:bg-raised'

function VersionRow({ project, part, version, model }: { project: Project; part: ProjectPart; version: ProjectVersion; model: ModelFile | undefined }) {
  const { editProject, showInLibrary } = useHub()
  const isCurrent = part.current === version.rel

  const patchPart = (fn: (p: ProjectPart) => ProjectPart) =>
    editProject(project.id, (pr) => ({ ...pr, parts: pr.parts.map((x) => (x.id === part.id ? fn(x) : x)) }))
  const patchVersion = (patch: Partial<ProjectVersion>) =>
    patchPart((p) => ({ ...p, versions: p.versions.map((v) => (v.rel === version.rel ? { ...v, ...patch } : v)) }))
  const remove = () =>
    patchPart((p) => {
      const versions = p.versions.filter((v) => v.rel !== version.rel)
      return { ...p, versions, current: p.current === version.rel ? (versions[versions.length - 1]?.rel ?? null) : p.current }
    })

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-bg/40 p-2">
      <LazyThumb model={model} className="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <input
            value={version.label}
            onChange={(e) => patchVersion({ label: e.target.value })}
            aria-label="Wersja"
            className={`${field} w-24 text-[13px] font-semibold`}
          />
          <span className={`min-w-0 truncate text-xs ${model ? 'text-faint' : 'text-red-400'}`} title={version.rel}>
            {model ? model.name : 'brak pliku w bibliotece'}
          </span>
        </div>
        <input
          value={version.note}
          onChange={(e) => patchVersion({ note: e.target.value })}
          placeholder="Notatka do tej wersji"
          aria-label="Notatka"
          className={`${field} w-full text-xs text-muted`}
        />
      </div>
      <button
        onClick={() => patchPart((p) => ({ ...p, current: version.rel }))}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
          isCurrent ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:border-line-strong hover:text-text'
        }`}
      >
        {isCurrent && <IconCheck width={13} height={13} />}
        {isCurrent ? 'Aktualna' : 'Ustaw jako aktualną'}
      </button>
      <button onClick={() => showInLibrary(version.rel)} disabled={!model} aria-label="Pokaż w bibliotece" title="Pokaż w bibliotece" className="rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-text disabled:opacity-30">
        <IconEye width={16} height={16} />
      </button>
      <button onClick={remove} aria-label="Usuń wersję" title="Usuń z projektu" className="rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-red-400">
        <IconTrash width={16} height={16} />
      </button>
    </li>
  )
}

function PartCard({ project, part, autoFocus }: { project: Project; part: ProjectPart; autoFocus: boolean }) {
  const { editProject, models } = useHub()
  const [picking, setPicking] = useState(false)
  const byRel = useMemo(() => new Map(models.map((m) => [m.rel, m])), [models])
  const patchPart = (fn: (p: ProjectPart) => ProjectPart) =>
    editProject(project.id, (pr) => ({ ...pr, parts: pr.parts.map((x) => (x.id === part.id ? fn(x) : x)) }))

  const addVersion = (m: ModelFile) => {
    patchPart((p) => ({
      ...p,
      versions: [...p.versions, { rel: m.rel, label: `v${p.versions.length + 1}`, note: '' }],
      current: m.rel // a newly added version becomes the current one
    }))
    setPicking(false)
  }

  return (
    <section className="rounded-2xl border border-line bg-raised p-4">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={part.name}
          autoFocus={autoFocus}
          onFocus={(e) => autoFocus && e.currentTarget.select()}
          onChange={(e) => patchPart((p) => ({ ...p, name: e.target.value }))}
          aria-label="Nazwa części"
          placeholder="Nazwa części, np. Obudowa"
          className={`${field} min-w-0 flex-1 text-[15px] font-semibold`}
        />
        <button onClick={() => setPicking(true)} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-text">
          <IconPlus width={14} height={14} /> Dodaj wersję
        </button>
        <button
          onClick={() => editProject(project.id, (pr) => ({ ...pr, parts: pr.parts.filter((x) => x.id !== part.id) }))}
          aria-label="Usuń część"
          title="Usuń część"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-red-400"
        >
          <IconTrash width={16} height={16} />
        </button>
      </div>
      {part.versions.length === 0 ? (
        <button onClick={() => setPicking(true)} className="w-full rounded-xl border border-dashed border-line-strong py-5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-text">
          Dodaj pierwszy plik tej części z biblioteki
        </button>
      ) : (
        <ul className="space-y-2">
          {part.versions.map((v) => (
            <VersionRow key={v.rel} project={project} part={part} version={v} model={byRel.get(v.rel)} />
          ))}
        </ul>
      )}
      {picking && (
        <ModelPicker title={`Dodaj wersję: ${part.name || 'część'}`} exclude={new Set(part.versions.map((v) => v.rel))} onPick={addVersion} onClose={() => setPicking(false)} />
      )}
    </section>
  )
}

/** Strip showing the current version of every part, i.e. the set that goes together. */
function CurrentSet({ project }: { project: Project }) {
  const models = useHub((s) => s.models)
  const byRel = useMemo(() => new Map(models.map((m) => [m.rel, m])), [models])
  const items = project.parts.filter((p) => p.current)
  if (items.length === 0) return null

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Aktualny zestaw</h3>
      <div className="flex flex-wrap gap-3">
        {items.map((part) => {
          const v = part.versions.find((x) => x.rel === part.current)
          return (
            <div key={part.id} className="flex items-center gap-3 rounded-xl border border-line bg-raised p-2 pr-4">
              <LazyThumb model={byRel.get(part.current!)} className="h-14 w-14" />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{part.name || 'Bez nazwy'}</div>
                <div className="text-xs text-accent">{v?.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function ProjectDetail({ project }: { project: Project }) {
  const { editProject, deleteProject } = useHub()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newId, setNewId] = useState<string | null>(null)
  const isFresh = project.name === 'Nowy projekt' && project.created === project.updated
  const files = project.parts.reduce((n, p) => n + p.versions.length, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <input
            key={project.id}
            value={project.name}
            autoFocus={isFresh}
            onFocus={(e) => isFresh && e.currentTarget.select()}
            onChange={(e) => editProject(project.id, (p) => ({ ...p, name: e.target.value }))}
            aria-label="Nazwa projektu"
            className={`${field} min-w-0 flex-1 text-2xl font-semibold`}
          />
          <button onClick={() => setConfirmDelete(true)} aria-label="Usuń projekt" title="Usuń projekt" className="rounded-lg p-2 text-muted transition-colors hover:bg-raised hover:text-red-400">
            <IconTrash width={18} height={18} />
          </button>
          {confirmDelete && (
            <ConfirmModal title="Usunąć projekt?" onConfirm={() => deleteProject(project.id)} onClose={() => setConfirmDelete(false)}>
              Projekt <span className="font-medium text-text">{project.name || 'Bez nazwy'}</span> zostanie usunięty razem z podziałem na części i wersje. Same pliki zostają w bibliotece.
            </ConfirmModal>
          )}
        </div>
        <textarea
          value={project.description}
          onChange={(e) => editProject(project.id, (p) => ({ ...p, description: e.target.value }))}
          rows={2}
          placeholder="Opis projektu, np. do czego służy i jak się składa"
          aria-label="Opis projektu"
          className={`${field} w-full resize-none text-[13px] leading-relaxed text-muted`}
        />
        <div className="px-2 text-xs text-faint">
          {project.parts.length} {project.parts.length === 1 ? 'część' : 'części'} · {files} plików · utworzono {fmtDate(project.created)}
        </div>
      </header>

      <CurrentSet project={project} />

      <div className="space-y-3">
        {project.parts.map((part) => (
          <PartCard key={part.id} project={project} part={part} autoFocus={part.id === newId} />
        ))}
        <button
          onClick={() => {
            const part = newPart('')
            setNewId(part.id)
            editProject(project.id, (p) => ({ ...p, parts: [...p.parts, part] }))
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong py-4 text-sm text-muted transition-colors hover:border-accent/50 hover:text-text"
        >
          <IconPlus width={16} height={16} /> Dodaj część (np. obudowa, uchwyt)
        </button>
      </div>
    </div>
  )
}