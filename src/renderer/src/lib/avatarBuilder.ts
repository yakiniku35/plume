import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import type { TKey } from './i18n'

/* Part-by-part avatar built from the Avataaars set (Pablo Stanley, free for personal and commercial use). */

export type PartKey = 'top' | 'hairColor' | 'skinColor' | 'eyes' | 'eyebrows' | 'mouth' | 'accessories' | 'facialHair' | 'facialHairColor' | 'clothing' | 'clothesColor'

export interface PartDef {
  key: PartKey
  label: TKey
  kind: 'shape' | 'color'
  options: string[]
  /** Shape parts that may be absent ('' = none). */
  optional?: boolean
}

const schema = avataaars.schema.properties as Record<string, { items?: { enum?: string[] } }>
const enumOf = (k: string): string[] => schema[k]?.items?.enum ?? []

export const HAIR_COLORS = ['2c1b18', '4a312c', '724133', 'a55728', 'c93305', 'b58143', 'd6b370', 'ecdcbf', 'e8e1e1', 'f59797']
export const SKIN_COLORS = ['ffdbb4', 'f8d25c', 'edb98a', 'fd9841', 'd08b5b', 'ae5d29', '614335']
export const CLOTHES_COLORS = ['262e33', '3c4f5c', '929598', 'e6e6e6', 'ffffff', '65c9ff', '5199e4', '25557c', 'b1e2ff', 'a7ffc4', 'ffffb1', 'ffafb9', 'ff488e', 'ff5c5c']

export const PART_DEFS: PartDef[] = [
  { key: 'top', label: 'partTop', kind: 'shape', options: enumOf('top'), optional: true },
  { key: 'hairColor', label: 'partHairColor', kind: 'color', options: HAIR_COLORS },
  { key: 'skinColor', label: 'partSkin', kind: 'color', options: SKIN_COLORS },
  { key: 'eyes', label: 'partEyes', kind: 'shape', options: enumOf('eyes') },
  { key: 'eyebrows', label: 'partEyebrows', kind: 'shape', options: enumOf('eyebrows') },
  { key: 'mouth', label: 'partMouth', kind: 'shape', options: enumOf('mouth') },
  { key: 'accessories', label: 'partAccessories', kind: 'shape', options: enumOf('accessories'), optional: true },
  { key: 'facialHair', label: 'partFacialHair', kind: 'shape', options: enumOf('facialHair'), optional: true },
  { key: 'facialHairColor', label: 'partFacialHairColor', kind: 'color', options: HAIR_COLORS },
  { key: 'clothing', label: 'partClothing', kind: 'shape', options: enumOf('clothing') },
  { key: 'clothesColor', label: 'partClothesColor', kind: 'color', options: CLOTHES_COLORS }
]

export const DEFAULT_PARTS: Record<string, string> = {
  top: 'shortFlat',
  hairColor: '2c1b18',
  skinColor: 'edb98a',
  eyes: 'default',
  eyebrows: 'default',
  mouth: 'smile',
  accessories: '',
  facialHair: '',
  facialHairColor: '2c1b18',
  clothing: 'shirtCrewNeck',
  clothesColor: '262e33'
}

export function randomParts(): Record<string, string> {
  const pick = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)]
  const hair = pick(HAIR_COLORS)
  return {
    top: pick(enumOf('top')),
    hairColor: hair,
    skinColor: pick(SKIN_COLORS),
    eyes: pick(['default', 'happy', 'wink', 'squint', 'side', 'surprised']),
    eyebrows: pick(['default', 'defaultNatural', 'raisedExcited', 'upDown', 'flatNatural']),
    mouth: pick(['smile', 'default', 'twinkle', 'serious']),
    accessories: Math.random() < 0.3 ? pick(['round', 'prescription01', 'prescription02', 'wayfarers']) : '',
    facialHair: Math.random() < 0.25 ? pick(enumOf('facialHair')) : '',
    facialHairColor: hair,
    clothing: pick(enumOf('clothing')),
    clothesColor: pick(CLOTHES_COLORS)
  }
}

const cache = new Map<string, string>()

/** SVG data URI for the given parts. Cached: thumbnails in the picker call this a lot. */
export function builtAvatarUri(parts: Record<string, string>): string {
  const key = JSON.stringify(parts)
  const hit = cache.get(key)
  if (hit) return hit
  const p = { ...DEFAULT_PARTS, ...parts }
  const uri = createAvatar(avataaars, {
    seed: 'plume',
    backgroundColor: ['transparent'],
    top: p.top ? [p.top] : [],
    topProbability: p.top ? 100 : 0,
    hairColor: [p.hairColor],
    skinColor: [p.skinColor],
    eyes: [p.eyes],
    eyebrows: [p.eyebrows],
    mouth: [p.mouth],
    accessories: p.accessories ? [p.accessories] : [],
    accessoriesProbability: p.accessories ? 100 : 0,
    facialHair: p.facialHair ? [p.facialHair] : [],
    facialHairProbability: p.facialHair ? 100 : 0,
    facialHairColor: [p.facialHairColor],
    clothing: [p.clothing],
    clothesColor: [p.clothesColor]
  } as Parameters<typeof createAvatar>[1]).toDataUri()
  cache.set(key, uri)
  if (cache.size > 600) cache.delete(cache.keys().next().value as string)
  return uri
}
