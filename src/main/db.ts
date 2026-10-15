import type { Attachment, DayMark, Entry } from '@shared/types'
import { paths } from './paths'
import { readJson, writeJson } from './store'

export function listEntries(userId: string): Entry[] {
  return readJson<Entry[]>(paths.entries(userId), [])
}

export function saveEntry(userId: string, entry: Entry): Entry {
  const entries = listEntries(userId)
  const idx = entries.findIndex((e) => e.id === entry.id)
  const next = { ...entry, updatedAt: new Date().toISOString() }
  if (idx >= 0) entries[idx] = next
  else entries.push(next)
  writeJson(paths.entries(userId), entries)
  return next
}

export function deleteEntry(userId: string, id: string): Entry | undefined {
  const entries = listEntries(userId)
  const removed = entries.find((e) => e.id === id)
  writeJson(
    paths.entries(userId),
    entries.filter((e) => e.id !== id)
  )
  return removed
}

export function listMarks(userId: string): DayMark[] {
  return readJson<DayMark[]>(paths.marks(userId), [])
}

export function saveMark(userId: string, mark: DayMark): DayMark {
  const all = listMarks(userId)
  const idx = all.findIndex((m) => m.id === mark.id)
  if (idx >= 0) all[idx] = mark
  else all.push(mark)
  writeJson(paths.marks(userId), all)
  return mark
}

export function deleteMark(userId: string, id: string): void {
  writeJson(paths.marks(userId), listMarks(userId).filter((m) => m.id !== id))
}

/** Attachment index so the media:// protocol can resolve ids without scanning entries. */
export function listAttachments(userId: string): Record<string, Attachment> {
  return readJson<Record<string, Attachment>>(paths.attachments(userId), {})
}

export function putAttachment(userId: string, att: Attachment): void {
  const all = listAttachments(userId)
  all[att.id] = att
  writeJson(paths.attachments(userId), all)
}

export function getAttachment(userId: string, id: string): Attachment | undefined {
  return listAttachments(userId)[id]
}

export function removeAttachment(userId: string, id: string): Attachment | undefined {
  const all = listAttachments(userId)
  const att = all[id]
  delete all[id]
  writeJson(paths.attachments(userId), all)
  return att
}
