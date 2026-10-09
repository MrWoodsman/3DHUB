import { modelFromName, PRINTER_MODELS, type PrinterFamily } from '@shared/printers'

/** Simple line drawings of the three Bambu Lab body styles. */
function Drawing({ family }: { family: PrinterFamily }) {
  if (family === 'enclosed')
    return (
      <>
        <rect x="8" y="6" width="32" height="36" rx="3" />
        <rect x="12" y="10" width="24" height="26" rx="1.5" opacity=".5" />
        <path d="M12 17h24M14 31h20" />
        <rect x="21" y="17" width="6" height="5" rx="1" />
        <path d="M15 39h2M31 39h2" />
      </>
    )
  if (family === 'open')
    return (
      <>
        <path d="M10 8v32M38 8v32M10 8h28M10 17h28M8 40h32" />
        <rect x="21" y="17" width="6" height="5" rx="1" />
        <path d="M14 32h20" />
      </>
    )
  return (
    <>
      <rect x="8" y="35" width="32" height="7" rx="2" />
      <path d="M14 31h20M12 8v27" />
      <path d="M12 14h22" />
      <rect x="29" y="14" width="6" height="5" rx="1" />
    </>
  )
}

export default function PrinterIcon({ model, size = 40 }: { model: string; size?: number }) {
  const m = PRINTER_MODELS.find((x) => x.id === model) ?? modelFromName(model)
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Drawing family={m?.family ?? 'enclosed'} />
    </svg>
  )
}
