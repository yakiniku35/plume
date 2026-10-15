import { useState } from 'react'
import { cx } from '@/components/ui'

/* Monochrome, hand-rolled SVG charts. Greys from --ink-*, one accent for "now". */

const inks = ['var(--ink-0)', 'var(--ink-1)', 'var(--ink-2)', 'var(--ink-3)', 'var(--ink-4)']

export function DayGrid({ cells, labelFor }: { cells: { date: string; words: number; entries: number; mood?: number }[]; labelFor: (c: { date: string; words: number; mood?: number }) => string }): JSX.Element {
  const max = Math.max(1, ...cells.map((c) => c.words))
  const size = 22
  const gap = 5
  const rows = 6
  const cols = Math.ceil(cells.length / rows)
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="relative">
      <svg width={cols * (size + gap)} height={rows * (size + gap)} role="img">
        {cells.map((c, i) => {
          const level = c.entries === 0 ? 0 : Math.min(4, 1 + Math.floor((c.words / max) * 3.999))
          const x = Math.floor(i / rows) * (size + gap)
          const y = (i % rows) * (size + gap)
          return (
            <rect key={c.date} x={x} y={y} width={size} height={size} rx={6} fill={inks[level]} stroke={i === cells.length - 1 ? 'var(--accent)' : 'none'} strokeWidth={2} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <title>{labelFor(c)}</title>
            </rect>
          )
        })}
      </svg>
      {hover !== null && <div className="pointer-events-none absolute -top-9 left-0 rounded-md bg-fg px-2 py-1 text-[11px] text-bg">{labelFor(cells[hover])}</div>}
    </div>
  )
}

export function Bars({ values, labels, height = 120, highlightLast = true }: { values: number[]; labels?: string[]; height?: number; highlightLast?: boolean }): JSX.Element {
  const max = Math.max(1, ...values)
  const w = 100 / values.length
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img">
        {values.map((v, i) => {
          const h = (v / max) * (height - 4)
          return <rect key={i} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={h} rx={1.2} fill={highlightLast && i === values.length - 1 ? 'var(--fg)' : 'var(--ink-1)'} />
        })}
      </svg>
      {labels && (
        <div className="mt-2 flex justify-between text-[11px] text-fg-3">
          {labels.map((l, i) => (
            <span key={i} className={cx(i !== 0 && i !== labels.length - 1 && 'opacity-0')}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Line({ points, min = 1, max = 5, height = 120 }: { points: { x: number; y: number; label: string }[]; min?: number; max?: number; height?: number }): JSX.Element {
  if (points.length === 0) return <div className="text-[13px] text-fg-3">—</div>
  const xs = points.map((p) => p.x)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const sx = (x: number): number => (x1 === x0 ? 50 : ((x - x0) / (x1 - x0)) * 96 + 2)
  const sy = (y: number): number => height - 6 - ((y - min) / (max - min)) * (height - 12)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`).join(' ')
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img">
      {[1, 2, 3, 4, 5].map((m) => (
        <line key={m} x1={0} x2={100} y1={sy(m)} y2={sy(m)} stroke="var(--line)" strokeWidth={0.4} />
      ))}
      <path d={d} fill="none" stroke="var(--fg)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={1.6} fill="var(--bg)" stroke="var(--fg)" strokeWidth={0.9} vectorEffect="non-scaling-stroke">
          <title>{p.label}</title>
        </circle>
      ))}
    </svg>
  )
}

export function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }): JSX.Element {
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{label}</div>
      <div className={cx('mt-1.5 text-[30px] font-semibold leading-none tracking-tight tabular-nums', accent && 'text-accent')}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-fg-3">{sub}</div>}
    </div>
  )
}
