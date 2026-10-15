/** Reverse geocode with OpenStreetMap Nominatim. Best effort; returns null on any failure. */
const cache = new Map<string, string | null>()

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  if (cache.has(key)) return cache.get(key) ?? null
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=en,zh`
    const res = await fetch(url, { headers: { 'User-Agent': 'Plume Journal/0.1 (desktop app)' }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(String(res.status))
    const json = (await res.json()) as { address?: Record<string, string>; name?: string }
    const a = json.address ?? {}
    const parts = [a.neighbourhood ?? a.suburb ?? a.quarter, a.city ?? a.town ?? a.village ?? a.county, a.country].filter(Boolean)
    const name = parts.length ? parts.slice(0, 2).join(', ') : (json.name ?? null)
    cache.set(key, name)
    return name
  } catch {
    cache.set(key, null)
    return null
  }
}
