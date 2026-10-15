import type { Attachment, ImportRequest } from '@shared/types'

const THUMB_MAX = 640

async function canvasToJpeg(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<ArrayBuffer> {
  const blob: Blob = await (canvas instanceof OffscreenCanvas
    ? canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 })
    : new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.82)))
  return blob.arrayBuffer()
}

function fit(w: number, h: number): [number, number] {
  const s = Math.min(1, THUMB_MAX / Math.max(w, h))
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]
}

async function imageMeta(file: File): Promise<Pick<ImportRequest, 'thumb' | 'width' | 'height'>> {
  try {
    const bmp = await createImageBitmap(file)
    const [w, h] = fit(bmp.width, bmp.height)
    const c = new OffscreenCanvas(w, h)
    c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    const thumb = await canvasToJpeg(c)
    const meta = { thumb, width: bmp.width, height: bmp.height }
    bmp.close()
    return meta
  } catch {
    return { thumb: null }
  }
}

function videoMeta(file: File): Promise<Pick<ImportRequest, 'thumb' | 'width' | 'height' | 'durationSec'>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'metadata'
    const done = (meta: Pick<ImportRequest, 'thumb' | 'width' | 'height' | 'durationSec'>): void => {
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    const timer = setTimeout(() => done({ thumb: null }), 8000)
    v.onerror = () => {
      clearTimeout(timer)
      done({ thumb: null })
    }
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(1, v.duration / 2 || 0)
    }
    v.onseeked = async () => {
      clearTimeout(timer)
      try {
        const [w, h] = fit(v.videoWidth, v.videoHeight)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')!.drawImage(v, 0, 0, w, h)
        done({ thumb: await canvasToJpeg(c), width: v.videoWidth, height: v.videoHeight, durationSec: v.duration })
      } catch {
        done({ thumb: null, durationSec: v.duration })
      }
    }
    v.src = url
  })
}

function audioMeta(file: File): Promise<Pick<ImportRequest, 'durationSec'>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const a = new Audio()
    const timer = setTimeout(() => resolve({}), 5000)
    a.onloadedmetadata = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve({ durationSec: a.duration })
    }
    a.onerror = () => {
      clearTimeout(timer)
      resolve({})
    }
    a.src = url
  })
}

/** Build the import request (thumbnail + dimensions) in the renderer and hand the file path to main. */
export async function importFile(file: File): Promise<Attachment> {
  const path = window.plume.media.pathForFile(file)
  const mime = file.type || guessMime(file.name)
  let extra: Partial<ImportRequest> = { thumb: null }
  if (mime.startsWith('image/')) extra = await imageMeta(file)
  else if (mime.startsWith('video/')) extra = await videoMeta(file)
  else if (mime.startsWith('audio/')) extra = await audioMeta(file)
  return window.plume.media.import({ path, name: file.name, mime, size: file.size, thumb: null, ...extra })
}

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = { heic: 'image/heic', heif: 'image/heif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mov: 'video/quicktime', mp4: 'video/mp4', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', pdf: 'application/pdf' }
  return map[ext] ?? 'application/octet-stream'
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function fmtDuration(sec?: number): string {
  if (!sec || !isFinite(sec)) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
