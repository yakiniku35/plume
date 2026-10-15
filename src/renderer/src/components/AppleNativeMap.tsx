import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { Plus, Minus } from 'lucide-react'
import type { MapRegion, MapSnapshot } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { cx } from '@/components/ui'
import type { MapViewProps } from './MapView'

/*
 * Real Apple Maps on macOS without a MapKit JS token: the main process asks the bundled
 * Swift helper for MKMapSnapshotter images. Panning drags the current image and re-renders
 * on release; the wheel zooms; a click converts the pixel back to a coordinate.
 */

const toRad = (d: number): number => (d * Math.PI) / 180
const toDeg = (r: number): number => (r * 180) / Math.PI
const merc = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2))
const unmerc = (y: number): number => toDeg(2 * Math.atan(Math.exp(y)) - Math.PI / 2)

function pixelToCoord(px: number, py: number, w: number, h: number, r: MapRegion): { lat: number; lng: number } {
  const top = merc(Math.min(85, r.lat + r.latDelta / 2))
  const bottom = merc(Math.max(-85, r.lat - r.latDelta / 2))
  return { lat: unmerc(top - (py / h) * (top - bottom)), lng: r.lng + (px / w - 0.5) * r.lngDelta }
}

function regionFor(center: { lat: number; lng: number }, zoom: number, w: number, h: number): MapRegion {
  const lngDelta = (360 / 2 ** zoom) * (w / 256)
  return { lat: center.lat, lng: center.lng, lngDelta, latDelta: lngDelta * (h / w) * Math.cos(toRad(center.lat)) }
}

export function AppleNativeMap({ markers, center, zoom = 13, onClick, interactive = true, className }: MapViewProps): JSX.Element {
  const { dark } = useApp()
  const { t } = useI18n()
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [region, setRegion] = useState<MapRegion | null>(null)
  const [snap, setSnap] = useState<MapSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [drag, setDrag] = useState<{ x0: number; y0: number; dx: number; dy: number } | null>(null)
  const reqId = useRef(0)
  const markerKey = JSON.stringify(markers)
  const fitMode = !center && markers.length > 0

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Recentre when the caller moves the focus point (e.g. a search result or "current location").
  useEffect(() => {
    if (center && size.w && size.h) setRegion((r) => regionFor(center, r && !fitMode ? zoomOf(r, size.w) : zoom, size.w, size.h))
  }, [center?.lat, center?.lng, size.w, size.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSnap = useCallback(
    async (r: MapRegion | null) => {
      if (!size.w || !size.h) return
      const id = ++reqId.current
      setLoading(true)
      try {
        const res = await window.plume.maps.snapshot({
          ...(r && !fitMode ? r : {}),
          ...(fitMode ? { fit: true } : {}),
          width: size.w,
          height: size.h,
          dark,
          scale: Math.min(2, window.devicePixelRatio || 1),
          markers: markers.map((m) => ({ lat: m.lat, lng: m.lng }))
        })
        if (id !== reqId.current) return
        setSnap(res)
        // Keep the region object stable when nothing changed, or the effect below would refetch forever.
        if (!r || fitMode) setRegion((prev) => (prev && sameRegion(prev, res.region) ? prev : res.region))
      } catch (e) {
        console.warn('apple map snapshot failed', e)
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    },
    [size.w, size.h, dark, markerKey, fitMode] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // In fit mode the region is an output, not an input, so it must not retrigger the fetch.
  const regionKey = fitMode ? 'fit' : JSON.stringify(region)
  useEffect(() => {
    const t = setTimeout(() => void fetchSnap(fitMode ? null : region), 120)
    return () => clearTimeout(t)
  }, [fetchSnap, regionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    if (!interactive || !region) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 })
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    if (!drag) return
    setDrag({ ...drag, dx: e.clientX - drag.x0, dy: e.clientY - drag.y0 })
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    if (!drag || !region) return
    const moved = Math.hypot(drag.dx, drag.dy) > 4
    setDrag(null)
    if (moved) {
      // Shift the centre by the dragged distance (mercator-correct vertically).
      const c = pixelToCoord(size.w / 2 - drag.dx, size.h / 2 - drag.dy, size.w, size.h, region)
      setRegion({ ...region, lat: c.lat, lng: c.lng })
    } else if (onClick) {
      const rect = e.currentTarget.getBoundingClientRect()
      onClick(pixelToCoord(e.clientX - rect.left, e.clientY - rect.top, size.w, size.h, region))
    }
  }
  function zoomBy(factor: number): void {
    if (!region) return
    setRegion({ ...region, latDelta: clamp(region.latDelta * factor, 0.0008, 150), lngDelta: clamp(region.lngDelta * factor, 0.0008, 300) })
  }
  function onWheel(e: WheelEvent<HTMLDivElement>): void {
    if (!interactive) return
    e.preventDefault()
    zoomBy(2 ** (e.deltaY / 240))
  }

  return (
    <div
      ref={box}
      className={cx('relative select-none overflow-hidden bg-elev', interactive && 'cursor-grab active:cursor-grabbing', className ?? 'size-full')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onWheel={onWheel}
    >
      {snap && (
        <img
          src={snap.src}
          alt=""
          draggable={false}
          className={cx('absolute left-0 top-0 size-full object-cover transition-opacity duration-200', loading ? 'opacity-80' : 'opacity-100')}
          style={{ transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined }}
        />
      )}
      {snap?.points.map(([x, y], i) => (
        <span
          key={i}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-fg shadow-sm"
          style={{ left: x + (drag?.dx ?? 0), top: y + (drag?.dy ?? 0), width: 10 + Math.min(14, (markers[i]?.weight ?? 1) * 2), height: 10 + Math.min(14, (markers[i]?.weight ?? 1) * 2) }}
          title={markers[i]?.label}
        />
      ))}
      {interactive && (
        <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-line bg-bg/90 shadow-sm backdrop-blur">
          <button aria-label={t('zoomIn')} onClick={(e) => { e.stopPropagation(); zoomBy(0.5) }} onPointerDown={(e) => e.stopPropagation()} className="flex size-8 items-center justify-center text-fg-2 hover:text-fg">
            <Plus size={14} />
          </button>
          <button aria-label={t('zoomOut')} onClick={(e) => { e.stopPropagation(); zoomBy(2) }} onPointerDown={(e) => e.stopPropagation()} className="flex size-8 items-center justify-center border-t border-line text-fg-2 hover:text-fg">
            <Minus size={14} />
          </button>
        </div>
      )}
      <span className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-fg-3"> {t('mapsByApple')}</span>
      {loading && !snap && <div className="absolute inset-0 animate-pulse bg-elev" />}
    </div>
  )
}

function sameRegion(a: MapRegion, b: MapRegion): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9 && Math.abs(a.latDelta - b.latDelta) < 1e-9 && Math.abs(a.lngDelta - b.lngDelta) < 1e-9
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
function zoomOf(r: MapRegion, w: number): number {
  return Math.log2((360 / r.lngDelta) * (w / 256))
}
