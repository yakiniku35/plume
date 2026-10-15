import { promises as fs } from 'fs'
import { join, resolve, sep, dirname } from 'path'
import type { Attachment } from '@shared/types'
import { StorageError, extFor, type StorageProvider } from './provider'

/** Attachments on disk under <root>/<userId>/<yyyy>/<mm>/<id>.<ext>. `ref` is relative to root. */
export class LocalProvider implements StorageProvider {
  readonly name = 'local' as const
  constructor(private root: string) {}

  /** Resolve a ref and refuse anything that escapes the root. */
  resolvePath(ref: string): string {
    const rootAbs = resolve(this.root)
    const abs = resolve(rootAbs, ref)
    if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) throw new StorageError('PATH_ESCAPE')
    return abs
  }

  async put(userId: string, att: Pick<Attachment, 'id' | 'name' | 'mime' | 'createdAt'>, bytes: Buffer): Promise<string> {
    const d = new Date(att.createdAt)
    const yyyy = String(d.getFullYear())
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const ref = join(userId, yyyy, mm, `${att.id}.${extFor(att.name, att.mime)}`)
    const abs = this.resolvePath(ref)
    await fs.mkdir(dirname(abs), { recursive: true })
    await fs.writeFile(abs, bytes)
    return ref
  }

  async get(ref: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolvePath(ref))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new StorageError('NOT_FOUND')
      throw e
    }
  }

  async delete(ref: string): Promise<void> {
    await fs.rm(this.resolvePath(ref), { force: true })
  }

  async exists(ref: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(ref))
      return true
    } catch {
      return false
    }
  }
}
