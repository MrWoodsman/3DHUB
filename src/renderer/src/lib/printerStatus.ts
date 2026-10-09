import type { PrinterStatus } from '@shared/printers'

export type Tone = 'ok' | 'bad' | 'warn' | 'accent' | 'idle'

export const toneClass: Record<Tone, string> = {
  ok: 'border-ok/40 bg-ok/10 text-ok',
  bad: 'border-bad/40 bg-bad/10 text-bad',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  accent: 'border-accent/40 bg-accent/10 text-accent',
  idle: 'border-line text-muted'
}

export function describe(s: PrinterStatus | undefined): { label: string; tone: Tone } {
  if (!s || s.conn === 'connecting') return { label: 'Łączenie…', tone: 'idle' }
  if (s.conn === 'error') return { label: 'Błąd połączenia', tone: 'bad' }
  if (s.conn === 'offline') return { label: 'Offline', tone: 'idle' }
  switch (s.state) {
    case 'RUNNING': return { label: 'Drukuje', tone: 'accent' }
    case 'PREPARE': return { label: 'Przygotowanie', tone: 'accent' }
    case 'PAUSE': return { label: 'Wstrzymana', tone: 'warn' }
    case 'FINISH': return { label: 'Zakończono', tone: 'ok' }
    case 'FAILED': return { label: 'Błąd druku', tone: 'bad' }
    case 'IDLE': return { label: 'Bezczynna', tone: 'idle' }
    default: return { label: s.state ?? 'Połączono', tone: 'idle' }
  }
}

export const fmtRemaining = (min: number): string => {
  const h = Math.floor(min / 60)
  return h ? `${h} h ${min % 60} min` : `${min} min`
}
export const fmtEta = (min: number): string =>
  new Date(Date.now() + min * 60_000).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
export const temp = (v: number | undefined, target?: number): string =>
  v === undefined ? '-' : `${Math.round(v)}°${target ? ` / ${Math.round(target)}°` : ''}`


/** Solid color of the status dot, by tone. */
export const toneDot: Record<Tone, string> = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', accent: 'bg-accent', idle: 'bg-faint' }
