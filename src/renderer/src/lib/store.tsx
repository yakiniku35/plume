import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import type { Avatar, DayMark, Entry, Settings, StorageConfig, User, Locale } from '@shared/types'
import { I18nContext, detectLocale, makeI18n } from './i18n'
import { countWords } from './words'
import { todayKey } from './dates'
import { ensureCustomFont, fontStack } from './fonts'

export type View = 'journal' | 'insights' | 'settings'

interface AppState {
  booted: boolean
  user: User | null
  entries: Entry[]
  marks: DayMark[]
  settings: Settings | null
  storage: StorageConfig | null
  dark: boolean
  view: View
  selectedId: string | null
  query: string
  saving: boolean
}

interface AppActions {
  setView(v: View): void
  select(id: string | null): void
  setQuery(q: string): void
  login(email: string, password: string): Promise<void>
  register(email: string, password: string, name: string): Promise<void>
  logout(): Promise<void>
  newEntry(date?: string): Entry
  saveMark(mark: DayMark): Promise<void>
  updateProfile(patch: { name?: string; avatar?: Avatar }): Promise<void>
  pickAvatarImage(): Promise<void>
  deleteMark(id: string): Promise<void>
  updateEntry(entry: Entry): void
  deleteEntry(id: string): Promise<void>
  refreshEntries(): Promise<void>
  setSettings(patch: Parameters<Window['plume']['settings']['set']>[0]): Promise<void>
  setOpenaiKey(key: string): Promise<void>
  setAppleMapsToken(token: string): Promise<void>
  pickFont(): Promise<void>
  setStorage(patch: Parameters<Window['plume']['storage']['set']>[0]): Promise<void>
  refreshStorage(): Promise<void>
}

const Ctx = createContext<(AppState & AppActions) | null>(null)

export function useApp(): AppState & AppActions {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

function resolveLocale(s: Settings | null): Locale {
  return !s || s.locale === 'system' ? detectLocale() : s.locale
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [booted, setBooted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [marks, setMarks] = useState<DayMark[]>([])
  const [settings, setSettingsState] = useState<Settings | null>(null)
  const [storage, setStorageState] = useState<StorageConfig | null>(null)
  const [nativeDark, setNativeDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [view, setView] = useState<View>('journal')
  const [selectedId, select] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const refreshEntries = useCallback(async () => {
    const [list, m] = await Promise.all([window.plume.entries.list(), window.plume.marks.list()])
    setEntries(list.sort(byDateDesc))
    setMarks(m)
  }, [])

  const refreshStorage = useCallback(async () => setStorageState(await window.plume.storage.get()), [])

  useEffect(() => {
    void (async () => {
      const [s, u, st] = await Promise.all([window.plume.settings.get(), window.plume.auth.session(), window.plume.storage.get()])
      setSettingsState(s)
      setStorageState(st)
      setUser(u)
      if (u) await refreshEntries()
      setBooted(true)
    })()
    const off = window.plume.app.onNativeTheme(setNativeDark)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onMq = (e: MediaQueryListEvent): void => setNativeDark(e.matches)
    mq.addEventListener('change', onMq)
    return () => {
      off()
      mq.removeEventListener('change', onMq)
    }
  }, [refreshEntries])

  const dark = settings?.theme === 'dark' || (settings?.theme !== 'light' && nativeDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-body', fontStack(settings))
    if (settings?.fontFamily === 'custom') void ensureCustomFont(settings.customFontFile)
  }, [settings?.fontFamily, settings?.customFontFile])

  const locale = resolveLocale(settings)
  const i18n = useMemo(() => makeI18n(locale), [locale])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const login = useCallback(
    async (email: string, password: string) => {
      setUser(await window.plume.auth.login({ email, password }))
      await refreshEntries()
      setView('journal')
    },
    [refreshEntries]
  )
  const register = useCallback(
    async (email: string, password: string, name: string) => {
      setUser(await window.plume.auth.register({ email, password, name }))
      setEntries([])
      setMarks([])
      setView('journal')
    },
    []
  )
  const logout = useCallback(async () => {
    await window.plume.auth.logout()
    setUser(null)
    setEntries([])
    setMarks([])
    select(null)
  }, [])

  const newEntry = useCallback((date?: string): Entry => {
    const now = new Date().toISOString()
    const e: Entry = { id: nanoid(12), date: date ?? todayKey(), title: '', body: '', tags: [], attachments: [], wordCount: 0, createdAt: now, updatedAt: now }
    setEntries((prev) => [e, ...prev])
    select(e.id)
    setView('journal')
    return e
  }, [])

  const updateEntry = useCallback((entry: Entry) => {
    const next = { ...entry, wordCount: countWords(entry.body) + countWords(entry.title) }
    setEntries((prev) => prev.map((e) => (e.id === next.id ? next : e)).sort(byDateDesc))
    const t = pending.current.get(next.id)
    if (t) clearTimeout(t)
    setSaving(true)
    pending.current.set(
      next.id,
      setTimeout(async () => {
        pending.current.delete(next.id)
        try {
          const saved = await window.plume.entries.save(next)
          setEntries((prev) => prev.map((e) => (e.id === saved.id ? { ...e, updatedAt: saved.updatedAt } : e)))
        } finally {
          if (pending.current.size === 0) setSaving(false)
        }
      }, 700)
    )
  }, [])

  const deleteEntry = useCallback(async (id: string) => {
    const t = pending.current.get(id)
    if (t) clearTimeout(t)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    select((cur) => (cur === id ? null : cur))
    await window.plume.entries.remove(id)
  }, [])

  const updateProfile = useCallback(async (patch: { name?: string; avatar?: Avatar }) => setUser(await window.plume.auth.updateProfile(patch)), [])
  const pickAvatarImage = useCallback(async () => setUser(await window.plume.auth.pickAvatarImage()), [])

  const saveMark = useCallback(async (mark: DayMark) => {
    const saved = await window.plume.marks.save(mark)
    setMarks((prev) => (prev.some((m) => m.id === saved.id) ? prev.map((m) => (m.id === saved.id ? saved : m)) : [...prev, saved]))
  }, [])
  const deleteMark = useCallback(async (id: string) => {
    setMarks((prev) => prev.filter((m) => m.id !== id))
    await window.plume.marks.remove(id)
  }, [])

  const setSettings = useCallback(async (patch: Parameters<Window['plume']['settings']['set']>[0]) => {
    setSettingsState(await window.plume.settings.set(patch))
  }, [])
  const setOpenaiKey = useCallback(async (key: string) => setSettingsState(await window.plume.settings.setOpenaiKey(key)), [])
  const setAppleMapsToken = useCallback(async (token: string) => setSettingsState(await window.plume.settings.setAppleMapsToken(token)), [])
  const pickFont = useCallback(async () => setSettingsState(await window.plume.settings.pickFont()), [])
  const setStorage = useCallback(async (patch: Parameters<Window['plume']['storage']['set']>[0]) => {
    setStorageState(await window.plume.storage.set(patch))
  }, [])

  // Menu shortcuts from the main process.
  useEffect(() => {
    return window.plume.app.onMenu((action) => {
      if (!user) return
      if (action === 'new-entry') newEntry()
      if (action === 'insights') setView('insights')
      if (action === 'settings') setView('settings')
      if (action === 'search') {
        setView('journal')
        // The search box mounts with the journal view; focus it after React has rendered.
        requestAnimationFrame(() => document.getElementById('search-input')?.focus())
      }
    })
  }, [user, newEntry])

  const value = useMemo<AppState & AppActions>(
    () => ({
      booted, user, entries, marks, settings, storage, dark, view, selectedId, query, saving,
      setView, select, setQuery, login, register, logout, newEntry, updateEntry, deleteEntry, refreshEntries, saveMark, deleteMark, updateProfile, pickAvatarImage,
      setSettings, setOpenaiKey, setAppleMapsToken, pickFont, setStorage, refreshStorage
    }),
    [booted, user, entries, marks, settings, storage, dark, view, selectedId, query, saving, login, register, logout, newEntry, updateEntry, deleteEntry, refreshEntries, saveMark, deleteMark, updateProfile, pickAvatarImage, setSettings, setOpenaiKey, setAppleMapsToken, pickFont, setStorage, refreshStorage]
  )

  return (
    <Ctx.Provider value={value}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </Ctx.Provider>
  )
}

function byDateDesc(a: Entry, b: Entry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}
