import type { Settings, StorageConfig } from '@shared/types'
import { paths } from './paths'
import { readJson, writeJson } from './store'
import { hasSecret } from './secrets'

type StoredSettings = Omit<Settings, 'openaiKeySet' | 'appleMapsTokenSet'>

const defaultSettings: StoredSettings = {
  theme: 'system',
  locale: 'system',
  whisperModel: 'base',
  whisperLanguage: 'auto',
  transcribeMode: 'local',
  fontFamily: 'system',
  paper: 'blank',
  sessionUserId: null
}

function readStored(): StoredSettings {
  return { ...defaultSettings, ...readJson<Partial<StoredSettings>>(paths.settings(), {}) }
}

export function getSettings(): Settings {
  return { ...readStored(), openaiKeySet: hasSecret('openaiKey'), appleMapsTokenSet: hasSecret('appleMapsToken') }
}

export function setSettings(patch: Partial<StoredSettings>): Settings {
  const next = { ...readStored(), ...patch }
  writeJson(paths.settings(), next)
  return { ...next, openaiKeySet: hasSecret('openaiKey'), appleMapsTokenSet: hasSecret('appleMapsToken') }
}

type StoredStorage = {
  provider?: StorageConfig['provider']
  localRoot?: string
  gdrive?: { clientId?: string; connected?: boolean; email?: string; folderId?: string }
}

export function getStorageConfig(): StorageConfig {
  const stored = readJson<StoredStorage>(paths.storageConfig(), {})
  return {
    provider: stored.provider ?? 'local',
    localRoot: stored.localRoot ?? paths.defaultLocalRoot(),
    gdrive: {
      clientId: stored.gdrive?.clientId ?? '',
      clientSecretSet: hasSecret('gdriveClientSecret'),
      connected: stored.gdrive?.connected ?? false,
      email: stored.gdrive?.email,
      folderId: stored.gdrive?.folderId
    }
  }
}

export function setStorageConfig(patch: StoredStorage): StorageConfig {
  const cur = readJson<StoredStorage>(paths.storageConfig(), {})
  const next: StoredStorage = {
    ...cur,
    ...patch,
    gdrive: { ...(cur.gdrive ?? {}), ...(patch.gdrive ?? {}) }
  }
  writeJson(paths.storageConfig(), next)
  return getStorageConfig()
}
