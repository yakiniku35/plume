import { promises as fs } from 'fs'
import { join } from 'path'
import type { Attachment, CacheInfo, MigrationProgress, StorageConfig, StorageProvider as ProviderName } from '@shared/types'
import { getStorageConfig, setStorageConfig } from '../settings'
import { getSecret, setSecret } from '../secrets'
import { paths } from '../paths'
import { listAttachments, putAttachment } from '../db'
import { LocalProvider } from './local'
import { GDriveProvider } from './gdrive'
import { StorageError, type StorageProvider } from './provider'
import { authorizeLoopback, fetchEmail, DRIVE_SCOPE, type OAuthTokens } from './oauth'

function loadTokens(): OAuthTokens | undefined {
  const raw = getSecret('gdriveTokens')
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as OAuthTokens
  } catch {
    return undefined
  }
}

export function providerFor(name: ProviderName): StorageProvider {
  const cfg = getStorageConfig()
  if (name === 'local') return new LocalProvider(cfg.localRoot)
  const tokens = loadTokens()
  const clientSecret = getSecret('gdriveClientSecret')
  if (!cfg.gdrive.clientId || !clientSecret) throw new StorageError('GDRIVE_CONFIG_MISSING')
  if (!tokens || !cfg.gdrive.connected || !cfg.gdrive.folderId) throw new StorageError('GDRIVE_NOT_CONNECTED')
  return new GDriveProvider(
    { clientId: cfg.gdrive.clientId, clientSecret, tokens, onTokens: (t) => setSecret('gdriveTokens', JSON.stringify(t)) },
    cfg.gdrive.folderId
  )
}

export function activeProvider(): StorageProvider {
  return providerFor(getStorageConfig().provider)
}

/** Where a downloaded Drive original is cached so media:// can stream from disk. */
export function cachePathFor(userId: string, att: Attachment): string {
  return join(paths.originalsCache(userId), att.id)
}

/** Absolute path to the attachment bytes on disk, downloading into the cache when it lives in Drive. */
export async function localPathFor(userId: string, att: Attachment): Promise<string> {
  if (att.storage === 'local') return new LocalProvider(getStorageConfig().localRoot).resolvePath(att.ref)
  const cached = cachePathFor(userId, att)
  try {
    await fs.access(cached)
    return cached
  } catch {
    const bytes = await providerFor('gdrive').get(att.ref)
    await fs.writeFile(cached, bytes)
    return cached
  }
}

export async function gdriveConnect(): Promise<StorageConfig> {
  const cfg = getStorageConfig()
  const clientSecret = getSecret('gdriveClientSecret')
  if (!cfg.gdrive.clientId || !clientSecret) throw new StorageError('GDRIVE_CONFIG_MISSING')
  const tokens = await authorizeLoopback(cfg.gdrive.clientId, clientSecret, DRIVE_SCOPE)
  setSecret('gdriveTokens', JSON.stringify(tokens))
  const email = await fetchEmail(tokens.access_token)
  const probe = new GDriveProvider(
    { clientId: cfg.gdrive.clientId, clientSecret, tokens, onTokens: (t) => setSecret('gdriveTokens', JSON.stringify(t)) },
    'root'
  )
  const folderId = await probe.ensureFolder('Plume Journal', 'root')
  return setStorageConfig({ gdrive: { connected: true, email, folderId } })
}

export function gdriveDisconnect(): StorageConfig {
  setSecret('gdriveTokens', undefined)
  return setStorageConfig({ gdrive: { connected: false, email: undefined, folderId: undefined } })
}

async function dirSize(dir: string): Promise<number> {
  let total = 0
  try {
    for (const f of await fs.readdir(dir, { withFileTypes: true })) {
      const p = join(dir, f.name)
      if (f.isDirectory()) total += await dirSize(p)
      else total += (await fs.stat(p)).size
    }
  } catch {
    /* missing dir */
  }
  return total
}

export async function cacheInfo(userId: string): Promise<CacheInfo> {
  return { originalsBytes: await dirSize(paths.originalsCache(userId)), thumbsBytes: await dirSize(paths.thumbs(userId)) }
}

export async function clearCache(userId: string): Promise<CacheInfo> {
  await fs.rm(paths.originalsCache(userId), { recursive: true, force: true })
  paths.originalsCache(userId)
  return cacheInfo(userId)
}

/**
 * Copy every attachment to `to`, rewriting ref/storage per attachment as it lands.
 * Safe to re-run: attachments already on `to` are skipped.
 */
export async function migrate(userId: string, to: ProviderName, onProgress: (p: MigrationProgress) => void): Promise<MigrationProgress> {
  const target = providerFor(to)
  const all = Object.values(listAttachments(userId))
  const todo = all.filter((a) => a.storage !== to)
  const progress: MigrationProgress = { done: 0, total: todo.length, failed: [] }
  for (const att of todo) {
    try {
      const source = providerFor(att.storage)
      const bytes = await source.get(att.ref)
      const ref = await target.put(userId, att, bytes)
      const next: Attachment = { ...att, ref, storage: to }
      putAttachment(userId, next)
      await source.delete(att.ref).catch(() => undefined)
    } catch (e) {
      progress.failed.push(att.id)
      console.error('migrate failed', att.id, e)
    }
    progress.done++
    onProgress({ ...progress })
  }
  if (progress.failed.length === 0) setStorageConfig({ provider: to })
  return progress
}
