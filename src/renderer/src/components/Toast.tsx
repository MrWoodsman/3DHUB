import { useHub } from '../store'

/** Short confirmation or error message at the bottom center. */
export default function Toast() {
  const toast = useHub((s) => s.toast)
  if (!toast) return null
  return (
    <div
      key={toast.id}
      role="status"
      className={`animate-pop pointer-events-none fixed bottom-5 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-xl border bg-raised px-4 py-2.5 text-[13px] ${
        toast.tone === 'bad' ? 'border-bad/50 text-bad' : 'border-line-strong text-text'
      }`}
    >
      {toast.text}
    </div>
  )
}
