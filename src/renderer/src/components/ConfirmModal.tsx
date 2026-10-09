import Modal from './Modal'

/** Confirmation for destructive actions. Esc or the backdrop cancels. */
export default function ConfirmModal({ title, children, confirmLabel = 'Usuń', onConfirm, onClose }: {
  title: string
  children: React.ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose} small>
      <div className="px-6 py-5 text-[13px] leading-relaxed text-muted">{children}</div>
      <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
        <button onClick={onClose} autoFocus className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-text">
          Anuluj
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className="rounded-lg bg-bad/90 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bad"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
