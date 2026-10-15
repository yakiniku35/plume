// Compiles the macOS MapKit helper into resources/plume-maps. Skips on other platforms or when swiftc is missing.
import { execFileSync } from 'node:child_process'
import { existsSync, statSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'native/plume-maps/main.swift')
const out = join(root, 'resources/plume-maps')
if (process.platform !== 'darwin') { console.log('plume-maps: macOS only, skipped'); process.exit(0) }
if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) { console.log('plume-maps: up to date'); process.exit(0) }
mkdirSync(join(root, 'resources'), { recursive: true })
try {
  execFileSync('xcrun', ['swiftc', '-O', '-framework', 'MapKit', '-framework', 'CoreLocation', '-framework', 'AppKit', '-o', out, src], { stdio: 'inherit' })
  execFileSync('codesign', ['--force', '--sign', '-', out], { stdio: 'inherit' })
  console.log('plume-maps: built')
} catch (e) {
  console.warn('plume-maps: build failed (Xcode Command Line Tools needed); the app falls back to OpenStreetMap.', e.message)
}
