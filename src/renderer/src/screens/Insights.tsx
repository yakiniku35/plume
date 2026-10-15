import { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { summarize, parseKey } from '@/lib/insights'
import { fmtDay, fmtShort, fmtAxis } from '@/lib/dates'
import { Button, Card, SectionTitle, cx } from '@/components/ui'
import { DayGrid, Bars, Line, Stat } from '@/components/charts'
import { MapView } from '@/components/MapView'

export function Insights(): JSX.Element {
  const { entries, newEntry, select, setView } = useApp()
  const { t, locale, dict } = useI18n()
  const s = useMemo(() => summarize(entries), [entries])
  const w = s.last30
  const delta = w.prevTotalWords === 0 ? null : Math.round(((w.totalWords - w.prevTotalWords) / w.prevTotalWords) * 100)
  const hourMax = Math.max(1, ...s.hours)
  const peakHour = s.hours.indexOf(hourMax)
  const nf = new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'zh-Hans' ? 'zh-CN' : 'zh-TW')

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[920px] px-10 pb-24 pt-[72px]">
        <h1 className="mb-8 text-[30px] font-semibold tracking-tight">{t('insightsTitle')}</h1>

        <Card className="mb-5 flex items-center justify-between gap-8">
          <div className="flex flex-wrap gap-12">
            <Stat label={t('todayCard')} value={nf.format(s.today.words)} sub={t('words')} accent={s.today.words > 0} hint={t('hintToday')} />
            <Stat label={t('streak')} value={s.streak} sub={t('streakDays', { n: s.streak })} hint={t('hintStreak')} />
            <Stat label={t('longestStreak')} value={s.longestStreak} sub={t('streakDays', { n: s.longestStreak })} hint={t('hintLongest')} />
          </div>
          {s.today.entries === 0 && (
            <div className="max-w-[260px] text-right">
              <p className="text-[14px] leading-relaxed text-fg-2">{t('promptIdle')}</p>
              <Button size="sm" variant="primary" className="mt-3" onClick={() => newEntry()}>
                {t('writeNow')}
              </Button>
            </div>
          )}
        </Card>

        <Card className="mb-5">
          <SectionTitle
            aside={
              delta !== null && (
                <span className={cx('flex items-center gap-1 text-[12px]', delta > 0 ? 'text-fg' : 'text-fg-3')}>
                  {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                  {Math.abs(delta)}% {t('vsPrevious')}
                </span>
              )
            }
          >
            {t('last30')}
          </SectionTitle>
          <div className="flex flex-wrap items-start gap-12">
            <DayGrid cells={w.cells} labelFor={(c) => `${fmtDay(c.date, locale, dict)} · ${t('wordsN', { n: c.words })}${c.mood ? ` · ${dict.moods[Math.round(c.mood) - 1]}` : ''}`} />
            <div className="grid flex-1 grid-cols-3 gap-8">
              <Stat label={t('totalWords')} value={nf.format(w.totalWords)} hint={t('hintTotalWords')} />
              <Stat label={t('activeDays')} value={`${w.activeDays}/30`} hint={t('hintActiveDays')} />
              <Stat label={t('avgWords')} value={nf.format(w.avgWords)} sub={t('words')} hint={t('hintAvgWords')} />
            </div>
          </div>
        </Card>

        <div className="mb-5 grid grid-cols-2 gap-5">
          <Card>
            <SectionTitle>{t('wordsPerWeek')}</SectionTitle>
            <Bars values={s.weeks.map((x) => x.words)} labels={s.weeks.map((x) => fmtAxis(x.start, locale))} tooltip={(i) => `${t('weekOf', { date: fmtShort(s.weeks[i].start + 'T00:00:00', locale) })} · ${t('wordsN', { n: nf.format(s.weeks[i].words) })}`} />
          </Card>
          <Card>
            <SectionTitle>{t('moodOverTime')}</SectionTitle>
            <Line points={s.moodSeries.map((m) => ({ x: parseKey(m.date).getTime(), y: m.mood, label: `${fmtDay(m.date, locale, dict)} · ${dict.moods[m.mood - 1]}` }))} />
          </Card>
        </div>

        <Card className="mb-5">
          <SectionTitle aside={entries.length > 0 && <span className="text-[12px] text-fg-3">{String(peakHour).padStart(2, '0')}:00</span>}>{t('timeOfDay')}</SectionTitle>
          <Bars values={s.hours} labels={['00', '', '', '', '', '', '', '', '', '', '', '', '12', '', '', '', '', '', '', '', '', '', '', '23']} height={80} highlightLast={false} tooltip={(i) => `${t('hourRange', { from: `${String(i).padStart(2, '0')}:00`, to: `${String(i + 1).padStart(2, '0')}:00` })} · ${t('entriesN', { n: s.hours[i] })}`} />
        </Card>

        <Card className="mb-5">
          <SectionTitle aside={<span className="text-[12px] text-fg-3">{s.totals.photos} {t('photos')} · {s.totals.recordings} {t('recordings')}</span>}>{t('places')}</SectionTitle>
          {s.places.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-fg-3">{t('noPlaces')}</p>
          ) : (
            <div className="grid grid-cols-[1fr_260px] gap-6">
              <div className="h-[320px] overflow-hidden rounded-xl border border-line">
                <MapView interactive={false} markers={s.places.map((p) => ({ ...p.point, weight: p.count, label: `${p.name || `${p.point.lat.toFixed(3)}, ${p.point.lng.toFixed(3)}`} · ${t('entriesN', { n: p.count })}` }))} />
              </div>
              <div>
                <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('topPlaces')}</div>
                <ul className="space-y-2">
                  {s.places.slice(0, 5).map((p, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-[14px]">
                      <button
                        className="truncate text-left hover:underline"
                        onClick={() => {
                          select(p.entryIds[0])
                          setView('journal')
                        }}
                      >
                        {p.name || `${p.point.lat.toFixed(3)}, ${p.point.lng.toFixed(3)}`}
                      </button>
                      <span className="shrink-0 text-[12px] text-fg-3">{t('entriesN', { n: p.count })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle aside={<span className="text-[12px] text-fg-3">{t('entriesN', { n: s.totals.entries })} · {t('wordsN', { n: nf.format(s.totals.words) })}</span>}>{t('wordsAndTags')}</SectionTitle>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('topTags')}</div>
              {s.tags.length === 0 ? (
                <span className="text-[13px] text-fg-3">—</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.map((x) => (
                    <span key={x.tag} className="rounded-md bg-elev px-2 py-1 text-[13px]">
                      #{x.tag} <span className="text-fg-3">{x.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('topWords')}</div>
              {s.words.length === 0 ? (
                <span className="text-[13px] text-fg-3">—</span>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {s.words.map((x, i) => (
                    <span key={x.word} className={cx('text-fg-2', i < 3 ? 'text-[16px] text-fg' : 'text-[13px]')}>
                      {x.word}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('longestEntry')}</div>
              {s.longest ? (
                <button
                  className="text-left"
                  onClick={() => {
                    select(s.longest!.id)
                    setView('journal')
                  }}
                >
                  <div className="text-[14px] font-medium hover:underline">{s.longest.title || t('untitled')}</div>
                  <div className="mt-0.5 text-[12px] text-fg-3">
                    {fmtDay(s.longest.date, locale, dict)} · {t('wordsN', { n: nf.format(s.longest.wordCount) })}
                  </div>
                </button>
              ) : (
                <span className="text-[13px] text-fg-3">—</span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
