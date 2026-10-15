import { Upload, X } from 'lucide-react'
import type { Avatar as AvatarT } from '@shared/types'
import { useI18n } from '@/lib/i18n'
import { Button, cx } from '@/components/ui'
import { Avatar, AVATAR_BGS } from '@/components/Avatar'

/** Profile picture: upload one (e.g. an exported Memoji sticker); otherwise the name's initial on a chosen colour. */
export function AvatarEditor({ value, name, onChange, onUpload }: { value?: AvatarT; name?: string; onChange: (a: AvatarT | null) => void; onUpload: () => void }): JSX.Element {
  const { t } = useI18n()
  const bg = value?.bg ?? '#e5e5e1'
  return (
    <div className="flex items-center gap-8">
      <Avatar avatar={value} name={name} size={112} />
      <div className="min-w-0 flex-1 space-y-4">
        <p className="text-[13px] leading-relaxed text-fg-2">{t('avatarIntro')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" icon={<Upload size={14} />} onClick={onUpload}>
            {t('uploadPicture')}
          </Button>
          {value?.kind === 'image' && (
            <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => onChange(null)}>
              {t('removePicture')}
            </Button>
          )}
        </div>
        <div>
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('background')}</div>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_BGS.map((c) => (
              <button key={c} onClick={() => onChange(value?.kind === 'image' ? { ...value, bg: c } : { kind: 'initials', bg: c })} aria-pressed={bg === c} className={cx('size-7 rounded-full border transition-transform', bg === c ? 'scale-110 border-fg' : 'border-line')} style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
