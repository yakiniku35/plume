import { Upload } from 'lucide-react'
import type { Avatar as AvatarT } from '@shared/types'
import { useI18n } from '@/lib/i18n'
import { AVATAR_BGS, defaultAvatar } from '@/lib/avatar'
import { DEFAULT_PARTS } from '@/lib/avatarBuilder'
import { Button, cx } from '@/components/ui'
import { Avatar } from '@/components/Avatar'
import { AvatarBuilder } from '@/components/AvatarBuilder'

/** Profile picture: build a person part by part, or upload a picture (e.g. an exported Memoji sticker). */
export function AvatarEditor({ value, onChange, onUpload }: { value?: AvatarT; onChange: (a: AvatarT) => void; onUpload: () => void }): JSX.Element {
  const { t } = useI18n()
  const a = value && value.kind !== 'emoji' ? value : defaultAvatar()
  const parts = a.kind === 'built' ? a.parts : DEFAULT_PARTS

  return (
    <div className="flex gap-8">
      <div className="flex flex-col items-center gap-4">
        <Avatar avatar={a} size={112} />
        <Button size="sm" icon={<Upload size={14} />} onClick={onUpload}>
          {t('uploadPicture')}
        </Button>
      </div>
      <div className="min-w-0 flex-1 space-y-5">
        <p className="text-[13px] leading-relaxed text-fg-2">{t('avatarIntro')}</p>
        <AvatarBuilder parts={parts} onChange={(next) => onChange({ kind: 'built', parts: next, bg: a.bg })} />
        <div>
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('background')}</div>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_BGS.map((bg) => (
              <button key={bg} onClick={() => onChange({ ...a, bg })} aria-pressed={a.bg === bg} className={cx('size-7 rounded-full border transition-transform', a.bg === bg ? 'scale-110 border-fg' : 'border-line')} style={{ background: bg }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
