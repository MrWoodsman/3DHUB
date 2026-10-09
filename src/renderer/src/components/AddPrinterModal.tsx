import { useState } from 'react'
import { PRINTER_MODELS, type PrinterInfo } from '@shared/printers'
import Modal from './Modal'
import PrinterIcon from './PrinterIcon'

const input = 'w-full rounded-lg border border-line bg-raised px-3 py-2 text-[13px] outline-none placeholder:text-faint focus:border-line-strong'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  )
}

export default function AddPrinterModal({ onClose, onAdded }: { onClose: () => void; onAdded: (p: PrinterInfo) => void }) {
  const [model, setModel] = useState('p1s')
  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [serial, setSerial] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = PRINTER_MODELS.find((m) => m.id === model)?.label ?? ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onAdded(await window.hub.addPrinter({ name: name || label, model, ip, serial, accessCode: code }))
    } catch (err) {
      setError(String(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Dodaj drukarkę Bambu Lab" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 px-6 py-5">
        <div>
          <span className="mb-2 block text-xs text-muted">Model</span>
          <div className="grid grid-cols-4 gap-2">
            {PRINTER_MODELS.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition-colors ${
                  model === m.id ? 'border-accent text-accent' : 'border-line text-muted hover:border-line-strong hover:text-text'
                }`}
              >
                <PrinterIcon model={m.id} size={34} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Nazwa (opcjonalnie)">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={label} className={input} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adres IP">
            <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.50" inputMode="decimal" className={input} required />
          </Field>
          <Field label="Numer seryjny">
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="01P00A000000000" className={input} required />
          </Field>
        </div>
        <Field label="Kod dostępu">
          <input value={code} onChange={(e) => setCode(e.target.value)} type="password" placeholder="8 znaków z ekranu drukarki" autoComplete="off" className={input} required />
        </Field>

        <p className="text-xs leading-relaxed text-faint">
          Adres IP i kod dostępu są w ustawieniach sieci drukarki, numer seryjny na naklejce lub w ustawieniach urządzenia. Komputer musi być w tej samej sieci.
          Kod jest zapisywany zaszyfrowany i nie trafia do folderu biblioteki.
        </p>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-text">Anuluj</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-dim disabled:opacity-60">
            {busy ? 'Dodawanie…' : 'Dodaj i połącz'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
