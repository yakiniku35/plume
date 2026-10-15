import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { GeoPoint } from '@shared/types'
import { useApp } from '@/lib/store'

export interface MapMarker extends GeoPoint {
  label?: string
  weight?: number
}

export interface MapViewProps {
  markers: MapMarker[]
  /** Focus point; when omitted the view fits all markers (or shows a world view). */
  center?: GeoPoint
  zoom?: number
  onClick?: (p: { lat: number; lng: number }) => void
  interactive?: boolean
  className?: string
}

/** Apple Maps (MapKit JS) when a token is configured, otherwise a clean OpenStreetMap basemap via Leaflet. */
export function MapView(props: MapViewProps): JSX.Element {
  const { settings } = useApp()
  return settings?.appleMapsTokenSet ? <AppleMap {...props} /> : <LeafletMap {...props} />
}

export function appleMapsUrl(p: GeoPoint): string {
  const q = encodeURIComponent(p.name ?? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`)
  return `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${q}&z=15`
}

/* ---------------- Leaflet + CARTO Positron / Dark Matter ---------------- */

const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
const tileUrl = (dark: boolean): string => `https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`

function Resize(): null {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 260)
    return () => clearTimeout(t)
  }, [map])
  return null
}
function Clicks({ onClick }: { onClick?: (p: { lat: number; lng: number }) => void }): null {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}
function Focus({ center, zoom }: { center?: GeoPoint; zoom: number }): null {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), zoom), { duration: 0.6 })
  }, [center?.lat, center?.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function LeafletMap({ markers, center, zoom = 13, onClick, interactive = true, className }: MapViewProps): JSX.Element {
  const { dark } = useApp()
  const bounds = !center && markers.length > 0 ? markers.map((m) => [m.lat, m.lng] as [number, number]) : undefined
  const c: [number, number] = center ? [center.lat, center.lng] : [25.04, 121.56]
  return (
    <MapContainer
      key={bounds ? 'b' : 'c'}
      center={bounds ? undefined : c}
      zoom={bounds ? undefined : center ? zoom : 3}
      bounds={bounds}
      boundsOptions={{ padding: [40, 40], maxZoom: 12 }}
      className={className ?? 'size-full'}
      zoomControl={false}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
    >
      <TileLayer key={dark ? 'dark' : 'light'} url={tileUrl(dark)} attribution={CARTO_ATTR} subdomains="abcd" maxZoom={19} />
      <Resize />
      <Clicks onClick={onClick} />
      <Focus center={center} zoom={zoom} />
      {markers.map((m, i) => (
        <CircleMarker key={i} center={[m.lat, m.lng]} radius={6 + Math.min(10, (m.weight ?? 1) * 1.5)} pathOptions={{ color: 'var(--bg)', fillColor: 'var(--fg)', fillOpacity: 0.9, weight: 2 }}>
          {m.label && <Tooltip>{m.label}</Tooltip>}
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

/* ---------------- Apple MapKit JS ---------------- */

let mapkitReady: Promise<void> | null = null
function loadMapKit(): Promise<void> {
  if (!mapkitReady) {
    mapkitReady = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js'
      s.crossOrigin = 'anonymous'
      s.onload = () => {
        mapkit.init({
          authorizationCallback: (done) => {
            void window.plume.settings.getAppleMapsToken().then(done)
          },
          language: document.documentElement.lang || 'en'
        })
        resolve()
      }
      s.onerror = () => {
        mapkitReady = null
        reject(new Error('mapkit_load_failed'))
      }
      document.head.appendChild(s)
    })
  }
  return mapkitReady
}

function AppleMap({ markers, center, zoom = 13, onClick, interactive = true, className }: MapViewProps): JSX.Element {
  const { dark } = useApp()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<mapkit.Map | null>(null)
  const [failed, setFailed] = useState(false)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  useEffect(() => {
    let cancelled = false
    void loadMapKit()
      .then(() => {
        if (cancelled || !el.current) return
        const m = new mapkit.Map(el.current, {
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsZoomControl: false,
          showsMapTypeControl: false,
          showsScale: mapkit.FeatureVisibility.Hidden,
          isScrollEnabled: interactive,
          isZoomEnabled: interactive,
          mapType: 'mutedStandard'
        })
        m.addEventListener('single-tap', (e) => {
          const c = m.convertPointOnPageToCoordinate(new DOMPoint(e.pointOnPage.x, e.pointOnPage.y))
          onClickRef.current?.({ lat: c.latitude, lng: c.longitude })
        })
        map.current = m
        setFailed(false)
        sync()
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      map.current?.destroy()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function sync(): void {
    const m = map.current
    if (!m) return
    m.colorScheme = dark ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light
    m.removeAnnotations(m.annotations)
    const anns = markers.map((p) => new mapkit.MarkerAnnotation(new mapkit.Coordinate(p.lat, p.lng), { color: dark ? '#f2f2f0' : '#111111', title: p.label, displayPriority: 1000 }))
    anns.forEach((a) => m.addAnnotation(a))
    if (center) {
      const span = 360 / 2 ** zoom
      m.setRegionAnimated(new mapkit.CoordinateRegion(new mapkit.Coordinate(center.lat, center.lng), new mapkit.CoordinateSpan(span, span * 1.5)), true)
    } else if (anns.length) {
      m.showItems(anns, { animate: false, padding: new mapkit.Padding(40, 40, 40, 40), minimumSpan: new mapkit.CoordinateSpan(0.5, 0.5) })
    } else {
      m.setRegionAnimated(new mapkit.CoordinateRegion(new mapkit.Coordinate(25, 121), new mapkit.CoordinateSpan(60, 90)), false)
    }
  }
  // Insights rebuilds the markers array on every render; compare by content so annotations are not churned.
  const markerKey = JSON.stringify(markers)
  useEffect(sync, [markerKey, center?.lat, center?.lng, zoom, dark]) // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <LeafletMap markers={markers} center={center} zoom={zoom} onClick={onClick} interactive={interactive} className={className} />
  return <div ref={el} className={className ?? 'size-full'} />
}
