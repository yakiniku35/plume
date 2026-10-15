import { useEffect, useRef, useState } from 'react'
import { LocateFixed, ArrowUpRight, Search } from 'lucide-react'
import type { GeoPoint, PlaceResult } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Button, Input, Sheet, Spinner } from '@/components/ui'
import { MapView, appleMapsUrl } from '@/components/MapView'

export function PlacePicker({ open, value, onClose, onChange }: { open: boolean; value?: GeoPoint; onClose: () => void; onChange: (p: GeoPoint | undefined) => void }): JSX.Element {
  const { t } = useI18n()
  const { nativeMaps, settings } = useApp()
  const canSearch = nativeMaps || Boolean(settings?.appleMapsTokenSet)
  const [draft, setDraft] = useState<GeoPoint | undefined>(value)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDraft(value)
      setError('')
      setQuery('')
      setResults(null)
    }
  }, [open, value])

  function onQuery(q: string): void {
    setQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) return setResults(null)
    searchTimer.current = setTimeout(async () => {
      try {
        setResults(await window.plume.maps.search(q, draft))
      } catch {
        setResults([])
      }
    }, 350)
  }

  async function setPoint(p: { lat: number; lng: number }): Promise<void> {
    setDraft({ ...p, name: draft?.name })
    const name = await window.plume.app.reverseGeocode(p)
    setDraft((cur) => (cur && cur.lat === p.lat && cur.lng === p.lng && !cur.name ? { ...cur, name: name ?? undefined } : cur))
  }

  function locate(): void {
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        void setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocating(false)
        setError(t('locationUnavailable'))
      },
      { timeout: 8000, maximumAge: 60_000 }
    )
  }

  return (
    <Sheet open={open} onClose={onClose} width={680}>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[20px] font-semibold tracking-tight">{t('place')}</h3>
        <Button size="sm" variant="ghost" icon={locating ? <Spinner /> : <LocateFixed size={15} />} onClick={locate} disabled={locating}>
          {t('useCurrentLocation')}
        </Button>
      </div>
      {canSearch && (
        <div className="relative mb-3">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
          <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={t('searchPlaces')} className="pl-10" autoFocus />
          {results && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-line bg-bg py-1 shadow-[var(--shadow)]">
              {results.length === 0 && <li className="px-4 py-2 text-[13px] text-fg-3">{t('noPlacesFound')}</li>}
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    className="flex w-full flex-col px-4 py-2 text-left hover:bg-elev"
                    onClick={() => {
                      setDraft({ lat: r.lat, lng: r.lng, name: r.name })
                      setQuery(r.name)
                      setResults(null)
                    }}
                  >
                    <span className="text-[14px]">{r.name}</span>
                    {r.address && <span className="text-[12px] text-fg-3">{r.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="h-[360px] overflow-hidden rounded-2xl border border-line">
        {open && <MapView markers={draft ? [draft] : []} center={draft} zoom={13} onClick={(p) => void setPoint(p)} />}
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px] text-fg-3">
        <span>{error || t('tapMap')}</span>
        {draft && (
          <button onClick={() => void window.plume.app.openExternal(appleMapsUrl(draft))} className="flex items-center gap-0.5 hover:text-fg">
            {t('openInAppleMaps')}
            <ArrowUpRight size={12} />
          </button>
        )}
      </div>
      <div className="mt-5">
        <Input value={draft?.name ?? ''} onChange={(e) => setDraft(draft ? { ...draft, name: e.target.value } : undefined)} placeholder={t('placeNamePlaceholder')} disabled={!draft} />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="danger" onClick={() => onChange(undefined)} disabled={!value}>
          {t('removePlace')}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={() => onChange(draft)} disabled={!draft}>
            {t('done')}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
