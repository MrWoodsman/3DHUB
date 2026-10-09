export const fmtSize = (b: number): string => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB')
export const fmtDate = (ms: number): string => new Date(ms).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })
export const fmtDuration = (sec: number): string => {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min`
}

/** Compact form for tight spots, e.g. "27h 53m". */
export const fmtDurationShort = (sec: number): string => {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}
