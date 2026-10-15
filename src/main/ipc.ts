import { ipcMain, dialog, shell, systemPreferences, BrowserWindow } from 'electron'
import { copyFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { paths } from './paths'
import type { Avatar, DayMark, Entry, ImportRequest, Settings, StorageProvider } from '@shared/types'
import { register, login, logout, currentUser, requireUser, updateProfile } from './auth'
import { listEntries, saveEntry, deleteEntry, getAttachment, listAttachments, listMarks, saveMark, deleteMark } from './db'
import { getSettings, setSettings, getStorageConfig, setStorageConfig } from './settings'
import { getSecret, setSecret } from './secrets'
import { importFile, saveRecording, deleteAttachment } from './media'
import { cacheInfo, clearCache, gdriveConnect, gdriveDisconnect, localPathFor, migrate } from './storage'
import { reverseGeocode } from './geocode'
import { transcribeCloud } from './transcribe'
import { nativeMapsAvailable, snapshot, searchPlaces, reverseNative } from './maps'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown, max = 10_000): string => {
  if (typeof v !== 'string' || v.length > max) throw new Error('BAD_REQUEST')
  return v
}

function validateEntry(v: unknown): { entry: Entry; attachmentIds: string[] } {
  if (!isObj(v)) throw new Error('BAD_REQUEST')
  const id = str(v.id, 64)
  const date = str(v.date, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('BAD_REQUEST')
  const title = str(v.title, 500)
  const body = str(v.body, 2_000_000)
  const tags = Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string').slice(0, 50).map((t) => t.slice(0, 64)) : []
  const mood = typeof v.mood === 'number' && v.mood >= 1 && v.mood <= 5 ? (v.mood as Entry['mood']) : undefined
  const location = isObj(v.location) && typeof v.location.lat === 'number' && typeof v.location.lng === 'number'
    ? { lat: v.location.lat, lng: v.location.lng, name: typeof v.location.name === 'string' ? v.location.name.slice(0, 200) : undefined }
    : undefined
  const attachmentIds = Array.isArray(v.attachments) ? v.attachments.filter(isObj).map((a) => str(a.id, 64)) : []
  const wordCount = typeof v.wordCount === 'number' && v.wordCount >= 0 ? Math.floor(v.wordCount) : 0
  const createdAt = typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString()
  return { entry: { id, date, title, body, tags, mood, location, attachments: [], wordCount, createdAt, updatedAt: createdAt }, attachmentIds }
}

export function registerIpc(): void {
  // auth
  ipcMain.handle('auth:register', (_e, input) => {
    if (!isObj(input)) throw new Error('BAD_REQUEST')
    return register({ email: str(input.email, 320), password: str(input.password, 1000), name: str(input.name, 100) })
  })
  ipcMain.handle('auth:login', (_e, input) => {
    if (!isObj(input)) throw new Error('BAD_REQUEST')
    return login({ email: str(input.email, 320), password: str(input.password, 1000) })
  })
  ipcMain.handle('auth:logout', () => logout())
  ipcMain.handle('auth:session', () => currentUser())
  ipcMain.handle('auth:updateProfile', (_e, p) => {
    const u = requireUser()
    if (!isObj(p)) throw new Error('BAD_REQUEST')
    const out: { name?: string; avatar?: Avatar | null } = {}
    if (typeof p.name === 'string') out.name = p.name.slice(0, 100)
    if (p.avatar === null) out.avatar = null
    else if (isObj(p.avatar)) {
      const a = p.avatar
      const bg = typeof a.bg === 'string' && /^#[0-9a-f]{3,8}$/i.test(a.bg) ? a.bg : '#e5e5e1'
      if (a.kind === 'image' && typeof a.file === 'string' && /^[\w.-]{1,80}$/.test(a.file)) out.avatar = { kind: 'image', file: a.file, bg }
      else if (a.kind === 'initials') out.avatar = { kind: 'initials', bg }
      else throw new Error('BAD_REQUEST')
    }
    return updateProfile(u.id, out)
  })
  ipcMain.handle('auth:pickAvatarImage', async (e) => {
    const u = requireUser()
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'heic', 'webp', 'gif'] }],
      message: 'Choose a picture or an exported Memoji sticker'
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    const src = res.filePaths[0]
    if (res.canceled || !src) return u
    const file = `avatar-${Date.now().toString(36)}${extname(src).toLowerCase()}`
    copyFileSync(src, join(paths.userDir(u.id), file))
    const bg = u.avatar?.bg ?? '#e5e5e1'
    return updateProfile(u.id, { avatar: { kind: 'image', file, bg } })
  })

  // entries
  ipcMain.handle('entries:list', () => {
    const u = requireUser()
    const entries = listEntries(u.id)
    // Refresh attachment metadata from the index (read once) so a migration is reflected everywhere.
    const index = listAttachments(u.id)
    return entries.map((e) => ({ ...e, attachments: e.attachments.map((a) => index[a.id] ?? a) }))
  })
  ipcMain.handle('entries:save', (_e, raw) => {
    const u = requireUser()
    const { entry, attachmentIds } = validateEntry(raw)
    entry.attachments = attachmentIds.map((id) => getAttachment(u.id, id)).filter((a): a is NonNullable<typeof a> => Boolean(a))
    return saveEntry(u.id, entry)
  })
  ipcMain.handle('entries:remove', async (_e, id) => {
    const u = requireUser()
    const removed = deleteEntry(u.id, str(id, 64))
    for (const a of removed?.attachments ?? []) await deleteAttachment(u.id, a.id)
  })

  // calendar marks
  ipcMain.handle('marks:list', () => listMarks(requireUser().id))
  ipcMain.handle('marks:save', (_e, raw) => {
    const u = requireUser()
    if (!isObj(raw)) throw new Error('BAD_REQUEST')
    const kind = raw.kind === 'tag' ? 'tag' : 'date'
    const mark: DayMark = {
      id: str(raw.id, 64),
      kind,
      label: str(raw.label, 100),
      color: str(raw.color, 40),
      symbol: typeof raw.symbol === 'string' && raw.symbol.length <= 8 ? raw.symbol : undefined,
      date: kind === 'date' && typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : undefined,
      yearly: kind === 'date' ? Boolean(raw.yearly) : undefined,
      tag: kind === 'tag' && typeof raw.tag === 'string' ? raw.tag.replace(/^#/, '').slice(0, 64) : undefined
    }
    if (!/^#[0-9a-f]{3,8}$/i.test(mark.color)) throw new Error('BAD_REQUEST')
    if (kind === 'date' && !mark.date) throw new Error('BAD_REQUEST')
    if (kind === 'tag' && !mark.tag) throw new Error('BAD_REQUEST')
    return saveMark(u.id, mark)
  })
  ipcMain.handle('marks:remove', (_e, id) => deleteMark(requireUser().id, str(id, 64)))

  // media
  ipcMain.handle('media:import', (_e, req) => {
    const u = requireUser()
    if (!isObj(req)) throw new Error('BAD_REQUEST')
    return importFile(u.id, req as unknown as ImportRequest)
  })
  ipcMain.handle('media:saveRecording', (_e, input) => {
    const u = requireUser()
    if (!isObj(input) || typeof input.durationSec !== 'number') throw new Error('BAD_REQUEST')
    return saveRecording(u.id, { bytes: input.bytes as ArrayBuffer, mime: str(input.mime, 100), durationSec: input.durationSec })
  })
  ipcMain.handle('media:remove', (_e, id) => deleteAttachment(requireUser().id, str(id, 64)))
  ipcMain.handle('media:revealInFinder', async (_e, id) => {
    const u = requireUser()
    const att = getAttachment(u.id, str(id, 64))
    if (!att) return
    shell.showItemInFolder(await localPathFor(u.id, att))
  })

  // storage
  ipcMain.handle('storage:get', () => getStorageConfig())
  ipcMain.handle('storage:set', (_e, patch) => {
    if (!isObj(patch)) throw new Error('BAD_REQUEST')
    const next: Parameters<typeof setStorageConfig>[0] = {}
    if (patch.provider === 'local' || patch.provider === 'gdrive') next.provider = patch.provider
    if (typeof patch.localRoot === 'string') next.localRoot = patch.localRoot
    if (isObj(patch.gdrive)) {
      next.gdrive = {}
      if (typeof patch.gdrive.clientId === 'string') next.gdrive.clientId = patch.gdrive.clientId.trim()
      if (typeof patch.gdrive.clientSecret === 'string') setSecret('gdriveClientSecret', patch.gdrive.clientSecret.trim() || undefined)
    }
    return setStorageConfig(next)
  })
  ipcMain.handle('storage:pickFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      message: 'Choose where Plume keeps your photos and recordings'
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
  ipcMain.handle('storage:gdriveConnect', () => gdriveConnect())
  ipcMain.handle('storage:gdriveDisconnect', () => gdriveDisconnect())
  ipcMain.handle('storage:migrate', (e, to) => {
    const u = requireUser()
    if (to !== 'local' && to !== 'gdrive') throw new Error('BAD_REQUEST')
    return migrate(u.id, to as StorageProvider, (p) => e.sender.send('storage:migrateProgress', p))
  })
  ipcMain.handle('storage:cacheInfo', () => cacheInfo(requireUser().id))
  ipcMain.handle('storage:clearCache', () => clearCache(requireUser().id))

  // settings
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch) => {
    if (!isObj(patch)) throw new Error('BAD_REQUEST')
    const next: Partial<Settings> = {}
    if (patch.theme === 'system' || patch.theme === 'light' || patch.theme === 'dark') next.theme = patch.theme
    if (patch.locale === 'system' || patch.locale === 'en' || patch.locale === 'zh-Hans' || patch.locale === 'zh-Hant') next.locale = patch.locale
    if (patch.whisperModel === 'tiny' || patch.whisperModel === 'base' || patch.whisperModel === 'small') next.whisperModel = patch.whisperModel
    if (['auto', 'zh', 'en', 'ja'].includes(patch.whisperLanguage as string)) next.whisperLanguage = patch.whisperLanguage as Settings['whisperLanguage']
    if (patch.transcribeMode === 'system' || patch.transcribeMode === 'local' || patch.transcribeMode === 'cloud') next.transcribeMode = patch.transcribeMode
    if (isObj(patch.windowBounds)) next.windowBounds = patch.windowBounds as Settings['windowBounds']
    if (typeof patch.fontFamily === 'string' && patch.fontFamily.length <= 100) next.fontFamily = patch.fontFamily
    if (patch.paper === 'blank' || patch.paper === 'ruled' || patch.paper === 'dotted') next.paper = patch.paper
    return setSettings(next)
  })
  ipcMain.handle('settings:setOpenaiKey', (_e, key) => {
    setSecret('openaiKey', str(key, 500).trim() || undefined)
    return getSettings()
  })
  ipcMain.handle('settings:setAppleMapsToken', (_e, token) => {
    setSecret('appleMapsToken', str(token, 4000).trim() || undefined)
    return getSettings()
  })
  ipcMain.handle('settings:getAppleMapsToken', () => getSecret('appleMapsToken') ?? '')
  ipcMain.handle('settings:pickFont', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] }],
      message: 'Choose a font file for your journal'
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    const src = res.filePaths[0]
    if (res.canceled || !src) return getSettings()
    const ext = extname(src).toLowerCase()
    const name = basename(src, extname(src))
    const safe = `${name.replace(/[^\w.-]+/g, '_').slice(0, 60)}-${Date.now().toString(36)}${ext}`
    copyFileSync(src, join(paths.fonts(), safe))
    return setSettings({ fontFamily: 'custom', customFontFile: safe, customFontName: name })
  })

  // voice
  ipcMain.handle('voice:requestMicrophone', async () => {
    if (process.platform !== 'darwin') return true
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'granted') return true
    return systemPreferences.askForMediaAccess('microphone')
  })
  ipcMain.handle('voice:transcribeCloud', (_e, input) => {
    requireUser()
    if (!isObj(input)) throw new Error('BAD_REQUEST')
    const language = ['auto', 'zh', 'en', 'ja'].includes(input.language as string) ? (input.language as Settings['whisperLanguage']) : 'auto'
    return transcribeCloud({ bytes: input.bytes as ArrayBuffer, mime: str(input.mime, 100), language })
  })

  // app
  ipcMain.handle('app:openExternal', (_e, url) => {
    const u = str(url, 2000)
    if (!/^https?:\/\//i.test(u)) throw new Error('BAD_URL')
    return shell.openExternal(u)
  })
  ipcMain.handle('app:reverseGeocode', async (_e, p) => {
    if (!isObj(p) || typeof p.lat !== 'number' || typeof p.lng !== 'number') throw new Error('BAD_REQUEST')
    if (nativeMapsAvailable()) {
      const name = await reverseNative(p.lat, p.lng).catch(() => null)
      if (name) return name
    }
    return reverseGeocode(p.lat, p.lng)
  })

  // maps (native Apple Maps on macOS)
  ipcMain.handle('maps:available', () => nativeMapsAvailable())
  ipcMain.handle('maps:snapshot', (_e, raw) => {
    if (!isObj(raw)) throw new Error('BAD_REQUEST')
    const num = (v: unknown, lo: number, hi: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined)
    const markers = Array.isArray(raw.markers)
      ? raw.markers.filter(isObj).map((m) => ({ lat: num(m.lat, -90, 90) ?? 0, lng: num(m.lng, -180, 180) ?? 0 })).slice(0, 200)
      : []
    return snapshot({
      lat: num(raw.lat, -85, 85),
      lng: num(raw.lng, -180, 180),
      latDelta: num(raw.latDelta, 0.0005, 170),
      lngDelta: num(raw.lngDelta, 0.0005, 360),
      width: Math.round(num(raw.width, 16, 4096) ?? 600),
      height: Math.round(num(raw.height, 16, 4096) ?? 400),
      dark: Boolean(raw.dark),
      scale: num(raw.scale, 1, 3) ?? 2,
      markers,
      fit: Boolean(raw.fit)
    })
  })
  ipcMain.handle('maps:search', (_e, q, near) => {
    const query = str(q, 200).trim()
    if (!query) return []
    const n = isObj(near) && typeof near.lat === 'number' && typeof near.lng === 'number' ? { lat: near.lat, lng: near.lng } : undefined
    return searchPlaces(query, n)
  })
}
