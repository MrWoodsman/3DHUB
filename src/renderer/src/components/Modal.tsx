import { useEffect } from 'react'
import { IconClose } from './Icons'

export default function Modal({ title, onClose, children, wide, small }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; small?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`animate-pop flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel ${wide ? 'max-w-3xl' : small ? 'max-w-md' : 'max-w-xl'}`}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Zamknij" className="rounded-lg p-1.5 text-muted transition hover:bg-hover hover:text-text">
            <IconClose width={16} height={16} />
          </button>
        </header>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}