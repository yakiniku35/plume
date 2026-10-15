import type { Entry, GeoPoint, Mood } from '@shared/types'

/* ---------- dates (local time, dependency-free so this file is unit-testable) ---------- */

const pad = (n: number): string => String(n).padStart(2, '0')
export const keyOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function shiftKey(key: string, days: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + days)
  return keyOf(d)
}
/** Keys for the n days ending at `end` (inclusive), oldest first. */
export function rangeKeys(end: string, n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(shiftKey(end, -i))
  return out
}

/* ---------- aggregates ---------- */

export interface DayCell {
  date: string
  words: number
  entries: number
  mood?: number
}

export interface Window30 {
  cells: DayCell[]
  totalWords: number
  activeDays: number
  avgWords: number
  prevTotalWords: number
  prevActiveDays: number
}

export interface Place {
  point: GeoPoint
  name: string
  count: number
  entryIds: string[]
}

export interface Summary {
  today: { words: number; entries: number }
  streak: number
  longestStreak: number
  last30: Window30
  weeks: { start: string; words: number }[]
  moodSeries: { date: string; mood: number }[]
  hours: number[]
  places: Place[]
  tags: { tag: string; count: number }[]
  words: { word: string; count: number }[]
  longest: Entry | null
  totals: { entries: number; words: number; photos: number; recordings: number }
}

export function wordsByDay(entries: Entry[]): Map<string, DayCell> {
  const m = new Map<string, DayCell>()
  for (const e of entries) {
    const c = m.get(e.date) ?? { date: e.date, words: 0, entries: 0 }
    c.words += e.wordCount
    c.entries += 1
    if (e.mood) c.mood = c.mood ? (c.mood + e.mood) / 2 : e.mood
    m.set(e.date, c)
  }
  return m
}

/** Consecutive days with at least one entry, ending today or yesterday. */
export function currentStreak(days: Map<string, DayCell>, today: string): number {
  let key = days.has(today) ? today : shiftKey(today, -1)
  let n = 0
  while (days.has(key)) {
    n++
    key = shiftKey(key, -1)
  }
  return n
}

export function longestStreak(days: Map<string, DayCell>): number {
  const keys = [...days.keys()].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const k of keys) {
    run = prev && shiftKey(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return best
}

export function window30(days: Map<string, DayCell>, today: string): Window30 {
  const keys = rangeKeys(today, 30)
  const cells = keys.map((k) => days.get(k) ?? { date: k, words: 0, entries: 0 })
  const totalWords = cells.reduce((s, c) => s + c.words, 0)
  const activeDays = cells.filter((c) => c.entries > 0).length
  const prevKeys = rangeKeys(shiftKey(today, -30), 30)
  const prev = prevKeys.map((k) => days.get(k))
  return {
    cells,
    totalWords,
    activeDays,
    avgWords: activeDays ? Math.round(totalWords / activeDays) : 0,
    prevTotalWords: prev.reduce((s, c) => s + (c?.words ?? 0), 0),
    prevActiveDays: prev.filter((c) => c && c.entries > 0).length
  }
}

export function weeklyWords(days: Map<string, DayCell>, today: string, weeks = 12): { start: string; words: number }[] {
  const out: { start: string; words: number }[] = []
  const end = parseKey(today)
  const dow = (end.getDay() + 6) % 7 // Monday = 0
  let weekStart = shiftKey(today, -dow - (weeks - 1) * 7)
  for (let w = 0; w < weeks; w++) {
    let words = 0
    for (let i = 0; i < 7; i++) words += days.get(shiftKey(weekStart, i))?.words ?? 0
    out.push({ start: weekStart, words })
    weekStart = shiftKey(weekStart, 7)
  }
  return out
}

export function hourHistogram(entries: Entry[]): number[] {
  const h = new Array<number>(24).fill(0)
  for (const e of entries) {
    const d = new Date(e.createdAt)
    if (!isNaN(d.getTime())) h[d.getHours()]++
  }
  return h
}

export function clusterPlaces(entries: Entry[]): Place[] {
  const groups = new Map<string, Place>()
  const add = (p: GeoPoint, id: string): void => {
    const key = `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`
    const g = groups.get(key) ?? { point: { lat: p.lat, lng: p.lng }, name: '', count: 0, entryIds: [] }
    if (!g.name && p.name) g.name = p.name
    if (!g.entryIds.includes(id)) {
      g.entryIds.push(id)
      g.count++
    }
    groups.set(key, g)
  }
  for (const e of entries) {
    if (e.location) add(e.location, e.id)
    for (const a of e.attachments) if (a.location) add(a.location, e.id)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count)
}

export function tagCounts(entries: Entry[]): { tag: string; count: number }[] {
  const m = new Map<string, number>()
  for (const e of entries) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1)
  return [...m].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)
}

const STOP_EN = new Set('the and for that with this have from you not but are was were they them their his her she its our out all can will just like what when where which who how then than more some very into about there here been being had has did does doing would could should also only over such too get got one two day today'.split(' '))
const STOP_CJK = new Set(['今天', '明天', '昨天', '下來', '下来', '我们', '我們', '他们', '他們', '你们', '你們', '什么', '什麼', '这个', '這個', '那个', '那個', '没有', '沒有', '可以', '因为', '因為', '所以', '但是', '然后', '然後', '就是', '还是', '還是', '一个', '一個', '自己', '时候', '時候', '这样', '這樣', '那样', '那樣', '觉得', '覺得', '知道', '现在', '現在', '已经', '已經', '如果', '不是', '还有', '還有', '一下', '一些', '的话', '的話', '这些', '這些', '那些', '不过', '不過', '而且', '虽然', '雖然', '只是', '可能', '应该', '應該', '也是', '都是', '是我', '我的', '你的', '他的', '她的', '了一', '的人', '的时', '的時', '有点', '有點'])
const STOP_CJK_CHARS = new Set('的了是我在有和就不人都一上也很到说要去你会着没看好这那么它她他吗呢吧啊嗯与及或'.split(''))
const CJK_RUN = /[㐀-䶿一-鿿]+/g

export function topWords(entries: Entry[], limit = 12): { word: string; count: number }[] {
  const m = new Map<string, number>()
  const bump = (w: string): void => void m.set(w, (m.get(w) ?? 0) + 1)
  for (const e of entries) {
    const text = `${e.title} ${e.body}`
    for (const run of text.match(CJK_RUN) ?? []) {
      for (let i = 0; i + 1 < run.length; i++) {
        const bi = run.slice(i, i + 2)
        if (STOP_CJK.has(bi) || STOP_CJK_CHARS.has(bi[0]) || STOP_CJK_CHARS.has(bi[1])) continue
        bump(bi)
      }
    }
    for (const w of text.replace(CJK_RUN, ' ').toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) ?? []) {
      if (!STOP_EN.has(w)) bump(w)
    }
  }
  return [...m]
    .filter(([, c]) => c > 1)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function summarize(entries: Entry[], today = keyOf(new Date())): Summary {
  const days = wordsByDay(entries)
  const t = days.get(today)
  const recent = entries.filter((e) => e.date >= shiftKey(today, -89) && e.mood)
  const moodSeries = recent
    .map((e) => ({ date: e.date, mood: e.mood as Mood as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  let longest: Entry | null = null
  for (const e of entries) if (!longest || e.wordCount > longest.wordCount) longest = e
  return {
    today: { words: t?.words ?? 0, entries: t?.entries ?? 0 },
    streak: currentStreak(days, today),
    longestStreak: longestStreak(days),
    last30: window30(days, today),
    weeks: weeklyWords(days, today),
    moodSeries,
    hours: hourHistogram(entries),
    places: clusterPlaces(entries),
    tags: tagCounts(entries).slice(0, 10),
    words: topWords(entries),
    longest: longest && longest.wordCount > 0 ? longest : null,
    totals: {
      entries: entries.length,
      words: entries.reduce((s, e) => s + e.wordCount, 0),
      photos: entries.reduce((s, e) => s + e.attachments.filter((a) => a.kind === 'image' || a.kind === 'video').length, 0),
      recordings: entries.reduce((s, e) => s + e.attachments.filter((a) => a.kind === 'audio').length, 0)
    }
  }
}
