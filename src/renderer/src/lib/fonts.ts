import type { Settings } from '@shared/types'

export const FONT_PRESETS: { id: string; label: string; stack: string }[] = [
  { id: 'system', label: 'San Francisco', stack: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang TC', 'PingFang SC', 'Hiragino Sans', 'Segoe UI', 'Microsoft JhengHei', sans-serif" },
  { id: 'serif', label: 'New York', stack: "ui-serif, 'New York', 'Iowan Old Style', 'Songti TC', 'Songti SC', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif" },
  { id: 'rounded', label: 'SF Rounded', stack: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', 'PingFang TC', 'PingFang SC', 'Arial Rounded MT Bold', sans-serif" },
  { id: 'mono', label: 'SF Mono', stack: "ui-monospace, 'SF Mono', Menlo, 'PingFang TC', 'PingFang SC', Consolas, monospace" },
  { id: 'kai', label: '楷體', stack: "'Kaiti TC', 'Kaiti SC', BiauKai, 'KaiTi', 'DFKai-SB', 'Songti TC', serif" }
]

const CUSTOM_FAMILY = 'PlumeCustomFont'
let loaded: string | null = null

/** CSS font-family for the journal surfaces, given the current settings. */
export function fontStack(s: Pick<Settings, 'fontFamily' | 'customFontFile'> | null): string {
  if (!s) return FONT_PRESETS[0].stack
  if (s.fontFamily === 'custom' && s.customFontFile) return `'${CUSTOM_FAMILY}', ${FONT_PRESETS[0].stack}`
  const preset = FONT_PRESETS.find((p) => p.id === s.fontFamily)
  if (preset) return preset.stack
  // Any installed font by name, with the system stack as fallback for missing glyphs.
  return `'${s.fontFamily.replace(/'/g, '')}', ${FONT_PRESETS[0].stack}`
}

export async function ensureCustomFont(file: string | undefined): Promise<void> {
  if (!file || loaded === file) return
  try {
    const face = new FontFace(CUSTOM_FAMILY, `url(${window.plume.settings.fontUrl(file)})`)
    await face.load()
    document.fonts.add(face)
    loaded = file
  } catch (e) {
    console.warn('custom font failed to load', e)
  }
}
