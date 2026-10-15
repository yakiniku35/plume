/** Microphone recording and PCM conversion for Whisper (16 kHz mono Float32). */

export interface Recorder {
  stop(): Promise<{ blob: Blob; mime: string; durationSec: number }>
  level(): number
  stream: MediaStream
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  src.connect(analyser)
  const buf = new Uint8Array(analyser.fftSize)
  const started = performance.now()
  rec.start(250)
  return {
    stream,
    level() {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += (v - 128) ** 2
      return Math.min(1, Math.sqrt(sum / buf.length) / 40)
    },
    stop() {
      return new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
          const type = rec.mimeType || mime || 'audio/webm'
          resolve({ blob: new Blob(chunks, { type }), mime: type.split(';')[0], durationSec: (performance.now() - started) / 1000 })
        }
        rec.stop()
      })
    }
  }
}

export async function toPcm16k(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16_000 })
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    if (decoded.sampleRate === 16_000 && decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice()
    const length = Math.ceil(decoded.duration * 16_000)
    const off = new OfflineAudioContext(1, length, 16_000)
    const s = off.createBufferSource()
    s.buffer = decoded
    s.connect(off.destination)
    s.start()
    return (await off.startRendering()).getChannelData(0).slice()
  } finally {
    void ctx.close()
  }
}
