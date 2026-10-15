import type { Avatar as AvatarT } from '@shared/types'

export const AVATAR_BGS = ['#e5e5e1', '#f5d0c5', '#fde68a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#111111']

/** Uploaded picture, or the first letter of the name on a coloured circle. */
export function Avatar({ avatar, name, size = 36, className }: { avatar?: AvatarT; name?: string; size?: number; className?: string }): JSX.Element {
  const bg = avatar?.bg ?? '#e5e5e1'
  const dark = bg === '#111111'
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '·'
  return (
    <span className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full ${className ?? ''}`} style={{ width: size, height: size, background: bg, color: dark ? '#f2f2f0' : '#111111' }} aria-hidden>
      {avatar?.kind === 'image' ? (
        <img src={window.plume.auth.avatarUrl(avatar.file)} alt="" className="size-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.42, lineHeight: 1, fontWeight: 500 }}>{initial}</span>
      )}
    </span>
  )
}
