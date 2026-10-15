import { useEffect, useState } from 'react'
import { LocateFixed, ArrowUpRight } from 'lucide-react'
import type { GeoPoint } from '@shared/types'
import { useI18n } from '@/lib/i18n'
import { Button, Input, Sheet, Spinner } from '@/components/ui'
import { MapView, appleMapsUrl } from '@/components/MapView'

export function PlacePicker({ open, value, onClose, onChange }: { open: boolean; value?: GeoPoint; onClose: () => void; onChange: (p: GeoPoint | undefined) => void }): JSX.Element {
  const { t } = useI18n()
  const [draft, setDraft] = useState<GeoPoint | undefined>(value)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDraft(value)
      setError('')
    }
  }, [open, value])

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
