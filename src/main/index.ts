import { app, BrowserWindow, Menu, nativeTheme, protocol, net, session, shell, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { promises as fs } from 'fs'
import { registerIpc } from './ipc'
import { getSettings, setSettings } from './settings'
import { currentUser } from './auth'
import { getAttachment } from './db'
import { localPathFor } from './storage'
import { thumbPath } from './media'
import { paths } from './paths'

const isDev = !app.isPackaged
// Dev only: PLUME_CDP=<port> exposes the DevTools protocol so the UI can be driven by scripts.
if (isDev && process.env['PLUME_CDP']) app.commandLine.appendSwitch('remote-debugging-port', process.env['PLUME_CDP'])

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: 'thumb', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: 'font', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'avatar', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const bounds = getSettings().windowBounds
  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1180,
    height: bounds?.height ?? 780,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 960,
    minHeight: 640,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f0f0f' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  if (isDev) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
      if (level >= 2) console.log(`[renderer:${level === 3 ? 'error' : 'warn'}] ${message} (${source}:${line})`)
    })
    mainWindow.webContents.on('render-process-gone', (_e, d) => console.error('[renderer gone]', d))
  }
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isFullScreen()) setSettings({ windowBounds: mainWindow.getBounds() })
  })
  mainWindow.on('closed', () => (mainWindow = null))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  nativeTheme.on('updated', () => mainWindow?.webContents.send('app:nativeTheme', nativeTheme.shouldUseDarkColors))

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildMenu(): void {
  const send = (action: string) => () => mainWindow?.webContents.send('app:menu', action)
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: send('settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Entry', accelerator: 'Cmd+N', click: send('new-entry') },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Search', accelerator: 'Cmd+F', click: send('search') },
        { label: 'Insights', accelerator: 'Cmd+I', click: send('insights') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' } as const, { role: 'reload' } as const, { role: 'toggleDevTools' } as const] : [])
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function installCsp(): void {
  const dev = isDev
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://cdn.apple-mapkit.com${dev ? " 'unsafe-inline'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' media: thumb: avatar: data: blob: https://*.basemaps.cartocdn.com https://*.apple-mapkit.com`,
    `media-src 'self' media: blob:`,
    `font-src 'self' data: font:`,
    `worker-src 'self' blob:`,
    `connect-src 'self' media: thumb: blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net https://*.apple-mapkit.com https://*.basemaps.cartocdn.com${dev ? ' ws://localhost:* http://localhost:*' : ''}`
  ].join('; ')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isApp = details.url.startsWith('file://') || details.url.startsWith('http://localhost')
    if (!isApp) return callback({})
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } })
  })
}

function installProtocols(): void {
  const notFound = () => new Response('Not found', { status: 404 })
  protocol.handle('media', async (req) => {
    const user = currentUser()
    const id = new URL(req.url).pathname.replace(/^\/+/, '')
    if (!user || !/^[\w-]{1,64}$/.test(id)) return notFound()
    const att = getAttachment(user.id, id)
    if (!att) return notFound()
    try {
      const path = await localPathFor(user.id, att)
      return net.fetch(pathToFileURL(path).toString(), { headers: req.headers })
    } catch (e) {
      console.error('media://', id, e)
      return new Response('Unavailable', { status: 503 })
    }
  })
  protocol.handle('thumb', async (req) => {
    const user = currentUser()
    const id = new URL(req.url).pathname.replace(/^\/+/, '')
    if (!user || !/^[\w-]{1,64}$/.test(id)) return notFound()
    const att = getAttachment(user.id, id)
    if (!att) return notFound()
    const thumb = thumbPath(user.id, id)
    try {
      await fs.access(thumb)
      return net.fetch(pathToFileURL(thumb).toString())
    } catch {
      if (att.kind !== 'image') return notFound()
      try {
        return net.fetch(pathToFileURL(await localPathFor(user.id, att)).toString())
      } catch {
        return new Response('Unavailable', { status: 503 })
      }
    }
  })
}

function installAvatarProtocol(): void {
  protocol.handle('avatar', (req) => {
    const user = currentUser()
    const file = new URL(req.url).pathname.replace(/^\/+/, '')
    if (!user || !/^avatar-[\w.-]{1,60}$/.test(file)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(join(paths.userDir(user.id), file)).toString())
  })
}

function installFontProtocol(): void {
  protocol.handle('font', (req) => {
    const file = new URL(req.url).pathname.replace(/^\/+/, '')
    if (!/^[\w.-]{1,80}$/.test(file)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(join(paths.fonts(), file)).toString())
  })
}

app.setName('Plume')

void app.whenReady().then(() => {
  installCsp()
  installProtocols()
  installFontProtocol()
  installAvatarProtocol()
  registerIpc()
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
