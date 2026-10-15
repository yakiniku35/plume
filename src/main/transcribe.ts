import type { WhisperLanguage } from '@shared/types'
import { getSecret } from './secrets'

const OPENAI_TRANSCRIPTIONS = 'https://api.openai.com/v1/audio/transcriptions'
const OPENAI_MODEL = 'whisper-1'

/** Cloud transcription. Runs in main so the API key never reaches the renderer. */
export async function transcribeCloud(input: { bytes: ArrayBuffer; mime: string; language: WhisperLanguage }): Promise<string> {
  const key = getSecret('openaiKey')
  if (!key) throw new Error('OPENAI_KEY_MISSING')
  if (!(input.bytes instanceof ArrayBuffer) || input.bytes.byteLength === 0) throw new Error('BAD_REQUEST')
  if (input.bytes.byteLength > 25 * 1024 * 1024) throw new Error('AUDIO_TOO_LARGE')
  const form = new FormData()
  form.append('file', new Blob([input.bytes], { type: input.mime }), input.mime.includes('mp4') ? 'audio.m4a' : 'audio.webm')
  form.append('model', OPENAI_MODEL)
  if (input.language !== 'auto') form.append('language', input.language)
  const res = await fetch(OPENAI_TRANSCRIPTIONS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(120_000)
  })
  if (res.status === 401) throw new Error('OPENAI_KEY_INVALID')
  if (!res.ok) throw new Error(`OPENAI_${res.status}`)
  return ((await res.json()) as { text: string }).text.trim()
}
