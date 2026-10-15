import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Image as ImageIcon, MapPin, Mic, Trash2, X, ArrowUpRight } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import type { Entry, Mood } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { fmtDayLong } from '@/lib/dates'
import { importFile } from '@/lib/media'
import { readingMinutes } from '@/lib/words'
import { marksForDay } from '@/lib/marks'
import { Button, IconButton, Sheet, cx } from '@/components/ui'
import { AttachmentGrid } from '@/components/AttachmentGrid'
import { PlacePicker } from '@/components/PlacePicker'
import { VoiceSheet } from '@/components/VoiceSheet'
import { appleMapsUrl } from '@/components/MapView'
import type { GeoPoint } from '@shared/types'

const MOOD_GLYPH = ['◌', '◔', '◑', '◕', '●']

export function Editor(): JSX.Element {
  const { entries, selectedId, updateEntry, patchEntry, deleteEntry, saving, settings, marks } = useApp()
  const { t, locale, dict } = useI18n()
  const entry = useMemo(() => entries.find((e) => e.id === selectedId), [entries, selectedId])
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [tagDraft, setTagDraft] = useState('')
  const [placeOpen, setPlaceOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(0)
  const [suggest, setSuggest] = useState<{ point: GeoPoint; count: number } | null>(null)
  const [dictationHint, setDictationHint] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [entry?.body])

  useEffect(() => {
    if (entry && !entry.title && !entry.body) bodyRef.current?.focus()
  }, [entry?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return <></>
  const dayMarks = marksForDay(entry.date, marks, entries.filter((e) => e.date === entry.date))
  const paper = settings?.paper ?? 'blank'

  const patch = (p: Partial<Entry>): void => updateEntry({ ...entry, ...p })

  async function addFiles(files: FileList | File[]): Promise<void> {
    const list = Array.from(files)
    if (list.length === 0 || !entry) return
    setImporting((n) => n + list.length)
    const id = entry.id
    const found: GeoPoint[] = []
    let latest: Entry | undefined = entry
    for (const f of list) {
      try {
        const att = await importFile(f)
        // Merge into the latest state: the user may have kept typing while the file imported.
        latest = patchEntry(id, (e) => ({ ...e, attachments: [...e.attachments, att] }))
        if (att.location) found.push(att.location)
      } catch (e) {
        console.error('import failed', f.name, e)
      } finally {
        setImporting((n) => n - 1)
      }
    }
    // Photos carry GPS data: offer it, never apply it silently.
    if (found.length && latest && !latest.location) {
      const point = found[0]
      setSuggest({ point, count: found.length })
      const name = point.name ?? (await window.plume.app.reverseGeocode(point))
      if (name) setSuggest((s) => (s && s.point === point ? { ...s, point: { ...point, name } } : s))
    }
  }

  function dictate(): void {
    if (settings?.transcribeMode === 'system') {
      bodyRef.current?.focus()
      setDictationHint(true)
      setTimeout(() => setDictationHint(false), 6000)
    } else {
      setVoiceOpen(true)
    }
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault()
    setDragging(false)
    void addFiles(e.dataTransfer.files)
  }

  function addTag(): void {
    const tag = tagDraft.trim().replace(/^#/, '')
    if (tag && !entry!.tags.includes(tag)) patch({ tags: [...entry!.tags, tag] })
    setTagDraft('')
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !tagDraft && entry!.tags.length) {
      patch({ tags: entry!.tags.slice(0, -1) })
    }
  }

  return (
    <div
      className="relative h-full overflow-y-auto"
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragging) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <div className="no-drag absolute right-6 top-3 z-20 flex items-center gap-1">
        <span className="mr-2 text-[12px] text-fg-3">{saving ? t('saving') : t('saved')}</span>
        <IconButton label={t('dictate')} onClick={dictate}>
          <Mic size={17} strokeWidth={1.8} />
        </IconButton>
        <IconButton label={t('addPhoto')} onClick={() => fileInput.current?.click()}>
          <ImageIcon size={17} strokeWidth={1.8} />
        </IconButton>
        <IconButton label={t('addPlace')} onClick={() => setPlaceOpen(true)}>
          <MapPin size={17} strokeWidth={1.8} />
        </IconButton>
        <IconButton label={t('deleteEntry')} onClick={() => setConfirmDelete(true)}>
          <Trash2 size={17} strokeWidth={1.8} />
        </IconButton>
      </div>
      <input ref={fileInput} type="file" multiple accept="image/*,video/*,audio/*,.pdf" className="hidden" onChange={(e) => e.target.files && void addFiles(e.target.files)} />

      <article className={cx('selectable journal-font mx-auto w-full max-w-[720px] px-10 pb-32 pt-[88px]', paper === 'ruled' && 'paper-ruled', paper === 'dotted' && 'paper-dotted')}>
        <div className="mb-6 flex items-center gap-4 text-[13px] text-fg-3">
          <label className="relative cursor-pointer font-medium text-fg-2 hover:text-fg">
            {fmtDayLong(entry.date, locale)}
            <input type="date" value={entry.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label={t('today')} />
          </label>
          <span>·</span>
          <span>{t('wordsN', { n: entry.wordCount })}</span>
          {entry.wordCount > 100 && (
            <>
              <span>·</span>
              <span>{t('readingTime', { n: readingMinutes(entry.wordCount) })}</span>
            </>
          )}
          {dayMarks.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 font-medium" style={{ color: m.color }}>
              {m.symbol || <span className="size-2 rounded-full" style={{ background: m.color }} />}
              {m.label}
            </span>
          ))}
        </div>

        <input
          value={entry.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={t('titlePlaceholder')}
          className="mb-4 w-full bg-transparent text-[30px] font-semibold leading-tight tracking-tight placeholder:text-fg-3"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              bodyRef.current?.focus()
            }
          }}
        />
        <textarea ref={bodyRef} value={entry.body} onChange={(e) => patch({ body: e.target.value })} placeholder={t('bodyPlaceholder')} className="editor-body selectable" spellCheck />

        <AnimatePresence>
          {dictationHint && (
            <motion.div className="mt-2 flex items-center gap-2 rounded-xl bg-elev px-4 py-3 text-[13px] text-fg-2" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Mic size={14} />
              {window.plume.app.platform === 'darwin' ? t('systemDictationHintMac') : t('systemDictationHintWin')}
            </motion.div>
          )}
          {suggest && (
            <motion.div className="mt-6 flex items-center gap-4 rounded-2xl border border-line px-5 py-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <MapPin size={18} className="shrink-0 text-fg-2" />
              <p className="flex-1 text-[14px] leading-relaxed text-fg-2">
                {suggest.count > 1
                  ? t('photoLocationFoundMany', { n: suggest.count, name: suggest.point.name ?? `${suggest.point.lat.toFixed(4)}, ${suggest.point.lng.toFixed(4)}` })
                  : t('photoLocationFound', { name: suggest.point.name ?? `${suggest.point.lat.toFixed(4)}, ${suggest.point.lng.toFixed(4)}` })}
              </p>
              <Button size="sm" variant="ghost" onClick={() => setSuggest(null)}>
                {t('notNow')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  patch({ location: suggest.point })
                  setSuggest(null)
                }}
              >
                {t('addIt')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 space-y-8">
          {(entry.attachments.length > 0 || importing > 0) && (
            <section>
              <AttachmentGrid
                items={entry.attachments}
                onRemove={(a) => {
                  patch({ attachments: entry.attachments.filter((x) => x.id !== a.id) })
                  void window.plume.media.remove(a.id)
                }}
              />
              {importing > 0 && <div className="mt-3 text-[12px] text-fg-3">{t('saving')}</div>}
            </section>
          )}

          <section className="flex flex-wrap items-center gap-x-8 gap-y-5 border-t border-line pt-8">
            <div>
              <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('mood')}</div>
              <div className="flex items-center gap-1">
                {([1, 2, 3, 4, 5] as Mood[]).map((m) => (
                  <button
                    key={m}
                    title={dict.moods[m - 1]}
                    aria-label={dict.moods[m - 1]}
                    aria-pressed={entry.mood === m}
                    onClick={() => patch({ mood: entry.mood === m ? undefined : m })}
                    className={cx('flex size-9 items-center justify-center rounded-lg text-[18px] transition-colors', entry.mood === m ? 'bg-fg text-bg' : 'text-fg-3 hover:bg-elev hover:text-fg')}
                  >
                    {MOOD_GLYPH[m - 1]}
                  </button>
                ))}
                {entry.mood && <span className="ml-2 text-[13px] text-fg-2">{dict.moods[entry.mood - 1]}</span>}
              </div>
            </div>

            <div className="min-w-[240px] flex-1">
              <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">{t('tags')}</div>
              <div className="flex min-h-9 flex-wrap items-center gap-1.5">
                {entry.tags.map((tag) => (
                  <span key={tag} className="flex h-7 items-center gap-1 rounded-md bg-elev pl-2.5 pr-1.5 text-[13px]">
                    #{tag}
                    <button onClick={() => patch({ tags: entry.tags.filter((x) => x !== tag) })} className="text-fg-3 hover:text-fg" aria-label={t('remove')}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={onTagKey} onBlur={addTag} placeholder={t('tagsPlaceholder')} className="h-7 min-w-[120px] flex-1 bg-transparent text-[13px]" />
              </div>
            </div>
          </section>

          {entry.location && (
            <section className="flex items-center gap-2 text-[14px] text-fg-2">
              <MapPin size={15} />
              <button onClick={() => setPlaceOpen(true)} className="hover:text-fg">
                {entry.location.name ?? `${entry.location.lat.toFixed(4)}, ${entry.location.lng.toFixed(4)}`}
              </button>
              <button onClick={() => void window.plume.app.openExternal(appleMapsUrl(entry.location!))} title={t('openInAppleMaps')} className="ml-1 flex items-center gap-0.5 text-[12px] text-fg-3 hover:text-fg">
                {t('openInAppleMaps')}
                <ArrowUpRight size={12} />
              </button>
            </section>
          )}
        </div>
      </article>

      <AnimatePresence>
        {dragging && (
          <motion.div className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-fg/40 bg-bg/80 text-[15px] text-fg-2 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {t('dropHint')}
          </motion.div>
        )}
      </AnimatePresence>

      <PlacePicker
        open={placeOpen}
        value={entry.location}
        onClose={() => setPlaceOpen(false)}
        onChange={(p) => {
          patch({ location: p })
          setPlaceOpen(false)
        }}
      />
      <VoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onText={(text, att) => {
          const body = entry.body ? `${entry.body.replace(/\s+$/, '')}\n\n${text}` : text
          patch({ body, attachments: att ? [...entry.attachments, att] : entry.attachments })
        }}
      />
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} width={420}>
        <h3 className="text-[18px] font-semibold tracking-tight">{t('deleteEntry')}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{t('deleteEntryConfirm')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            {t('cancel')}
          </Button>
          <Button variant="primary" className="!bg-danger !text-white" onClick={() => void deleteEntry(entry.id)}>
            {t('delete')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
