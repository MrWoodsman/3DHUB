import { useEffect, useMemo, useRef, useState } from "react";
import type { Vector3 } from "three";
import type { ModelFile, ThreeMFInfo } from "@shared/types";
import { modelFromName } from "@shared/printers";
import ConfirmModal from "./ConfirmModal";
import { Combo } from "./Kbd";
import Kbd from "./Kbd";
import ModelViewer from "./ModelViewer";
import PrinterIcon from "./PrinterIcon";
import { IconClose, IconLayers, IconPencil, IconStar, IconTrash } from "./Icons";
import { fmtDate, fmtSize } from "../lib/format";
import { useHub } from "../store";

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-raised px-3 py-2.5">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-medium tabular-nums">
        {children}
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
      {children}
    </h3>
  );
}

function TagEditor({ model }: { model: ModelFile }) {
  const meta = useHub((s) => s.meta);
  const updateMeta = useHub((s) => s.updateMeta);
  const [draft, setDraft] = useState("");
  const tags = meta[model.rel]?.tags ?? [];
  const all = useMemo(
    () =>
      [...new Set(Object.values(meta).flatMap((m) => m.tags))].filter(
        (t) => !tags.includes(t),
      ),
    [meta, tags],
  );

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) updateMeta(model.rel, { tags: [...tags, t] });
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-raised p-2 focus-within:border-line-strong">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-md bg-hover py-0.5 pl-2 pr-1 text-xs"
        >
          {t}
          <button
            aria-label={`Usuń tag ${t}`}
            onClick={() =>
              updateMeta(model.rel, { tags: tags.filter((x) => x !== t) })
            }
            className="rounded p-0.5 text-faint hover:text-text"
          >
            <IconClose width={11} height={11} />
          </button>
        </span>
      ))}
      <input
        list="all-tags"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && tags.length)
            updateMeta(model.rel, { tags: tags.slice(0, -1) });
        }}
        onBlur={() => add(draft)}
        placeholder={tags.length ? "" : "Dodaj tag i wciśnij Enter"}
        className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-faint"
      />
      <datalist id="all-tags">
        {all.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

function Notes({ model }: { model: ModelFile }) {
  const saved = useHub((s) => s.meta[model.rel]?.notes ?? "");
  const updateMeta = useHub((s) => s.updateMeta);
  const [text, setText] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <textarea
      value={text}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(
          () => updateMeta(model.rel, { notes: v }),
          400,
        );
      }}
      onBlur={() => {
        clearTimeout(timer.current);
        if (text !== saved) updateMeta(model.rel, { notes: text });
      }}
      rows={4}
      placeholder="Ustawienia druku, wersje, uwagi…"
      className="w-full resize-y rounded-xl border border-line bg-raised p-3 text-[13px] leading-relaxed outline-none placeholder:text-faint focus:border-line-strong"
    />
  );
}

const fmtDuration = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

/** Reads plates / printer / slice data from a Bambu Studio .3mf (null for other formats). */
function useThreeMFInfo(model: ModelFile): ThreeMFInfo | null {
  const [info, setInfo] = useState<ThreeMFInfo | null>(null);
  useEffect(() => {
    setInfo(null);
    if (model.format !== "3mf") return;
    let alive = true;
    window.hub.getModelInfo(model.path).then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, [model]);
  return info;
}

function Plates({ info }: { info: ThreeMFInfo }) {
  const printer = modelFromName(info.printer);
  if (!info.printer && info.plates.length === 0) return null;

  return (
    <section className="space-y-3">
      <Heading>
        Plate{info.plates.length > 1 ? ` (${info.plates.length})` : ""}
      </Heading>
      {info.printer && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2.5">
          <span className="text-muted">
            <PrinterIcon model={printer?.id ?? ""} size={30} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">
              {info.printer}
            </div>
            <div className="text-xs text-faint">
              drukarka z projektu
              {info.nozzle ? ` · dysza ${info.nozzle} mm` : ""}
            </div>
          </div>
        </div>
      )}
      <ul className="space-y-2">
        {info.plates.map((p) => (
          <li
            key={p.id}
            className="flex gap-3 rounded-xl border border-line bg-raised p-2"
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#15181c]">
              {p.thumbnail ? (
                <img
                  src={p.thumbnail}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-faint">{p.id}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="truncate text-[13px] font-medium">
                Plate {p.id}
                {p.name ? ` · ${p.name}` : ""}
              </div>
              <div
                className="mt-0.5 truncate text-xs text-faint"
                title={p.objects.join(", ")}
              >
                {p.objects.length ? p.objects.join(", ") : "brak obiektów"}
              </div>
              {(p.printTimeSec || p.weightG) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
                  {p.printTimeSec ? (
                    <span>{fmtDuration(p.printTimeSec)}</span>
                  ) : null}
                  {p.weightG ? <span>{p.weightG.toFixed(1)} g</span> : null}
                  {p.filaments?.map((f, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-line-strong"
                        style={{ background: f.color || "#888" }}
                      />
                      {f.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InProjects({ model }: { model: ModelFile }) {
  const projects = useHub((s) => s.projects);
  const { setView, setActiveProject } = useHub.getState();
  const used = projects.filter((p) =>
    p.parts.some((part) => part.versions.some((v) => v.rel === model.rel)),
  );
  if (used.length === 0) return null;
  return (
    <section>
      <Heading>W projektach</Heading>
      <div className="flex flex-wrap gap-1.5">
        {used.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setActiveProject(p.id);
              setView("projects");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs transition-colors hover:border-line-strong"
          >
            <IconLayers width={13} height={13} className="text-accent" />{" "}
            {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function DetailsPanel({
  model,
  onClose,
}: {
  model: ModelFile;
  onClose: () => void;
}) {
  const [dims, setDims] = useState<Vector3 | null>(null);
  const info = useThreeMFInfo(model);
  const sliced = info?.plates.filter((p) => p.printTimeSec) ?? [];
  const totalSec = sliced.reduce((n, p) => n + (p.printTimeSec ?? 0), 0);
  const totalG = sliced.reduce((n, p) => n + (p.weightG ?? 0), 0);
  const favorite = useHub((s) => s.meta[model.rel]?.favorite ?? false);
  const { renameItem, trashItem } = useHub.getState();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // F2 and Delete are handled in the library and arrive as events
  useEffect(() => {
    const rename = () => { setDraft(model.name); setEditing(true); };
    const del = () => setConfirmDelete(true);
    window.addEventListener("hub:rename", rename);
    window.addEventListener("hub:delete", del);
    return () => { window.removeEventListener("hub:rename", rename); window.removeEventListener("hub:delete", del); };
  }, [model.name]);
  const updateMeta = useHub((s) => s.updateMeta);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="relative aspect-square w-full shrink-0 bg-bg">
        <ModelViewer key={model.id} model={model} onDimensions={setDims} />
        <button
          onClick={onClose}
          aria-label="Zamknij panel"
          className="absolute right-3 top-3 rounded-lg bg-bg/70 p-1.5 text-muted backdrop-blur transition hover:text-text"
        >
          <IconClose width={15} height={15} />
        </button>
        <span className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-bg/60 px-2 py-1 text-[10px] text-faint backdrop-blur">
          obracaj · przybliżaj kółkiem
        </span>
      </div>

      <div className="space-y-6 p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                autoFocus
                value={draft}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter") {
                    if (!draft.trim() || draft.trim() === model.name) return setEditing(false);
                    if (await renameItem(model.rel, draft, false)) setEditing(false);
                  }
                }}
                onBlur={() => setEditing(false)}
                aria-label="Nowa nazwa pliku"
                className="w-full rounded-lg border border-accent bg-bg px-2 py-1 text-lg font-semibold outline-none"
              />
            ) : (
              <h2
                className="break-words text-lg font-semibold leading-snug"
                title="Dwuklik: zmień nazwę"
                onDoubleClick={() => { setDraft(model.name); setEditing(true); }}
              >
                {model.name}
              </h2>
            )}
            <p className="mt-1 break-all text-xs text-faint">{model.rel}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => { setDraft(model.name); setEditing(true); }}
              aria-label="Zmień nazwę pliku"
              title="Zmień nazwę (F2)"
              className="rounded-lg border border-line p-2 text-muted transition hover:bg-hover hover:text-text"
            >
              <IconPencil width={17} height={17} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Usuń plik"
              title="Usuń do Kosza (Delete)"
              className="rounded-lg border border-line p-2 text-muted transition hover:bg-hover hover:text-bad"
            >
              <IconTrash width={17} height={17} />
            </button>
            <button
              onClick={() => updateMeta(model.rel, { favorite: !favorite })}
              aria-label={favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
              title="Ulubione (F)"
              className={`rounded-lg border border-line p-2 transition hover:bg-hover ${favorite ? "text-accent" : "text-muted"}`}
            >
              <IconStar width={17} height={17} filled={favorite} />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <ConfirmModal
            title="Usunąć plik?"
            confirmLabel="Przenieś do Kosza"
            onConfirm={() => trashItem(model.rel, false, model.name)}
            onClose={() => setConfirmDelete(false)}
          >
            Plik <span className="font-medium text-text">{model.name}</span> trafi do Kosza i możesz go stamtąd przywrócić. Tagi i notatki zostaną usunięte.
          </ConfirmModal>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => window.hub.openItem(model.rel)}
            title="Otwórz w programie powiązanym z tym typem pliku (3MF zwykle w slicerze)"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-text"
          >
            Otwórz w programie <Kbd subtle>Enter</Kbd>
          </button>
          <button
            onClick={() => window.hub.revealItem(model.rel)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-text"
          >
            Pokaż w folderze <Combo keys={["Shift", "Enter"]} subtle />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Format">{model.format.toUpperCase()}</Stat>
          <Stat label="Rozmiar pliku">{fmtSize(model.size)}</Stat>
          <Stat label="Wymiary">
            {dims
              ? `${dims.x.toFixed(0)} × ${dims.z.toFixed(0)} × ${dims.y.toFixed(0)} mm`
              : "…"}
          </Stat>
          <Stat label="Zmodyfikowano">{fmtDate(model.modified)}</Stat>
          <Stat
            label={sliced.length > 1 ? "Czas druku (łącznie)" : "Czas druku"}
          >
            {totalSec ? (
              fmtDuration(totalSec)
            ) : (
              <span className="font-normal text-faint">brak danych</span>
            )}
          </Stat>
          <Stat label={sliced.length > 1 ? "Filament (łącznie)" : "Filament"}>
            {totalG ? (
              `${totalG.toFixed(1)} g`
            ) : (
              <span className="font-normal text-faint">brak danych</span>
            )}
          </Stat>
        </div>

        {info && <Plates info={info} />}

        <InProjects model={model} />

        <section>
          <Heading>Tagi</Heading>
          <TagEditor model={model} />
        </section>

        <section>
          <Heading>Notatki</Heading>
          <Notes key={model.id} model={model} />
        </section>
      </div>
    </div>
  );
}
