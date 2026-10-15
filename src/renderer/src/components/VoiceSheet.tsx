import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import type { Attachment, WhisperWorkerIn, WhisperWorkerOut } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { startRecording, toPcm16k, type Recorder } from '@/lib/audio'
import { Button, Sheet, Spinner, cx } from '@/components/ui'
import { errorMessage } from '@/screens/Welcome'

type Phase = 'idle' | 'recording' | 'transcribing' | 'done' | 'error'

let worker: Worker | null = null
function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

export function VoiceSheet({ open, onClose, onText }: { open: boolean; onClose: () => void; onText: (text: string, att: Attachment | null) => void }): JSX.Element {
  const { settings } = useApp()
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('idle')
  const [partial, setPartial] = useState('')
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<Recorder | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    if (open) {
      setPhase('idle')
      setPartial('')
      setError('')
      setProgress(null)
      setSeconds(0)
      if (settings?.transcribeMode === 'local') {
        const w = getWorker()
        const onMsg = (ev: MessageEvent<WhisperWorkerOut>): void => {
          const m = ev.data
          if (m.type === 'progress') setProgress({ loaded: m.loaded, total: m.total })
          else if (m.type === 'ready') setProgress(null)
          else if (m.type === 'error') setError(errorMessage(new Error(m.message), t))
        }
        w.addEventListener('message', onMsg)
        w.postMessage({ type: 'load', model: settings.whisperModel } satisfies WhisperWorkerIn)
        return () => w.removeEventListener('message', onMsg)
      }
    } else if (recorder.current) {
      void recorder.current.stop()
      recorder.current = null
    }
    return undefined
  }, [open, settings?.transcribeMode, settings?.whisperModel, t])

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    const tick = (): void => {
      setLevel(recorder.current?.level() ?? 0)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      clearInterval(id)
      cancelAnimationFrame(raf.current)
    }
  }, [phase])

  async function start(): Promise<void> {
    setError('')
    const ok = await window.plume.voice.requestMicrophone()
    if (!ok) {
      setError(t('micDenied'))
      setPhase('error')
      return
    }
    try {
      recorder.current = await startRecording()
      setPhase('recording')
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setError(name === 'NotFoundError' ? t('micMissing') : name === 'NotAllowedError' ? t('micDenied') : errorMessage(e, t))
      setPhase('error')
    }
  }

  async function stop(): Promise<void> {
    const rec = recorder.current
    if (!rec) return
    recorder.current = null
    setPhase('transcribing')
    const { blob, mime, durationSec } = await rec.stop()
    try {
      const bytes = await blob.arrayBuffer()
      const [text, att] = await Promise.all([
        settings?.transcribeMode === 'cloud' ? transcribeCloud(bytes, mime) : transcribeLocal(blob),
        window.plume.media.saveRecording({ bytes: bytes.slice(0), mime, durationSec }).catch(() => null)
      ])
      setPartial(text)
      setPhase('done')
      if (text) onText(text, att)
      setTimeout(onClose, 600)
    } catch (e) {
      setError(errorMessage(e, t))
      setPhase('error')
    }
  }

  async function transcribeCloud(bytes: ArrayBuffer, mime: string): Promise<string> {
    return window.plume.voice.transcribeCloud({ bytes, mime, language: settings?.whisperLanguage ?? 'auto' })
  }

  function transcribeLocal(blob: Blob): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const w = getWorker()
      const onMsg = (ev: MessageEvent<WhisperWorkerOut>): void => {
        const m = ev.data
        if (m.type === 'partial') setPartial(m.text)
        else if (m.type === 'done') {
          w.removeEventListener('message', onMsg)
          resolve(m.text)
        } else if (m.type === 'error') {
          w.removeEventListener('message', onMsg)
          reject(new Error(m.message))
        }
      }
      w.addEventListener('message', onMsg)
      try {
        const audio = await toPcm16k(blob)
        w.postMessage({ type: 'transcribe', audio, language: settings?.whisperLanguage ?? 'auto', model: settings?.whisperModel ?? 'base' } satisfies WhisperWorkerIn, [audio.buffer])
      } catch (e) {
        w.removeEventListener('message', onMsg)
        reject(e)
      }
    })
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <Sheet open={open} onClose={phase === 'recording' || phase === 'transcribing' ? () => undefined : onClose} width={520}>
      <div className="flex flex-col items-center text-center">
        <h3 className="text-[20px] font-semibold tracking-tight">{t('dictate')}</h3>
        <p className="mt-1 text-[14px] text-fg-2">{phase === 'recording' ? `${mm}:${ss}` : t('voiceHint')}</p>

        <div className="my-10 flex h-24 items-center justify-center">
          {phase === 'transcribing' ? (
            <Spinner className="size-7" />
          ) : (
            <button
              onClick={phase === 'recording' ? () => void stop() : () => void start()}
              aria-label={phase === 'recording' ? t('stop') : t('dictate')}
              className={cx('relative flex size-20 items-center justify-center rounded-full transition-colors', phase === 'recording' ? 'bg-danger text-white' : 'bg-fg text-bg hover:opacity-90')}
            >
              {phase === 'recording' && <span className="absolute inset-0 rounded-full bg-danger/40" style={{ transform: `scale(${1 + level * 0.9})`, transition: 'transform 80ms linear' }} />}
              <span className="relative">{phase === 'recording' ? <Square size={24} fill="currentColor" /> : <Mic size={28} strokeWidth={1.8} />}</span>
            </button>
          )}
        </div>

        {progress && progress.total > 0 && (
          <div className="mb-4 w-full">
            <div className="mb-2 text-[12px] text-fg-3">{t('modelDownloading', { mb: Math.round(progress.total / 1024 / 1024) })}</div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-elev">
              <div className="h-full bg-fg transition-[width] duration-200" style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }} />
            </div>
          </div>
        )}

        {(phase === 'transcribing' || phase === 'done') && <p className="selectable min-h-6 max-w-full text-[15px] leading-relaxed text-fg-2">{partial || t('transcribing')}</p>}
        {phase === 'done' && <p className="mt-2 text-[13px] text-fg-3">{t('transcribeDone')}</p>}
        {error && <p className="max-w-[380px] text-[13px] leading-relaxed text-danger">{error}</p>}

        {phase !== 'recording' && phase !== 'transcribing' && (
          <Button variant="ghost" className="mt-6" onClick={onClose}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </Sheet>
  )
}
