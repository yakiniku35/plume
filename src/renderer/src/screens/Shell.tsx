import { CalendarDays, ChartNoAxesColumn, Settings as SettingsIcon, Plus, Search } from 'lucide-react'
import { useApp, type View } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { cx, IconButton } from '@/components/ui'
import { Feather } from '@/components/Logo'
import { Timeline } from './Timeline'
import { Editor } from './Editor'
import { Insights } from './Insights'
import { Settings } from './Settings'
import { Home } from './Home'
import { Avatar } from '@/components/Avatar'

export function Shell(): JSX.Element {
  const { view, setView, newEntry, query, setQuery, selectedId, select, user } = useApp()
  const { t } = useI18n()

  const nav: { id: View; label: string; icon: JSX.Element }[] = [
    { id: 'journal', label: t('calendar'), icon: <CalendarDays size={17} strokeWidth={1.8} /> },
    { id: 'insights', label: t('insights'), icon: <ChartNoAxesColumn size={17} strokeWidth={1.8} /> },
    { id: 'settings', label: t('settings'), icon: <SettingsIcon size={17} strokeWidth={1.8} /> }
  ]

  return (
    <div className="flex h-full">
      <aside className="drag flex w-[260px] shrink-0 flex-col border-r border-line bg-[var(--bg-sidebar)] pt-[52px]">
        <div className="no-drag flex items-center justify-between px-5 pb-4">
          <div className="flex items-center gap-2 text-fg">
            <Feather size={20} />
            <span className="text-[15px] font-semibold tracking-tight">Plume</span>
          </div>
          <IconButton label={t('newEntry')} onClick={() => newEntry()}>
            <Plus size={18} strokeWidth={1.8} />
          </IconButton>
        </div>
        <nav className="no-drag space-y-0.5 px-3">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setView(n.id)
                if (n.id === 'journal') select(null)
              }}
              className={cx('flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors duration-150', view === n.id && (n.id !== 'journal' || !selectedId) ? 'bg-fg/[0.07] font-medium text-fg' : 'text-fg-2 hover:bg-fg/[0.04] hover:text-fg')}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>
        {view === 'journal' && (
          <div className="no-drag mt-5 flex min-h-0 flex-1 flex-col">
            <div className="relative mx-3 mb-2">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
              <input
                id="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-9 w-full rounded-lg bg-fg/[0.05] pl-8 pr-3 text-[13px] transition-colors focus:bg-fg/[0.08]"
              />
            </div>
            <Timeline />
          </div>
        )}
        <button onClick={() => setView('settings')} className="no-drag mt-auto flex items-center gap-2.5 border-t border-line px-5 py-3.5 text-left hover:bg-fg/[0.04]">
          <Avatar avatar={user?.avatar} name={user?.name} size={28} />
          <span className="truncate text-[13px] text-fg-2">{user?.name}</span>
        </button>
      </aside>
      <main className="relative min-w-0 flex-1 bg-bg">
        <div className="drag absolute inset-x-0 top-0 z-10 h-[52px] bg-gradient-to-b from-bg via-bg/85 to-transparent" />
        {view === 'journal' && (selectedId ? <Editor key={selectedId} /> : <Home />)}
        {view === 'insights' && <Insights />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  )
}
