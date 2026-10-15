import { useState } from 'react'
import { Play, FileText, Folder, X, MapPin } from 'lucide-react'
import type { Attachment } from '@shared/types'
import { useI18n } from '@/lib/i18n'
import { fmtBytes, fmtDuration } from '@/lib/media'
import { Sheet, cx } from '@/components/ui'

export function AttachmentGrid({ items, onRemove }: { items: Attachment[]; onRemove: (a: Attachment) => void }): JSX.Element | null {
  const { t } = useI18n()
  const [open, setOpen] = useState<Attachment | null>(null)
  if (items.length === 0) return null
  const visual = items.filter((a) => a.kind === 'image' || a.kind === 'video')
  const audio = items.filter((a) => a.kind === 'audio')
  const files = items.filter((a) => a.kind === 'file')

  return (
    <div className="space-y-4">
      {visual.length > 0 && (
        <div className={cx('grid gap-2', visual.length === 1 ? 'grid-cols-1' : visual.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {visual.map((a) => (
            <Tile key={a.id} att={a} onOpen={() => setOpen(a)} onRemove={() => onRemove(a)} single={visual.length === 1} />
          ))}
        </div>
      )}
      {audio.map((a) => (
        <div key={a.id} className="group flex items-center gap-3 rounded-xl border border-line p-3">
          <audio controls preload="metadata" src={window.plume.media.url(a.id)} className="h-9 flex-1" />
          <span className="text-[12px] text-fg-3">{fmtDuration(a.durationSec)}</span>
          <RemoveButton onClick={() => onRemove(a)} label={t('remove')} />
        </div>
      ))}
      {files.map((a) => (
        <div key={a.id} className="group flex items-center gap-3 rounded-xl border border-line p-3">
          <FileText size={18} className="text-fg-2" />
          <span className="min-w-0 flex-1 truncate text-[14px]">{a.name}</span>
          <span className="text-[12px] text-fg-3">{fmtBytes(a.size)}</span>
          <button onClick={() => window.plume.media.revealInFinder(a.id)} title={t('showInFinder')} className="text-fg-3 hover:text-fg">
            <Folder size={16} />
          </button>
          <RemoveButton onClick={() => onRemove(a)} label={t('remove')} />
        </div>
      ))}
      <Sheet open={open !== null} onClose={() => setOpen(null)} width={1100}>
        {open && (
          <div className="flex flex-col items-center gap-4">
            {open.kind === 'video' ? (
              <video controls autoPlay src={window.plume.media.url(open.id)} className="max-h-[70vh] rounded-xl" />
            ) : (
              <img src={window.plume.media.url(open.id)} alt={open.name} className="max-h-[70vh] rounded-xl object-contain" />
            )}
            <div className="flex w-full items-center gap-4 text-[13px] text-fg-3">
              <span className="truncate">{open.name}</span>
              <span>{fmtBytes(open.size)}</span>
              {open.width && (
                <span>
                  {open.width}×{open.height}
                </span>
              )}
              {open.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {open.location.name ?? `${open.location.lat.toFixed(3)}, ${open.location.lng.toFixed(3)}`}
                </span>
              )}
              <button onClick={() => window.plume.media.revealInFinder(open.id)} className="ml-auto flex items-center gap-1.5 text-fg-2 hover:text-fg">
                <Folder size={14} />
                {t('showInFinder')}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Tile({ att, onOpen, onRemove, single }: { att: Attachment; onOpen: () => void; onRemove: () => void; single: boolean }): JSX.Element {
  const { t } = useI18n()
  const [broken, setBroken] = useState(false)
  return (
    <div className={cx('group relative overflow-hidden rounded-xl bg-elev', single ? 'aspect-[3/2] max-h-[420px]' : 'aspect-square')}>
      <button onClick={onOpen} className="block size-full">
        {broken ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-fg-3">
            <FileText size={22} />
            <span className="px-3 text-[12px]">{att.name}</span>
          </div>
        ) : (
          <img src={window.plume.media.thumbUrl(att.id)} alt={att.name} loading="lazy" onError={() => setBroken(true)} className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        )}
        {att.kind === 'video' && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
            <Play size={10} fill="currentColor" />
            {fmtDuration(att.durationSec)}
          </span>
        )}
      </button>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <RemoveButton onClick={onRemove} label={t('remove')} dark />
      </div>
    </div>
  )
}

function RemoveButton({ onClick, label, dark }: { onClick: () => void; label: string; dark?: boolean }): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx('flex size-7 items-center justify-center rounded-full transition-colors', dark ? 'bg-black/60 text-white hover:bg-black/80' : 'text-fg-3 hover:bg-elev hover:text-fg')}
    >
      <X size={14} />
    </button>
  )
}
