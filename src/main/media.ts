import { promises as fs } from 'fs'
import { basename, extname } from 'path'
import { nanoid } from 'nanoid'
import exifr from 'exifr'
import type { Attachment, AttachmentKind, GeoPoint, ImportRequest } from '@shared/types'
import { paths } from './paths'
import { getAttachment, putAttachment, removeAttachment } from './db'
import { getStorageConfig } from './settings'
import { activeProvider, cachePathFor, providerFor } from './storage'
import { join } from 'path'

const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024

function kindFor(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'file'
}

async function readExif(path: string, mime: string): Promise<{ takenAt?: string; location?: GeoPoint }> {
  if (!mime.startsWith('image/')) return {}
  try {
    const out: { takenAt?: string; location?: GeoPoint } = {}
    const [data, gps] = await Promise.all([
      exifr.parse(path, { pick: ['DateTimeOriginal', 'CreateDate'] }) as Promise<{ DateTimeOriginal?: Date; CreateDate?: Date } | undefined>,
      exifr.gps(path).catch(() => undefined) as Promise<{ latitude: number; longitude: number } | undefined>
    ])
    const when = data?.DateTimeOriginal ?? data?.CreateDate
    if (when instanceof Date && !isNaN(when.getTime())) out.takenAt = when.toISOString()
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) out.location = { lat: gps.latitude, lng: gps.longitude }
    return out
  } catch {
    return {}
  }
}

export function thumbPath(userId: string, id: string): string {
  return join(paths.thumbs(userId), `${id}.jpg`)
}

export async function importFile(userId: string, req: ImportRequest): Promise<Attachment> {
  if (typeof req.path !== 'string' || !req.path) throw new Error('BAD_REQUEST')
  const stat = await fs.stat(req.path)
  if (!stat.isFile() || stat.size > MAX_IMPORT_BYTES) throw new Error('FILE_TOO_LARGE')
  const bytes = await fs.readFile(req.path)
  const exif = await readExif(req.path, req.mime)
  const id = nanoid(14)
  const createdAt = new Date().toISOString()
  const name = basename(req.name || req.path) || `file${extname(req.path)}`
  const provider = activeProvider()
  const base = { id, name, mime: req.mime || 'application/octet-stream', createdAt }
  const ref = await provider.put(userId, base, bytes)
  let hasThumb = false
  if (req.thumb && req.thumb.byteLength > 0) {
    await fs.writeFile(thumbPath(userId, id), Buffer.from(req.thumb))
    hasThumb = true
  }
  if (provider.name === 'gdrive') {
    // Keep the freshly imported original in the local cache so it opens instantly.
    await fs.writeFile(cachePathFor(userId, { id } as Attachment), bytes).catch(() => undefined)
  }
  const att: Attachment = {
    ...base,
    kind: kindFor(base.mime),
    size: stat.size,
    storage: provider.name,
    ref,
    hasThumb,
    width: req.width,
    height: req.height,
    durationSec: req.durationSec,
    takenAt: exif.takenAt ?? req.takenAt,
    location: exif.location ?? req.location
  }
  putAttachment(userId, att)
  return att
}

export async function saveRecording(userId: string, input: { bytes: ArrayBuffer; mime: string; durationSec: number }): Promise<Attachment> {
  if (!(input.bytes instanceof ArrayBuffer) || input.bytes.byteLength === 0) throw new Error('BAD_REQUEST')
  const id = nanoid(14)
  const createdAt = new Date().toISOString()
  const ext = input.mime.includes('mp4') ? 'm4a' : 'webm'
  const base = { id, name: `recording-${createdAt.slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, mime: input.mime, createdAt }
  const provider = activeProvider()
  const bytes = Buffer.from(input.bytes)
  const ref = await provider.put(userId, base, bytes)
  if (provider.name === 'gdrive') await fs.writeFile(cachePathFor(userId, { id } as Attachment), bytes).catch(() => undefined)
  const att: Attachment = {
    ...base,
    kind: 'audio',
    size: bytes.length,
    storage: provider.name,
    ref,
    hasThumb: false,
    durationSec: input.durationSec
  }
  putAttachment(userId, att)
  return att
}

export async function deleteAttachment(userId: string, id: string): Promise<void> {
  const att = getAttachment(userId, id)
  if (!att) return
  try {
    await providerFor(att.storage).delete(att.ref)
  } catch (e) {
    console.error('delete attachment', id, e)
  }
  await fs.rm(thumbPath(userId, id), { force: true })
  await fs.rm(cachePathFor(userId, att), { force: true })
  removeAttachment(userId, id)
}

export function storageRoot(): string {
  return getStorageConfig().localRoot
}
