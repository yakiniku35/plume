/** The Plume feather. Same geometry as build/icon.svg. */
export function Feather({ size = 28, className }: { size?: number; className?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M78 12 C 62 26, 44 50, 30 72" />
      <path d="M78 12 C 50 12, 30 36, 33 62" />
      <path d="M78 12 C 90 38, 72 64, 36 66" />
      <path d="M58 34 L 70 27" />
      <path d="M50 45 L 64 39" />
      <path d="M43 55 L 56 50" />
      <path d="M30 72 L 24 84" />
      <path d="M26.5 77.5 L 33 80" />
      <path d="M20 90 C 34 86, 48 88, 62 90" strokeWidth={2.4} opacity={0.55} />
    </svg>
  )
}

export function Wordmark({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#f4f0e8] text-[#111]">
        <Feather size={size} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">Plume</span>
    </div>
  )
}
