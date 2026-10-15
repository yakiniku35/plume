import { app } from 'electron'
import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { MapSnapshot, MapSnapshotRequest, PlaceResult } from '@shared/types'

/** Bridge to the bundled Swift helper (native/plume-maps) that renders Apple Maps on macOS. */

function helperPath(): string {
  return app.isPackaged ? join(process.resourcesPath, 'plume-maps') : join(app.getAppPath(), 'resources', 'plume-maps')
}

export function nativeMapsAvailable(): boolean {
  return process.platform === 'darwin' && existsSync(helperPath())
}

function run<T>(command: 'snapshot' | 'search' | 'reverse', payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile(helperPath(), [command, JSON.stringify(payload)], { maxBuffer: 32 * 1024 * 1024, timeout: 25_000 }, (err, stdout) => {
      let parsed: (T & { error?: string }) | undefined
      try {
        parsed = JSON.parse(stdout.toString()) as T & { error?: string }
      } catch {
        /* no JSON */
      }
      if (parsed?.error) return reject(new Error(`MAPS_${parsed.error}`))
      if (err && !parsed) return reject(new Error(`MAPS_HELPER: ${err.message}`))
      if (!parsed) return reject(new Error('MAPS_HELPER: empty response'))
      resolve(parsed)
    })
  })
}

const cache = new Map<string, MapSnapshot>()
const CACHE_MAX = 48

export async function snapshot(req: MapSnapshotRequest): Promise<MapSnapshot> {
  const key = JSON.stringify(req)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const raw = await run<{ png: string; points: [number, number][]; region: MapSnapshot['region'] }>('snapshot', req)
  const snap: MapSnapshot = { src: `data:image/png;base64,${raw.png}`, points: raw.points, region: raw.region }
  cache.set(key, snap)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
  return snap
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  const res = await run<{ results: PlaceResult[] }>('search', { q, lat: near?.lat, lng: near?.lng })
  return res.results
}

export async function reverseNative(lat: number, lng: number): Promise<string | null> {
  const res = await run<{ name: string | null }>('reverse', { lat, lng })
  return res.name ?? null
}
