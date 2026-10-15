export type StorageProvider = 'local' | 'gdrive'
export type AttachmentKind = 'image' | 'video' | 'audio' | 'file'
export type ThemePref = 'system' | 'light' | 'dark'
export type Locale = 'en' | 'zh-Hans' | 'zh-Hant'
export type WhisperModel = 'tiny' | 'base' | 'small'
export type WhisperLanguage = 'auto' | 'zh' | 'en' | 'ja'
export type TranscribeMode = 'system' | 'local' | 'cloud'
export type PaperStyle = 'blank' | 'ruled' | 'dotted'
/** Preset font stacks, any installed font name, or 'custom' for an imported font file. */
export type FontChoice = 'system' | 'serif' | 'rounded' | 'mono' | 'kai' | 'custom' | (string & {})

export interface GeoPoint {
  lat: number
  lng: number
  name?: string
}

export interface Attachment {
  id: string
  kind: AttachmentKind
  name: string
  mime: string
  size: number
  storage: StorageProvider
  /** local: relative path under the storage root. gdrive: Drive file id. */
  ref: string
  hasThumb: boolean
  width?: number
  height?: number
  durationSec?: number
  takenAt?: string
  location?: GeoPoint
  createdAt: string
}

export type Mood = 1 | 2 | 3 | 4 | 5

export interface Entry {
  id: string
  /** YYYY-MM-DD, the day the entry belongs to (editable). */
  date: string
  title: string
  body: string
  mood?: Mood
  tags: string[]
  location?: GeoPoint
  attachments: Attachment[]
  wordCount: number
  createdAt: string
  updatedAt: string
}

/**
 * A special day shown on the calendar: a fixed date (optionally yearly, e.g. a birthday)
 * or every day whose entries carry a given hashtag.
 */
export interface DayMark {
  id: string
  kind: 'date' | 'tag'
  /** YYYY-MM-DD for kind 'date'. */
  date?: string
  /** Repeat on the same month/day every year. */
  yearly?: boolean
  /** Tag name without '#', for kind 'tag'. */
  tag?: string
  label: string
  /** CSS colour. */
  color: string
  /** Optional symbol or emoji drawn instead of a dot. */
  symbol?: string
}

/** An uploaded picture, or just a background colour behind the name's initial. */
export type Avatar = { kind: 'image'; file: string; bg: string } | { kind: 'initials'; bg: string }

/** Native Apple Maps (macOS MapKit via the bundled plume-maps helper). */
export interface MapSnapshotRequest {
  lat?: number
  lng?: number
  latDelta?: number
  lngDelta?: number
  width: number
  height: number
  dark: boolean
  scale: number
  markers?: { lat: number; lng: number }[]
  /** Fit the region to the markers instead of using lat/lng/deltas. */
  fit?: boolean
}
export interface MapRegion {
  lat: number
  lng: number
  latDelta: number
  lngDelta: number
}
export interface MapSnapshot {
  /** PNG as a data: URL. */
  src: string
  /** Pixel position (CSS px) of each requested marker. */
  points: [number, number][]
  region: MapRegion
}
export interface PlaceResult {
  name: string
  address: string
  lat: number
  lng: number
}

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  avatar?: Avatar
}

export interface StorageConfig {
  provider: StorageProvider
  localRoot: string
  gdrive: {
    clientId: string
    /** true when a client secret is stored in the encrypted secret store. */
    clientSecretSet: boolean
    connected: boolean
    email?: string
    folderId?: string
  }
}

export interface Settings {
  theme: ThemePref
  locale: Locale | 'system'
  whisperModel: WhisperModel
  whisperLanguage: WhisperLanguage
  transcribeMode: TranscribeMode
  fontFamily: FontChoice
  paper: PaperStyle
  /** File name inside the app's fonts folder when fontFamily is 'custom'. */
  customFontFile?: string
  customFontName?: string
  /** true when an OpenAI key is stored in the encrypted secret store. */
  openaiKeySet: boolean
  /** true when a MapKit JS token is stored; Apple Maps is used when set. */
  appleMapsTokenSet: boolean
  sessionUserId: string | null
  windowBounds?: { x: number; y: number; width: number; height: number }
}

export interface ImportRequest {
  path: string
  name: string
  mime: string
  size: number
  thumb: ArrayBuffer | null
  width?: number
  height?: number
  durationSec?: number
  takenAt?: string
  location?: GeoPoint
}

export interface CacheInfo {
  originalsBytes: number
  thumbsBytes: number
}

export interface MigrationProgress {
  done: number
  total: number
  failed: string[]
}

export type AuthErrorCode = 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS' | 'WEAK_PASSWORD' | 'INVALID_EMAIL'

/** Messages exchanged with the Whisper web worker. */
export type WhisperWorkerIn =
  | { type: 'load'; model: WhisperModel }
  | { type: 'transcribe'; audio: Float32Array; language: WhisperLanguage; model: WhisperModel }
export type WhisperWorkerOut =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'ready'; device: 'webgpu' | 'wasm' }
  | { type: 'partial'; text: string }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string }

export interface PlumeApi {
  auth: {
    register(input: { email: string; password: string; name: string }): Promise<User>
    login(input: { email: string; password: string }): Promise<User>
    logout(): Promise<void>
    session(): Promise<User | null>
    updateProfile(patch: { name?: string; avatar?: Avatar | null }): Promise<User>
    /** Opens an image picker (PNG/JPEG/HEIC, e.g. an exported Memoji sticker) and sets it as the avatar. */
    pickAvatarImage(): Promise<User>
    avatarUrl(file: string): string
  }
  entries: {
    list(): Promise<Entry[]>
    save(entry: Entry): Promise<Entry>
    remove(id: string): Promise<void>
  }
  marks: {
    list(): Promise<DayMark[]>
    save(mark: DayMark): Promise<DayMark>
    remove(id: string): Promise<void>
  }
  media: {
    pathForFile(file: File): string
    import(req: ImportRequest): Promise<Attachment>
    saveRecording(input: { bytes: ArrayBuffer; mime: string; durationSec: number }): Promise<Attachment>
    remove(attachmentId: string): Promise<void>
    url(attachmentId: string): string
    thumbUrl(attachmentId: string): string
    revealInFinder(attachmentId: string): Promise<void>
  }
  storage: {
    get(): Promise<StorageConfig>
    set(patch: { provider?: StorageProvider; localRoot?: string; gdrive?: { clientId?: string; clientSecret?: string } }): Promise<StorageConfig>
    pickFolder(): Promise<string | null>
    gdriveConnect(): Promise<StorageConfig>
    gdriveDisconnect(): Promise<StorageConfig>
    migrate(to: StorageProvider): Promise<MigrationProgress>
    onMigrateProgress(cb: (p: MigrationProgress) => void): () => void
    cacheInfo(): Promise<CacheInfo>
    clearCache(): Promise<CacheInfo>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Omit<Settings, 'openaiKeySet' | 'appleMapsTokenSet' | 'sessionUserId'>>): Promise<Settings>
    setOpenaiKey(key: string): Promise<Settings>
    setAppleMapsToken(token: string): Promise<Settings>
    getAppleMapsToken(): Promise<string>
    /** Opens a file dialog for a .ttf/.otf/.woff/.woff2, copies it into the app and selects it. */
    pickFont(): Promise<Settings>
    fontUrl(file: string): string
  }
  voice: {
    requestMicrophone(): Promise<boolean>
    transcribeCloud(input: { bytes: ArrayBuffer; mime: string; language: WhisperLanguage }): Promise<string>
  }
  maps: {
    /** true on macOS when the native helper is available. */
    available(): Promise<boolean>
    snapshot(req: MapSnapshotRequest): Promise<MapSnapshot>
    search(q: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]>
  }
  app: {
    openExternal(url: string): Promise<void>
    reverseGeocode(point: { lat: number; lng: number }): Promise<string | null>
    platform: string
    onNativeTheme(cb: (dark: boolean) => void): () => void
    onMenu(cb: (action: 'new-entry' | 'search' | 'insights' | 'settings') => void): () => void
  }
}
