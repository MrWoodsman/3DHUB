/** A key cap. `subtle` is the quiet variant used inside buttons and the sidebar. */
export default function Kbd({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <kbd
      className={`inline-flex min-w-[1.4rem] items-center justify-center whitespace-nowrap rounded-md border px-1.5 py-0.5 font-sans text-[10px] font-semibold leading-none ${
        subtle ? 'border-line bg-transparent text-faint' : 'border-line-strong bg-bg text-muted'
      }`}
    >
      {children}
    </kbd>
  )
}

/** A combination such as Ctrl + K. */
export function Combo({ keys, subtle }: { keys: string[]; subtle?: boolean }) {
  if (subtle) return <Kbd subtle>{keys.join(' ')}</Kbd>
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => <Kbd key={i} subtle={subtle}>{k}</Kbd>)}
    </span>
  )
}
