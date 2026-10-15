import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { PlumeApi } from '@shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: PlumeApi = {
  auth: {
    register: (input) => invoke('auth:register', input),
    login: (input) => invoke('auth:login', input),
    logout: () => invoke('auth:logout'),
    session: () => invoke('auth:session'),
    updateProfile: (patch) => invoke('auth:updateProfile', patch),
    pickAvatarImage: () => invoke('auth:pickAvatarImage'),
    avatarUrl: (file) => `avatar://u/${file}`
  },
  entries: {
    list: () => invoke('entries:list'),
    save: (entry) => invoke('entries:save', entry),
    remove: (id) => invoke('entries:remove', id)
  },
  marks: {
    list: () => invoke('marks:list'),
    save: (mark) => invoke('marks:save', mark),
    remove: (id) => invoke('marks:remove', id)
  },
  media: {
    pathForFile: (file) => webUtils.getPathForFile(file),
    import: (req) => invoke('media:import', req),
    saveRecording: (input) => invoke('media:saveRecording', input),
    remove: (id) => invoke('media:remove', id),
    url: (id) => `media://a/${id}`,
    thumbUrl: (id) => `thumb://a/${id}`,
    revealInFinder: (id) => invoke('media:revealInFinder', id)
  },
  storage: {
    get: () => invoke('storage:get'),
    set: (patch) => invoke('storage:set', patch),
    pickFolder: () => invoke('storage:pickFolder'),
    gdriveConnect: () => invoke('storage:gdriveConnect'),
    gdriveDisconnect: () => invoke('storage:gdriveDisconnect'),
    migrate: (to) => invoke('storage:migrate', to),
    onMigrateProgress: (cb) => {
      const handler = (_e: unknown, p: Parameters<typeof cb>[0]): void => cb(p)
      ipcRenderer.on('storage:migrateProgress', handler)
      return () => ipcRenderer.removeListener('storage:migrateProgress', handler)
    },
    cacheInfo: () => invoke('storage:cacheInfo'),
    clearCache: () => invoke('storage:clearCache')
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (patch) => invoke('settings:set', patch),
    setOpenaiKey: (key) => invoke('settings:setOpenaiKey', key),
    setAppleMapsToken: (token) => invoke('settings:setAppleMapsToken', token),
    getAppleMapsToken: () => invoke('settings:getAppleMapsToken'),
    pickFont: () => invoke('settings:pickFont'),
    fontUrl: (file) => `font://f/${file}`
  },
  voice: {
    requestMicrophone: () => invoke('voice:requestMicrophone'),
    transcribeCloud: (input) => invoke('voice:transcribeCloud', input)
  },
  maps: {
    available: () => invoke('maps:available'),
    snapshot: (req) => invoke('maps:snapshot', req),
    search: (q, near) => invoke('maps:search', q, near)
  },
  app: {
    openExternal: (url) => invoke('app:openExternal', url),
    reverseGeocode: (p) => invoke('app:reverseGeocode', p),
    platform: process.platform,
    onNativeTheme: (cb) => {
      const handler = (_e: unknown, dark: boolean): void => cb(dark)
      ipcRenderer.on('app:nativeTheme', handler)
      return () => ipcRenderer.removeListener('app:nativeTheme', handler)
    },
    onMenu: (cb) => {
      const handler = (_e: unknown, action: Parameters<typeof cb>[0]): void => cb(action)
      ipcRenderer.on('app:menu', handler)
      return () => ipcRenderer.removeListener('app:menu', handler)
    }
  }
}

contextBridge.exposeInMainWorld('plume', api)
