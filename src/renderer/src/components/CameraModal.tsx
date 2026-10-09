import { useEffect, useState } from 'react'
import Modal from './Modal'

/** Live camera view; the stream runs only while this modal is open. */
export default function CameraModal({ printerId, name, onClose }: { printerId: string; name: string; onClose: () => void }) {
  const [frame, setFrame] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const offFrame = window.hub.onPrinterFrame((v) => v.id === printerId && (setFrame(v.frame), setError(null)))
    const offErr = window.hub.onPrinterCameraError((v) => v.id === printerId && setError(v.error))
    window.hub.startPrinterCamera(printerId).catch((e) => setError(String(e.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')))
    return () => {
      offFrame()
      offErr()
      window.hub.stopPrinterCamera(printerId)
    }
  }, [printerId])

  return (
    <Modal title={`Kamera: ${name}`} onClose={onClose} wide>
      <div className="relative flex aspect-video items-center justify-center bg-black">
        {frame && <img src={frame} alt="Obraz z kamery drukarki" className="h-full w-full object-contain" />}
        {!frame && !error && (
          <div className="flex flex-col items-center gap-3">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            <span className="text-xs text-muted">Łączenie z kamerą…</span>
          </div>
        )}
        {error && <p className="max-w-sm px-6 text-center text-sm text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
