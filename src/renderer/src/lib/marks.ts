import type { DayMark, Entry } from '@shared/types'

export const MARK_COLORS = ['#111111', '#c2410c', '#d97706', '#16a34a', '#0284c7', '#7c3aed', '#db2777', '#9a9a97']
export const MARK_SYMBOLS = ['', '★', '♥', '◆', '▲', '🎂', '🎉', '✈︎', '🎓', '💍', '🌱', '🏃', '📌']

/** Marks that apply on a given day: date marks (exact or yearly) plus tag marks matched by that day's entries. */
export function marksForDay(date: string, marks: DayMark[], entriesOnDay: Entry[]): DayMark[] {
  const mmdd = date.slice(5)
  const tags = new Set(entriesOnDay.flatMap((e) => e.tags.map((t) => t.toLowerCase())))
  return marks.filter((m) => {
    if (m.kind === 'date') return m.yearly ? m.date?.slice(5) === mmdd : m.date === date
    return m.tag ? tags.has(m.tag.toLowerCase()) : false
  })
}

export function groupByDay(entries: Entry[]): Map<string, Entry[]> {
  const g = new Map<string, Entry[]>()
  for (const e of entries) {
    const list = g.get(e.date) ?? []
    list.push(e)
    g.set(e.date, list)
  }
  return g
}
