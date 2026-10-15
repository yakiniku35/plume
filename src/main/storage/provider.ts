import type { Attachment, StorageProvider as ProviderName } from '@shared/types'

/** Where attachment bytes live. Implementations must be pure (no Electron imports). */
export interface StorageProvider {
  readonly name: ProviderName
  /** Store bytes and return the provider-specific ref. */
  put(userId: string, att: Pick<Attachment, 'id' | 'name' | 'mime' | 'createdAt'>, bytes: Buffer): Promise<string>
  get(ref: string): Promise<Buffer>
  delete(ref: string): Promise<void>
  exists(ref: string): Promise<boolean>
}

export class StorageError extends Error {
  constructor(
    public code: 'PATH_ESCAPE' | 'NOT_FOUND' | 'GDRIVE_NOT_CONNECTED' | 'GDRIVE_REAUTH_REQUIRED' | 'NETWORK' | 'GDRIVE_CONFIG_MISSING',
    message?: string
  ) {
    super(message ?? code)
  }
}

export function extFor(name: string, mime: string): string {
  const m = name.match(/\.([a-z0-9]{1,8})$/i)
  if (m) return m[1].toLowerCase()
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav'
  }
  return byMime[mime] ?? 'bin'
}
