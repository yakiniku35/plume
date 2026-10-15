// Renders build/icon.svg into the macOS .iconset PNG set, builds build/icon.icns with iconutil,
// and writes resources/icon.png for the in-app welcome screen. Idempotent.
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const svg = readFileSync(join(root, 'build/icon.svg'), 'utf8')
const iconset = join(root, 'build/icon.iconset')
rmSync(iconset, { recursive: true, force: true })
mkdirSync(iconset, { recursive: true })

function render(size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
}

const sizes = [16, 32, 128, 256, 512]
for (const s of sizes) {
  writeFileSync(join(iconset, `icon_${s}x${s}.png`), render(s))
  writeFileSync(join(iconset, `icon_${s}x${s}@2x.png`), render(s * 2))
}
writeFileSync(join(root, 'resources/icon.png'), render(512))
writeFileSync(join(root, 'build/icon.png'), render(1024))

if (process.platform === 'darwin') {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(root, 'build/icon.icns')], { stdio: 'inherit' })
  console.log('wrote build/icon.icns')
} else {
  console.log('iconutil is macOS-only; PNG set written to build/icon.iconset')
}
