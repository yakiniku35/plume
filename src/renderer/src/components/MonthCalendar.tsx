import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DayMark, Entry } from '@shared/types'
import { useI18n } from '@/lib/i18n'
import { fmtMonth, todayKey } from '@/lib/dates'
import { keyOf, parseKey } from '@/lib/insights'
import { marksForDay } from '@/lib/marks'
import { IconButton, cx } from '@/components/ui'

export function MonthCalendar({ month, byDay, marks, selected, onSelect, onMonth, compact }: { month: string; byDay: Map<string, Entry[]>; marks: DayMark[]; selected: string | null; onSelect: (d: string) => void; onMonth: (m: string) => void; compact?: boolean }): JSX.Element {
  const { t, locale, dict } = useI18n()
  const today = todayKey()
  const cells = useMemo(() => {
    const first = parseKey(month + '-01')
    const offset = (first.getDay() + 6) % 7 // Monday first
    const start = new Date(first)
    start.setDate(1 - offset)
    const out: { key: string; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      out.push({ key: keyOf(d), inMonth: d.getMonth() === first.getMonth() })
    }
    while (out.length > 35 && out.slice(35).every((c) => !c.inMonth)) out.splice(35)
    return out
  }, [month])

  const shift = (n: number): void => {
    const d = parseKey(month + '-01')
    d.setMonth(d.getMonth() + n)
    onMonth(keyOf(d).slice(0, 7))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className={cx('font-semibold tracking-tight', compact ? 'text-[15px]' : 'text-[22px]')}>{fmtMonth(month, locale)}</h2>
        <div className="flex items-center gap-1">
          <IconButton label={t('prevMonth')} onClick={() => shift(-1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <button onClick={() => onMonth(today.slice(0, 7))} className="h-8 rounded-lg px-2.5 text-[12px] font-medium text-fg-2 hover:bg-elev hover:text-fg">
            {t('today')}
          </button>
          <IconButton label={t('nextMonth')} onClick={() => shift(1)}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dict.weekdays.map((w) => (
          <div key={w} className="pb-2 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">
            {w}
          </div>
        ))}
        {cells.map(({ key, inMonth }) => {
          const entries = byDay.get(key) ?? []
          const dayMarks = marksForDay(key, marks, entries)
          const isToday = key === today
          const isSel = key === selected
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              aria-pressed={isSel}
              title={dayMarks.map((m) => m.label).join(', ') || undefined}
              className={cx(
                'group relative flex flex-col items-center rounded-xl transition-colors',
                compact ? 'h-11 pt-1.5' : 'h-[72px] pt-2.5',
                isSel ? 'bg-fg text-bg' : 'hover:bg-elev',
                !inMonth && !isSel && 'text-fg-3'
              )}
            >
              <span className={cx('text-[14px] tabular-nums', isToday && !isSel && 'text-accent font-semibold', isSel && 'font-semibold')}>{parseKey(key).getDate()}</span>
              <span className={cx('mt-1.5 flex items-center gap-1', compact && 'mt-1')}>
                {entries.length > 0 && <span className={cx('rounded-full', compact ? 'size-1.5' : 'size-2', isSel ? 'bg-bg' : 'bg-fg')} />}
                {dayMarks.slice(0, 3).map((m) => (
                  <span key={m.id} className="flex items-center justify-center leading-none" style={{ color: isSel ? undefined : m.color }}>
                    {m.symbol ? <span className={compact ? 'text-[10px]' : 'text-[13px]'}>{m.symbol}</span> : <span className={cx('block rounded-full', compact ? 'size-1.5' : 'size-2')} style={{ background: isSel ? 'var(--bg)' : m.color }} />}
                  </span>
                ))}
              </span>
              {!compact && dayMarks[0] && (
                <span className={cx('mt-auto mb-1.5 max-w-full truncate px-1 text-[10px]', isSel ? 'text-bg/80' : 'text-fg-3')}>{dayMarks[0].label}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
