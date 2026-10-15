import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

export function userDataDir(): string {
  return app.getPath('userData')
}

export function ensureDir(p: string): string {
  mkdirSync(p, { recursive: true })
  return p
}

export const paths = {
  accounts: () => join(userDataDir(), 'accounts.json'),
  settings: () => join(userDataDir(), 'settings.json'),
  storageConfig: () => join(userDataDir(), 'storage.json'),
  secrets: () => join(userDataDir(), 'secrets.bin'),
  userDir: (userId: string) => ensureDir(join(userDataDir(), 'users', userId)),
  entries: (userId: string) => join(paths.userDir(userId), 'entries.json'),
  marks: (userId: string) => join(paths.userDir(userId), 'marks.json'),
  attachments: (userId: string) => join(paths.userDir(userId), 'attachments.json'),
  thumbs: (userId: string) => ensureDir(join(paths.userDir(userId), 'thumbs')),
  originalsCache: (userId: string) => ensureDir(join(paths.userDir(userId), 'cache')),
  fonts: () => ensureDir(join(userDataDir(), 'fonts')),
  defaultLocalRoot: () => join(app.getPath('documents'), 'Plume Journal')
}
