import type { Attachment } from '@shared/types'
import { StorageError, type StorageProvider } from './provider'
import { refreshTokens, type OAuthTokens } from './oauth'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024
const CHUNK = 8 * 1024 * 1024

export interface GDriveCredentials {
  clientId: string
  clientSecret: string
  tokens: OAuthTokens
  onTokens(t: OAuthTokens): void
}

/** Google Drive REST v3 over fetch. Scope drive.file: the app only sees files it created. */
export class GDriveProvider implements StorageProvider {
  readonly name = 'gdrive' as const
  constructor(
    private creds: GDriveCredentials,
    private rootFolderId: string
  ) {}

  private async token(): Promise<string> {
    if (Date.now() < this.creds.tokens.expires_at) return this.creds.tokens.access_token
    if (!this.creds.tokens.refresh_token) throw new StorageError('GDRIVE_REAUTH_REQUIRED')
    const t = await refreshTokens(this.creds.clientId, this.creds.clientSecret, this.creds.tokens.refresh_token)
    this.creds.tokens = t
    this.creds.onTokens(t)
    return t.access_token
  }

  private async request(url: string, init: RequestInit & { raw?: boolean } = {}, attempt = 0): Promise<Response> {
    const token = await this.token()
    let res: Response
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60_000)
      })
    } catch (e) {
      if (attempt < 3) return this.backoff(attempt, () => this.request(url, init, attempt + 1))
      throw new StorageError('NETWORK', String(e))
    }
    if (res.status === 401) {
      this.creds.tokens.expires_at = 0
      if (attempt < 1) return this.request(url, init, attempt + 1)
      throw new StorageError('GDRIVE_REAUTH_REQUIRED')
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      return this.backoff(attempt, () => this.request(url, init, attempt + 1))
    }
    if (res.status === 404) throw new StorageError('NOT_FOUND')
    if (!res.ok) throw new StorageError('NETWORK', `drive_${res.status}`)
    return res
  }

  private async backoff<T>(attempt: number, fn: () => Promise<T>): Promise<T> {
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
    return fn()
  }

  async ensureFolder(name: string, parent: string): Promise<string> {
    const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
    const list = (await (await this.request(`${API}/files?q=${q}&fields=files(id)&spaces=drive`)).json()) as { files: { id: string }[] }
    if (list.files[0]) return list.files[0].id
    const created = (await (
      await this.request(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] })
      })
    ).json()) as { id: string }
    return created.id
  }

  async put(userId: string, att: Pick<Attachment, 'id' | 'name' | 'mime' | 'createdAt'>, bytes: Buffer): Promise<string> {
    const userFolder = await this.ensureFolder(userId, this.rootFolderId)
    const meta = { name: `${att.id}-${att.name}`, parents: [userFolder], appProperties: { plumeId: att.id } }
    if (bytes.length < RESUMABLE_THRESHOLD) {
      const boundary = 'plume' + Math.random().toString(36).slice(2)
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${att.mime}\r\n\r\n`),
        bytes,
        Buffer.from(`\r\n--${boundary}--`)
      ])
      const res = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body
      })
      return ((await res.json()) as { id: string }).id
    }
    const start = await this.request(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': att.mime, 'X-Upload-Content-Length': String(bytes.length) },
      body: JSON.stringify(meta)
    })
    const session = start.headers.get('location')
    if (!session) throw new StorageError('NETWORK', 'no_upload_session')
    let id = ''
    for (let offset = 0; offset < bytes.length; offset += CHUNK) {
      const end = Math.min(offset + CHUNK, bytes.length)
      const res = await fetch(session, {
        method: 'PUT',
        headers: { 'Content-Length': String(end - offset), 'Content-Range': `bytes ${offset}-${end - 1}/${bytes.length}` },
        body: bytes.subarray(offset, end),
        signal: AbortSignal.timeout(120_000)
      })
      if (res.status === 200 || res.status === 201) id = ((await res.json()) as { id: string }).id
      else if (res.status !== 308) throw new StorageError('NETWORK', `upload_${res.status}`)
    }
    return id
  }

  async get(ref: string): Promise<Buffer> {
    const res = await this.request(`${API}/files/${encodeURIComponent(ref)}?alt=media`)
    return Buffer.from(await res.arrayBuffer())
  }

  async delete(ref: string): Promise<void> {
    try {
      await this.request(`${API}/files/${encodeURIComponent(ref)}`, { method: 'DELETE' })
    } catch (e) {
      if (!(e instanceof StorageError && e.code === 'NOT_FOUND')) throw e
    }
  }

  async exists(ref: string): Promise<boolean> {
    try {
      await this.request(`${API}/files/${encodeURIComponent(ref)}?fields=id`)
      return true
    } catch {
      return false
    }
  }
}
