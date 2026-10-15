import type { Avatar as AvatarT } from '@shared/types'
import { avatarEmoji } from '@/lib/avatar'
import { builtAvatarUri, DEFAULT_PARTS } from '@/lib/avatarBuilder'

export function Avatar({ avatar, size = 36, className }: { avatar?: AvatarT; size?: number; className?: string }): JSX.Element {
  const bg = avatar?.bg ?? '#e5e5e1'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className ?? ''}`} style={{ width: size, height: size, background: bg }} aria-hidden>
      {avatar?.kind === 'image' ? (
        <img src={window.plume.auth.avatarUrl(avatar.file)} alt="" className="size-full object-cover" />
      ) : avatar?.kind === 'built' ? (
        <img src={builtAvatarUri(avatar.parts)} alt="" className="size-full" style={{ transform: 'scale(1.08) translateY(3%)' }} />
      ) : avatar?.kind === 'emoji' ? (
        <span style={{ fontSize: size * 0.58, lineHeight: 1 }}>{avatarEmoji(avatar)}</span>
      ) : (
        <img src={builtAvatarUri(DEFAULT_PARTS)} alt="" className="size-full" style={{ transform: 'scale(1.08) translateY(3%)' }} />
      )}
    </span>
  )
}
