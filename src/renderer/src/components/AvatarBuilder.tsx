import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { PART_DEFS, DEFAULT_PARTS, builtAvatarUri, randomParts, type PartKey } from '@/lib/avatarBuilder'
import { Button, cx } from '@/components/ui'

export function AvatarBuilder({ parts, onChange }: { parts: Record<string, string>; onChange: (parts: Record<string, string>) => void }): JSX.Element {
  const { t } = useI18n()
  const [active, setActive] = useState<PartKey>('top')
  const def = PART_DEFS.find((d) => d.key === active)!
  const current = { ...DEFAULT_PARTS, ...parts }
  const set = (key: PartKey, value: string): void => onChange({ ...current, [key]: value })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {PART_DEFS.map((d) => (
          <button key={d.key} onClick={() => setActive(d.key)} aria-pressed={active === d.key} className={cx('h-8 rounded-lg px-3 text-[13px] transition-colors', active === d.key ? 'bg-fg text-bg' : 'bg-elev text-fg-2 hover:text-fg')}>
            {t(d.label)}
          </button>
        ))}
        <Button size="sm" variant="ghost" icon={<Shuffle size={14} />} onClick={() => onChange(randomParts())} className="ml-auto">
          {t('randomize')}
        </Button>
      </div>

      {def.kind === 'color' ? (
        <div className="flex flex-wrap gap-2">
          {def.options.map((hex) => (
            <button key={hex} onClick={() => set(def.key, hex)} aria-pressed={current[def.key] === hex} className={cx('size-8 rounded-full border-2 transition-transform', current[def.key] === hex ? 'scale-110 border-fg' : 'border-line')} style={{ background: `#${hex}` }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {def.optional && (
            <button onClick={() => set(def.key, '')} aria-pressed={!current[def.key]} className={cx('flex aspect-square items-center justify-center rounded-xl border text-[12px] text-fg-2 transition-colors', !current[def.key] ? 'border-fg' : 'border-line hover:border-line-strong')}>
              {t('none')}
            </button>
          )}
          {def.options.map((opt) => (
            <button key={opt} onClick={() => set(def.key, opt)} aria-pressed={current[def.key] === opt} title={opt} className={cx('aspect-square overflow-hidden rounded-xl border bg-elev transition-colors', current[def.key] === opt ? 'border-fg' : 'border-line hover:border-line-strong')}>
              <img src={builtAvatarUri({ ...current, [def.key]: opt })} alt={opt} className="size-full" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-fg-3">{t('avatarCredit')}</p>
    </div>
  )
}
