import { useState, type MouseEvent } from 'react'
import { cx } from '@/components/ui'

/* Monochrome, hand-rolled SVG charts. Greys from --ink-*, one accent for "now". Every mark shows its value on hover. */

const inks = ['var(--ink-0)', 'var(--ink-1)', 'var(--ink-2)', 'var(--ink-3)', 'var(--ink-4)']

function Tip({ x, y, children }: { x: number; y: number; children: string }): JSX.Element {
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[11px] text-bg shadow-sm" style={{ left: x, top: y - 8 }}>
      {children}
    </div>
  )
}

export function DayGrid({ cells, labelFor }: { cells: { date: string; words: number; entries: number; mood?: number }[]; labelFor: (c: { date: string; words: number; mood?: number }) => string }): JSX.Element {
  const max = Math.max(1, ...cells.map((c) => c.words))
  const size = 22
  const gap = 5
  const rows = 6
  const cols = Math.ceil(cells.length / rows)
  const [hover, setHover] = useState<number | null>(null)
  const pos = (i: number): [number, number] => [Math.floor(i / rows) * (size + gap), (i % rows) * (size + gap)]
  return (
    <div className="relative">
      <svg width={cols * (size + gap)} height={rows * (size + gap)} role="img">
        {cells.map((c, i) => {
          const level = c.entries === 0 ? 0 : Math.min(4, 1 + Math.floor((c.words / max) * 3.999))
          const [x, y] = pos(i)
          return <rect key={c.date} x={x} y={y} width={size} height={size} rx={6} fill={inks[level]} stroke={i === cells.length - 1 ? 'var(--accent)' : hover === i ? 'var(--fg)' : 'none'} strokeWidth={2} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        })}
      </svg>
      {hover !== null && <Tip x={pos(hover)[0] + size / 2} y={pos(hover)[1]}>{labelFor(cells[hover])}</Tip>}
    </div>
  )
}

export function Bars({ values, labels, tooltip, height = 120, highlightLast = true }: { values: number[]; labels?: string[]; tooltip: (i: number) => string; height?: number; highlightLast?: boolean }): JSX.Element {
  const max = Math.max(1, ...values)
  const w = 100 / values.length
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null)
  const onMove = (e: MouseEvent<SVGSVGElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.min(values.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * values.length)))
    setHover({ i, x: ((i + 0.5) / values.length) * r.width })
  }
  return (
    <div className="relative">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => {
          const h = Math.max(v > 0 ? 1.5 : 0, (v / max) * (height - 4))
          const active = hover?.i === i
          return <rect key={i} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={h} rx={1.2} fill={active ? 'var(--accent)' : highlightLast && i === values.length - 1 ? 'var(--fg)' : 'var(--ink-1)'} />
        })}
      </svg>
      {hover && <Tip x={hover.x} y={height - (values[hover.i] / max) * (height - 4)}>{tooltip(hover.i)}</Tip>}
      {labels && (
        <div className="mt-2 flex justify-between text-[11px] text-fg-3">
          {labels.map((l, i) => (
            <span key={i} className={cx('whitespace-nowrap', i !== 0 && i !== labels.length - 1 && 'opacity-0')}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Line({ points, min = 1, max = 5, height = 120 }: { points: { x: number; y: number; label: string }[]; min?: number; max?: number; height?: number }): JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return <div className="text-[13px] text-fg-3">—</div>
  const xs = points.map((p) => p.x)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  // Percent coordinates so dots and tooltips can be plain HTML (round, not stretched by the SVG scaling).
  const px = (x: number): number => (x1 === x0 ? 50 : ((x - x0) / (x1 - x0)) * 96 + 2)
  const py = (y: number): number => 100 - 5 - ((y - min) / (max - min)) * 90
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`).join(' ')
  const onMove = (e: MouseEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - r.left) / r.width) * 100
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(px(points[i].x) - mx) < Math.abs(px(points[best].x) - mx)) best = i
    setHover(best)
  }
  return (
    <div className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" role="img">
        {[1, 2, 3, 4, 5].map((m) => (
          <line key={m} x1={0} x2={100} y1={py(m)} y2={py(m)} stroke="var(--line)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={d} fill="none" stroke="var(--fg)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {points.map((p, i) => (
        <span
          key={i}
          className={cx('absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] transition-transform', hover === i ? 'size-3 border-accent bg-accent' : 'size-2 border-fg bg-bg')}
          style={{ left: `${px(p.x)}%`, top: `${py(p.y)}%` }}
        />
      ))}
      {hover !== null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[11px] text-bg shadow-sm" style={{ left: `${px(points[hover].x)}%`, top: `calc(${py(points[hover].y)}% - 10px)` }}>
          {points[hover].label}
        </div>
      )}
    </div>
  )
}

export function Stat({ label, value, sub, accent, hint }: { label: string; value: string | number; sub?: string; accent?: boolean; hint?: string }): JSX.Element {
  const [show, setShow] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{label}</div>
      <div className={cx('mt-1.5 text-[30px] font-semibold leading-none tracking-tight tabular-nums', accent && 'text-accent')}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-fg-3">{sub}</div>}
      {hint && show && <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-[220px] rounded-lg bg-fg px-3 py-2 text-[12px] leading-relaxed text-bg shadow-sm">{hint}</div>}
    </div>
  )
}
