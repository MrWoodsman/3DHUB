import { IconCube } from './Icons'

export default function TitleBar() {
  return (
    <header className="flex h-[38px] shrink-0 select-none items-center gap-2 bg-bg pl-3.5" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent text-bg">
        <IconCube width={13} height={13} strokeWidth={2.4} />
      </span>
      <span className="text-[13px] font-semibold tracking-tight">3D HUB</span>
    </header>
  )
}