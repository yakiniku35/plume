import type { Avatar } from '@shared/types'

export const PEOPLE_EMOJI = ['🧑', '👩', '👨', '👱‍♀️', '👱‍♂️', '👩‍🦰', '👨‍🦰', '👩‍🦱', '👨‍🦱', '👩‍🦳', '👨‍🦳', '👩‍🦲', '👨‍🦲', '🧔', '🧔‍♀️', '👧', '👦', '🧒', '👶', '👵', '👴', '🧓', '🧕', '👳', '👲', '🧑‍🎓', '🧑‍💻', '🧑‍🎨', '🧑‍🍳', '🧑‍🚀', '🧑‍🎤', '🧑‍🔬', '🧑‍🌾', '🧑‍⚕️', '🧙', '🧚', '🧛', '🧜', '🦸', '🦹', '🐱', '🐶', '🐻', '🐼', '🦊', '🐨', '🐸', '🦁']
export const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}']
export const AVATAR_BGS = ['#e5e5e1', '#f5d0c5', '#fde68a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#111111']

const MODIFIER = /[\u{1F3FB}-\u{1F3FF}]/gu
/** Animals and fantasy creatures do not take skin tones. */
const NO_TONE = new Set(['🐱', '🐶', '🐻', '🐼', '🦊', '🐨', '🐸', '🦁', '🧞', '🧟'])

/** Apply a skin-tone modifier to the first person in an emoji (handles ZWJ sequences like 👩‍🦰). */
export function applyTone(emoji: string, tone: number): string {
  const mod = SKIN_TONES[tone] ?? ''
  if (!mod || NO_TONE.has(emoji)) return emoji
  const parts = emoji.split('‍')
  const first = parts[0].replace(MODIFIER, '').replace(/️/g, '')
  parts[0] = first + mod
  return parts.join('‍')
}

export function avatarEmoji(a: Avatar | undefined): string {
  if (!a) return '🧑'
  return a.kind === 'emoji' ? applyTone(a.emoji, a.tone) : ''
}

export function defaultAvatar(): Avatar {
  return { kind: 'emoji', emoji: '🧑', tone: 0, bg: '#e5e5e1' }
}
