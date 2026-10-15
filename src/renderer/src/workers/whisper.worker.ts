/// <reference lib="webworker" />
import { pipeline, env, TextStreamer, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import type { WhisperModel, WhisperWorkerIn, WhisperWorkerOut } from '@shared/types'

env.allowLocalModels = false
env.useBrowserCache = true

const MODEL_IDS: Record<WhisperModel, string> = {
  tiny: 'onnx-community/whisper-tiny',
  base: 'onnx-community/whisper-base',
  small: 'onnx-community/whisper-small'
}

const post = (m: WhisperWorkerOut): void => self.postMessage(m)

type Loaded = { model: WhisperModel; pipe: AutomaticSpeechRecognitionPipeline; device: 'webgpu' | 'wasm' }
let current: Loaded | null = null
let loading: Promise<Loaded> | null = null

// The pipeline() overloads produce a union TypeScript cannot represent; narrow it once here.
const makePipeline = pipeline as unknown as (task: 'automatic-speech-recognition', model: string, options: Record<string, unknown>) => Promise<AutomaticSpeechRecognitionPipeline>

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return Boolean(gpu && (await gpu.requestAdapter()))
  } catch {
    return false
  }
}

async function load(model: WhisperModel): Promise<Loaded> {
  if (current?.model === model) return current
  if (loading) await loading.catch(() => undefined)
  if (current?.model === model) return current
  loading = (async () => {
    if (current) await current.pipe.dispose()
    current = null
    const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }): void => {
      if (p.status === 'progress' && p.file) post({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 })
    }
    const id = MODEL_IDS[model]
    let pipe: AutomaticSpeechRecognitionPipeline
    let device: 'webgpu' | 'wasm' = 'wasm'
    if (await hasWebGPU()) {
      try {
        pipe = await makePipeline('automatic-speech-recognition', id, {
          device: 'webgpu',
          dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
          progress_callback
        })
        device = 'webgpu'
      } catch (e) {
        console.warn('webgpu unavailable, falling back to wasm', e)
        pipe = await makePipeline('automatic-speech-recognition', id, { device: 'wasm', dtype: 'q8', progress_callback })
      }
    } else {
      pipe = await makePipeline('automatic-speech-recognition', id, { device: 'wasm', dtype: 'q8', progress_callback })
    }
    current = { model, pipe, device }
    post({ type: 'ready', device })
    return current
  })()
  try {
    return await loading
  } finally {
    loading = null
  }
}

const HALLUCINATIONS = [/字幕由\s*amara\.org\s*社[区區]提供/gi, /请不吝点赞.*$/g, /請不吝點贊.*$/g, /thanks? (you )?for watching[.!]?/gi, /subscribe to my channel[.!]?/gi, /明[镜鏡]與點點欄目/g, /明镜与点点栏目/g]

function clean(text: string): string {
  let t = text
  for (const re of HALLUCINATIONS) t = t.replace(re, '')
  return t.replace(/\s+/g, ' ').trim()
}

self.onmessage = async (ev: MessageEvent<WhisperWorkerIn>) => {
  const msg = ev.data
  try {
    if (msg.type === 'load') {
      await load(msg.model)
      return
    }
    if (msg.type === 'transcribe') {
      const { pipe } = await load(msg.model)
      let acc = ''
      const streamer = new TextStreamer(pipe.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (piece: string) => {
          acc += piece
          post({ type: 'partial', text: clean(acc) })
        }
      })
      const out = await pipe(msg.audio, {
        language: msg.language === 'auto' ? undefined : msg.language,
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
        streamer
      } as Parameters<typeof pipe>[1])
      const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
      post({ type: 'done', text: clean(text) })
    }
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
