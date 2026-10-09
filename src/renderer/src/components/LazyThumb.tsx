import { useEffect, useRef, useState } from 'react'
import type { ModelFile } from '@shared/types'
import { useThumbnail } from '../lib/useThumbnail'
import { IconCube } from './Icons'

/** Thumbnail that loads only once it scrolls into view. Size comes from className. */
export default function LazyThumb({ model, className = '' }: { model: ModelFile | undefined; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const url = useThumbnail(model, visible)

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisible(true), io.disconnect()), { rootMargin: '200px' })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#15181c] ${className}`}>
      {url ? <img src={url} alt="" draggable={false} className="h-full w-full object-contain p-1" /> : <IconCube width="45%" height="45%" strokeWidth={1.2} className="text-line-strong" />}
    </div>
  )
}