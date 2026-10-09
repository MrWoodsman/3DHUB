import { useRef, useState } from 'react'

const KEY = 'detailsWidth'
const load = (): number => {
  try { return Number(localStorage.getItem(KEY)) || 400 } catch { return 400 }
}

/** Right-hand panel with a draggable left edge. */
export default function ResizablePanel({ children, min = 320, max = 640 }: { children: React.ReactNode; min?: number; max?: number }) {
  const [width, setWidth] = useState(() => Math.min(max, Math.max(min, load())))
  const [dragging, setDragging] = useState(false)
  const widthRef = useRef(width)
  widthRef.current = width

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging) setWidth(Math.min(max, Math.max(min, window.innerWidth - e.clientX)))
  }
  const onPointerUp = () => {
    setDragging(false)
    try { localStorage.setItem(KEY, String(widthRef.current)) } catch { /* ignore */ }
  }

  return (
    <aside style={{ width }} className="relative shrink-0 border-l border-line bg-panel">
      <div
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDragging(true) }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => setWidth(400)}
        className="group absolute -left-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize justify-center"
      >
        <div className={`h-full w-0.5 transition-colors ${dragging ? 'bg-accent' : 'group-hover:bg-accent/60'}`} />
      </div>
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
      {children}
    </aside>
  )
}