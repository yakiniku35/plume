import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import type { DayMark } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { fmtDayLong } from '@/lib/dates'
import { MARK_COLORS, MARK_SYMBOLS } from '@/lib/marks'
import { Button, Choice, Field, Input, Sheet, cx } from '@/components/ui'

type Kind = 'date' | 'yearly' | 'tag'

export function MarkSheet({ open, date, existing, onClose }: { open: boolean; date: string; existing?: DayMark; onClose: () => void }): JSX.Element {
  const { saveMark, deleteMark, dark } = useApp()
  const { t, locale } = useI18n()
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<Kind>('date')
  const [tag, setTag] = useState('')
  const [color, setColor] = useState(MARK_COLORS[1])
  const [symbol, setSymbol] = useState('')

  useEffect(() => {
    if (!open) return
    setLabel(existing?.label ?? '')
    setKind(existing ? (existing.kind === 'tag' ? 'tag' : existing.yearly ? 'yearly' : 'date') : 'date')
    setTag(existing?.tag ?? '')
    setColor(existing?.color ?? MARK_COLORS[1])
    setSymbol(existing?.symbol ?? '')
  }, [open, existing])

  async function save(): Promise<void> {
    const mark: DayMark = {
      id: existing?.id ?? nanoid(10),
      kind: kind === 'tag' ? 'tag' : 'date',
      date: kind === 'tag' ? undefined : date,
      yearly: kind === 'yearly' ? true : undefined,
      tag: kind === 'tag' ? tag.trim().replace(/^#/, '') : undefined,
      label: label.trim() || (kind === 'tag' ? `#${tag.trim()}` : fmtDayLong(date, locale)),
      color,
      symbol: symbol || undefined
    }
    if (mark.kind === 'tag' && !mark.tag) return
    await saveMark(mark)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} width={520}>
      <h3 className="text-[20px] font-semibold tracking-tight">{existing ? t('editSpecialDay') : t('addSpecialDay')}</h3>
      <p className="mt-1 text-[14px] text-fg-2">{fmtDayLong(date, locale)}</p>
      <div className="mt-6 space-y-5">
        <Field label={t('markLabel')}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('markLabelPlaceholder')} autoFocus />
        </Field>
        <div className="space-y-2">
          <Choice selected={kind === 'date'} title={t('markKindDate')} onClick={() => setKind('date')} />
          <Choice selected={kind === 'yearly'} title={t('markKindYearly')} onClick={() => setKind('yearly')} />
          <Choice
            selected={kind === 'tag'}
            title={t('markKindTag')}
            onClick={() => setKind('tag')}
            right={kind === 'tag' ? <span className="flex items-center text-[14px] text-fg-2">#<input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t('markTagPlaceholder')} className="w-32 bg-transparent" onClick={(e) => e.stopPropagation()} /></span> : undefined}
          />
        </div>
        <div className="flex gap-8">
          <div>
            <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('markColor')}</div>
            <div className="flex gap-1.5">
              {MARK_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-pressed={color === c} className={cx('size-7 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-fg' : 'border-transparent')} style={{ background: c === '#111111' && dark ? '#f2f2f0' : c }} />
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('markSymbol')}</div>
            <div className="flex flex-wrap gap-1">
              {MARK_SYMBOLS.map((s) => (
                <button key={s || 'dot'} onClick={() => setSymbol(s)} aria-pressed={symbol === s} className={cx('flex size-8 items-center justify-center rounded-lg text-[15px] transition-colors', symbol === s ? 'bg-fg/[0.1] ring-1 ring-fg' : 'hover:bg-elev')} style={{ color }}>
                  {s || <span className="size-2.5 rounded-full" style={{ background: color }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between">
        {existing ? (
          <Button variant="danger" onClick={() => void deleteMark(existing.id).then(onClose)}>
            {t('delete')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            {t('save')}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
