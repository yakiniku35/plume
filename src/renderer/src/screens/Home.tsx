import { useMemo, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import type { DayMark } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { fmtDayLong, todayKey, fmtTime } from '@/lib/dates'
import { groupByDay, marksForDay } from '@/lib/marks'
import { Button, Card, SectionTitle, cx } from '@/components/ui'
import { MonthCalendar } from '@/components/MonthCalendar'
import { MarkSheet } from '@/components/MarkSheet'
import { Feather } from '@/components/Logo'

/** Landing screen: the month at a glance, with the selected day's entries and special-day marks. */
export function Home(): JSX.Element {
  const { entries, marks, newEntry, select, user } = useApp()
  const { t, locale } = useI18n()
  const today = todayKey()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [day, setDay] = useState<string>(today)
  const [sheet, setSheet] = useState<{ open: boolean; mark?: DayMark }>({ open: false })
  const byDay = useMemo(() => groupByDay(entries), [entries])
  const dayEntries = byDay.get(day) ?? []
  const dayMarks = marksForDay(day, marks, dayEntries)
  const todayWords = (byDay.get(today) ?? []).reduce((s, e) => s + e.wordCount, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[920px] px-10 pb-24 pt-[72px]">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-[30px] font-semibold tracking-tight">{fmtDayLong(today, locale)}</h1>
            <p className="mt-1 text-[15px] text-fg-2">{todayWords > 0 ? t('wordsN', { n: todayWords }) : t('nothingYetToday')}</p>
          </div>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => newEntry()}>
            {t('newEntry')}
          </Button>
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-5">
          <Card>
            <MonthCalendar
              month={month}
              byDay={byDay}
              marks={marks}
              selected={day}
              onMonth={setMonth}
              onSelect={(d) => {
                setDay(d)
                if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7))
              }}
            />
          </Card>

          <div className="space-y-5">
            <Card>
              <SectionTitle>{t('entriesOnDay')}</SectionTitle>
              <p className="mb-3 text-[14px] font-medium">{fmtDayLong(day, locale)}</p>
              {dayEntries.length === 0 ? (
                <p className="text-[13px] text-fg-3">{t('noEntriesThisDay')}</p>
              ) : (
                <ul className="space-y-1">
                  {dayEntries.map((e) => (
                    <li key={e.id}>
                      <button onClick={() => select(e.id)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-elev">
                        <span className="block truncate text-[14px]">{e.title || e.body.slice(0, 40) || t('untitled')}</span>
                        <span className="text-[12px] text-fg-3">
                          {fmtTime(e.createdAt, locale)} · {t('wordsN', { n: e.wordCount })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button size="sm" className="mt-4" icon={<Plus size={14} />} onClick={() => newEntry(day)}>
                {t('writeThisDay')}
              </Button>
            </Card>

            <Card>
              <SectionTitle>{t('specialDays')}</SectionTitle>
              {dayMarks.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {dayMarks.map((m) => (
                    <li key={m.id}>
                      <button onClick={() => setSheet({ open: true, mark: m })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-elev">
                        <span className="flex w-4 justify-center" style={{ color: m.color }}>
                          {m.symbol || <span className="size-2.5 rounded-full" style={{ background: m.color }} />}
                        </span>
                        <span className="truncate">{m.label}</span>
                        {m.kind === 'tag' && <span className="ml-auto text-[12px] text-fg-3">#{m.tag}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button size="sm" icon={<Sparkles size={14} />} onClick={() => setSheet({ open: true })}>
                {t('addSpecialDay')}
              </Button>
            </Card>
          </div>
        </div>

        {entries.length === 0 && (
          <div className={cx('mt-10 flex flex-col items-center text-center text-fg-2')}>
            <Feather size={28} className="mb-4 text-fg-3" />
            <p className="text-[15px]">{t('emptyJournalBody')}</p>
            {user && <p className="mt-1 text-[13px] text-fg-3">{user.name}</p>}
          </div>
        )}
      </div>
      <MarkSheet open={sheet.open} date={day} existing={sheet.mark} onClose={() => setSheet({ open: false })} />
    </div>
  )
}
