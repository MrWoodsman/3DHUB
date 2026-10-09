import { useEffect, useState } from 'react'
import type { ThumbProgress as Progress } from '@shared/types'

/** Small toast in the bottom-right corner while thumbnails are generated in the background. */
export default function ThumbProgress() {
  const [p, setP] = useState<Progress | null>(null)

  useEffect(() => window.hub.onThumbProgress(setP), [])

  const finished = p !== null && p.done >= p.total
  useEffect(() => {
    if (!finished) return
    const t = setTimeout(() => setP(null), 2000)
    return () => clearTimeout(t)
  }, [finished])

  if (!p || p.total === 0) return null
  const pct = Math.round((p.done / p.total) * 100)

  return (
    <div className="animate-pop pointer-events-none fixed bottom-4 right-4 z-40 w-64 rounded-xl border border-line-strong bg-raised px-4 py-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{finished ? 'Miniatury gotowe' : 'Generowanie miniatur'}</span>
        <span className="tabular-nums text-muted">{p.done} / {p.total}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}