import { useMemo } from 'react'
import { Image as ImageIcon, Mic, MapPin } from 'lucide-react'
import type { Entry } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { fmtDay, fmtMonth } from '@/lib/dates'
import { cx } from '@/components/ui'

export function Timeline(): JSX.Element {
  const { entries, selectedId, select, query } = useApp()
  const { t, locale, dict } = useI18n()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q) || e.tags.some((tag) => tag.toLowerCase().includes(q)) || e.location?.name?.toLowerCase().includes(q))
  }, [entries, query])

  const groups = useMemo(() => {
    const out: { month: string; items: Entry[] }[] = []
    for (const e of filtered) {
      const month = e.date.slice(0, 7)
      const g = out[out.length - 1]
      if (g && g.month === month) g.items.push(e)
      else out.push({ month, items: [e] })
    }
    return out
  }, [filtered])

  if (filtered.length === 0) {
    return <div className="px-5 py-8 text-[13px] text-fg-3">{query ? t('noResults') : t('emptyJournalBody')}</div>
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {groups.map((g) => (
        <section key={g.month} className="mb-3">
          <h3 className="sticky top-0 z-10 bg-[var(--bg-sidebar)] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3 backdrop-blur-xl">{fmtMonth(g.month, locale)}</h3>
          <ul className="journal-font space-y-0.5">
            {g.items.map((e) => {
              const active = e.id === selectedId
              const preview = (e.body || '').replace(/\s+/g, ' ').trim()
              return (
                <li key={e.id}>
                  <button onClick={() => select(e.id)} className={cx('block w-full rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150', active ? 'bg-fg/[0.07]' : 'hover:bg-fg/[0.04]')}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cx('truncate text-[14px]', e.title ? 'font-medium text-fg' : 'text-fg-2')}>{e.title || preview.slice(0, 40) || t('untitled')}</span>
                      <span className="shrink-0 text-[11px] text-fg-3">{fmtDay(e.date, locale, dict)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-fg-3">
                      <span className="truncate">{e.title ? preview.slice(0, 60) || t('wordsN', { n: e.wordCount }) : t('wordsN', { n: e.wordCount })}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {e.attachments.some((a) => a.kind === 'image' || a.kind === 'video') && <ImageIcon size={12} />}
                        {e.attachments.some((a) => a.kind === 'audio') && <Mic size={12} />}
                        {e.location && <MapPin size={12} />}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
