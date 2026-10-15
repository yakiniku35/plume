import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import { dirname } from 'path'
import { ensureDir } from './paths'

/** Tiny atomic JSON file store. Good for thousands of entries; swap for SQLite if it ever grows. */
export function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function writeJson(file: string, data: unknown): void {
  ensureDir(dirname(file))
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, file)
}
