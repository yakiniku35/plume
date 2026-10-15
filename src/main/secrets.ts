import { safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { paths, ensureDir } from './paths'
import { dirname } from 'path'

export type SecretKey = 'openaiKey' | 'gdriveClientSecret' | 'gdriveTokens' | 'appleMapsToken'

type SecretMap = Partial<Record<SecretKey, string>>

function load(): SecretMap {
  const file = paths.secrets()
  if (!existsSync(file)) return {}
  try {
    const buf = readFileSync(file)
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8')
    return JSON.parse(json) as SecretMap
  } catch {
    return {}
  }
}

function save(map: SecretMap): void {
  const file = paths.secrets()
  ensureDir(dirname(file))
  const json = JSON.stringify(map)
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8')
  writeFileSync(file, data, { mode: 0o600 })
}

export function getSecret(key: SecretKey): string | undefined {
  return load()[key]
}

export function hasSecret(key: SecretKey): boolean {
  return Boolean(load()[key])
}

export function setSecret(key: SecretKey, value: string | undefined): void {
  const map = load()
  if (value) map[key] = value
  else delete map[key]
  save(map)
}
