import { Upload } from 'lucide-react'
import type { Avatar as AvatarT } from '@shared/types'
import { useI18n } from '@/lib/i18n'
import { PEOPLE_EMOJI, SKIN_TONES, AVATAR_BGS, applyTone, defaultAvatar } from '@/lib/avatar'
import { Button, cx } from '@/components/ui'
import { Avatar } from '@/components/Avatar'

export function AvatarEditor({ value, onChange, onUpload }: { value?: AvatarT; onChange: (a: AvatarT) => void; onUpload: () => void }): JSX.Element {
  const { t } = useI18n()
  const a = value ?? defaultAvatar()
  const tone = a.kind === 'emoji' ? a.tone : 0
  const emoji = a.kind === 'emoji' ? a.emoji : ''
  const setEmoji = (e: string): void => onChange({ kind: 'emoji', emoji: e, tone: tone as 0, bg: a.bg })
  const setTone = (tn: number): void => onChange({ kind: 'emoji', emoji: emoji || '🧑', tone: tn as 0, bg: a.bg })
  const setBg = (bg: string): void => onChange({ ...a, bg })

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
        <div className="flex flex-wrap gap-1">
          {PEOPLE_EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={cx('flex size-10 items-center justify-center rounded-xl text-[24px] leading-none transition-colors', emoji === e ? 'bg-fg/[0.1] ring-1 ring-fg' : 'hover:bg-elev')}
            >
              {applyTone(e, tone)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6">
          <div>
            <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('skinTone')}</div>
            <div className="flex gap-1.5">
              {SKIN_TONES.map((_, i) => (
                <button key={i} onClick={() => setTone(i)} aria-pressed={tone === i} className={cx('size-7 rounded-full border transition-transform', tone === i ? 'scale-110 border-fg' : 'border-line')} style={{ background: ['#f1c27d', '#ffdbb4', '#e8c39e', '#c68642', '#8d5524', '#4a2912'][i] }} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('background')}</div>
            <div className="flex gap-1.5">
              {AVATAR_BGS.map((bg) => (
                <button key={bg} onClick={() => setBg(bg)} aria-pressed={a.bg === bg} className={cx('size-7 rounded-full border transition-transform', a.bg === bg ? 'scale-110 border-fg' : 'border-line')} style={{ background: bg }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
