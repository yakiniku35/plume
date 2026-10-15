import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { CacheInfo, MigrationProgress, StorageProvider } from '@shared/types'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { fmtShort } from '@/lib/dates'
import { fmtBytes } from '@/lib/media'
import { FONT_PRESETS, fontStack } from '@/lib/fonts'
import { Type } from 'lucide-react'
import { AvatarEditor } from '@/components/AvatarEditor'
import { Button, Card, Choice, ErrorText, Field, Input, SectionTitle, Segmented, Spinner } from '@/components/ui'
import { errorMessage } from './Welcome'

const VERSION = '0.1.0'

export function Settings(): JSX.Element {
  const { user, settings, storage, logout, setSettings, setOpenaiKey, setAppleMapsToken, pickFont, setStorage, refreshStorage, refreshEntries, updateProfile, pickAvatarImage } = useApp()
  const { t, locale } = useI18n()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [openai, setOpenai] = useState('')
  const [mapToken, setMapToken] = useState('')
  const [fontName, setFontName] = useState('')
  const [name, setName] = useState('')
  useEffect(() => setName(user?.name ?? ''), [user?.name])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cache, setCache] = useState<CacheInfo | null>(null)
  const [migration, setMigration] = useState<MigrationProgress | null>(null)

  useEffect(() => {
    setClientId(storage?.gdrive.clientId ?? '')
  }, [storage?.gdrive.clientId])
  useEffect(() => {
    void window.plume.storage.cacheInfo().then(setCache)
    return window.plume.storage.onMigrateProgress(setMigration)
  }, [])

  if (!settings || !storage || !user) return <></>

  async function run(key: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(key)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e, t))
    } finally {
      setBusy(null)
    }
  }

  async function chooseProvider(p: StorageProvider): Promise<void> {
    if (p === storage!.provider) return
    if (p === 'gdrive' && !storage!.gdrive.connected) {
      setError(storage!.gdrive.clientId && storage!.gdrive.clientSecretSet ? t('errGdriveReauth') : t('errGdriveConfig'))
      return
    }
    await run('provider', async () => {
      await setStorage({ provider: p })
    })
  }

  async function migrate(to: StorageProvider): Promise<void> {
    await run('migrate', async () => {
      setMigration({ done: 0, total: 0, failed: [] })
      const res = await window.plume.storage.migrate(to)
      setMigration(res)
      await refreshStorage()
      await refreshEntries()
      setCache(await window.plume.storage.cacheInfo())
    })
  }

  const otherProvider: StorageProvider = storage.provider === 'local' ? 'gdrive' : 'local'
  const providerLabel = (p: StorageProvider): string => (p === 'local' ? t('storageLocal') : t('storageGdrive'))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[680px] px-10 pb-24 pt-[72px]">
        <h1 className="mb-8 text-[30px] font-semibold tracking-tight">{t('settings')}</h1>
        <div className="space-y-5">
          <Card>
            <SectionTitle>{t('account')}</SectionTitle>
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0 flex-1">
                <Field label={t('displayName')}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== user.name && void updateProfile({ name })} />
                </Field>
                <div className="mt-2 text-[13px] text-fg-2">{user.email}</div>
                <div className="mt-0.5 text-[12px] text-fg-3">{t('memberSince', { date: fmtShort(user.createdAt, locale) })}</div>
              </div>
              <Button onClick={() => void logout()}>{t('signOut')}</Button>
            </div>
            <div className="mt-6 border-t border-line pt-6">
              <div className="mb-4 text-[13px] font-medium text-fg-2">{t('avatar')}</div>
              <AvatarEditor value={user.avatar} onChange={(a) => void updateProfile({ avatar: a })} onUpload={() => void pickAvatarImage()} />
            </div>
          </Card>

          <Card>
            <SectionTitle>{t('appearance')}</SectionTitle>
            <div className="space-y-5">
              <Row label={t('theme')}>
                <Segmented
                  value={settings.theme}
                  onChange={(v) => void setSettings({ theme: v })}
                  options={[
                    { value: 'system', label: t('themeSystem') },
                    { value: 'light', label: t('themeLight') },
                    { value: 'dark', label: t('themeDark') }
                  ]}
                />
              </Row>
              <Row label={t('paper')}>
                <Segmented
                  value={settings.paper}
                  onChange={(v) => void setSettings({ paper: v })}
                  options={[
                    { value: 'blank', label: t('paperBlank') },
                    { value: 'ruled', label: t('paperRuled') },
                    { value: 'dotted', label: t('paperDotted') }
                  ]}
                />
              </Row>
              <Row label={t('language')}>
                <Segmented
                  value={settings.locale}
                  onChange={(v) => void setSettings({ locale: v })}
                  options={[
                    { value: 'system', label: t('langSystem') },
                    { value: 'en', label: 'English' },
                    { value: 'zh-Hans', label: '简体中文' },
                    { value: 'zh-Hant', label: '繁體中文' }
                  ]}
                />
              </Row>
            </div>
          </Card>

          <Card>
            <SectionTitle>{t('font')}</SectionTitle>
            <p className="mb-5 text-[14px] leading-relaxed text-fg-2">{t('fontIntro')}</p>
            <div className="flex flex-wrap gap-2">
              {FONT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => void setSettings({ fontFamily: p.id })}
                  aria-pressed={settings.fontFamily === p.id}
                  style={{ fontFamily: p.stack }}
                  className={`no-drag h-10 rounded-xl border px-4 text-[15px] transition-colors ${settings.fontFamily === p.id ? 'border-fg' : 'border-line hover:border-line-strong'}`}
                >
                  {p.label}
                </button>
              ))}
              {settings.customFontFile && (
                <button
                  onClick={() => void setSettings({ fontFamily: 'custom' })}
                  aria-pressed={settings.fontFamily === 'custom'}
                  style={{ fontFamily: fontStack({ fontFamily: 'custom', customFontFile: settings.customFontFile }) }}
                  className={`no-drag h-10 rounded-xl border px-4 text-[15px] transition-colors ${settings.fontFamily === 'custom' ? 'border-fg' : 'border-line hover:border-line-strong'}`}
                >
                  {settings.customFontName ?? t('customFont')}
                </button>
              )}
            </div>
            <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
              <Input
                value={fontName}
                onChange={(e) => setFontName(e.target.value)}
                placeholder={t('installedFontPlaceholder')}
                aria-label={t('installedFont')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && fontName.trim()) {
                    void setSettings({ fontFamily: fontName.trim() })
                    setFontName('')
                  }
                }}
                onBlur={() => {
                  if (fontName.trim()) {
                    void setSettings({ fontFamily: fontName.trim() })
                    setFontName('')
                  }
                }}
              />
              <Button icon={<Type size={15} />} onClick={() => void pickFont()}>
                {t('importFont')}
              </Button>
            </div>
            <p className="mt-5 rounded-xl bg-elev px-5 py-4 text-[17px] leading-relaxed" style={{ fontFamily: fontStack(settings) }}>
              {t('fontPreview')}
            </p>
          </Card>

          <Card>
            <SectionTitle>{t('storage')}</SectionTitle>
            <p className="mb-5 text-[14px] leading-relaxed text-fg-2">{t('storageIntro')}</p>
            <div className="space-y-2">
              <Choice selected={storage.provider === 'local'} title={t('storageLocal')} desc={t('storageLocalDesc')} onClick={() => void chooseProvider('local')} />
              <Choice selected={storage.provider === 'gdrive'} title={t('storageGdrive')} desc={t('storageGdriveDesc')} onClick={() => void chooseProvider('gdrive')} />
            </div>

            <div className="mt-6 space-y-5 border-t border-line pt-6">
              <Field label={t('folder')}>
                <div className="flex gap-2">
                  <Input value={storage.localRoot} readOnly className="flex-1 text-fg-2" />
                  <Button
                    icon={<FolderOpen size={15} />}
                    onClick={() =>
                      void run('folder', async () => {
                        const p = await window.plume.storage.pickFolder()
                        if (p) await setStorage({ localRoot: p })
                      })
                    }
                  >
                    {t('chooseFolder')}
                  </Button>
                </div>
              </Field>

              <div>
                <div className="mb-2 text-[13px] font-medium text-fg-2">{t('gdriveSetup')}</div>
                <p className="mb-4 text-[12px] leading-relaxed text-fg-3">
                  {t('gdriveSetupHelp')}{' '}
                  <button className="underline underline-offset-2 hover:text-fg" onClick={() => void window.plume.app.openExternal('https://console.cloud.google.com/apis/credentials')}>
                    console.cloud.google.com
                  </button>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={t('clientId')} onBlur={() => clientId !== storage.gdrive.clientId && void setStorage({ gdrive: { clientId } })} />
                  <Input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={storage.gdrive.clientSecretSet ? '••••••••••••' : t('clientSecret')}
                    onBlur={() => {
                      if (clientSecret) {
                        void setStorage({ gdrive: { clientSecret } })
                        setClientSecret('')
                      }
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[13px] text-fg-2">{storage.gdrive.connected ? t('connectedAs', { email: storage.gdrive.email ?? 'Google' }) : t('notConnected')}</span>
                  {storage.gdrive.connected ? (
                    <Button size="sm" onClick={() => void run('gdrive', async () => { await window.plume.storage.gdriveDisconnect(); await refreshStorage() })}>
                      {t('disconnect')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" disabled={busy === 'gdrive'} icon={busy === 'gdrive' ? <Spinner /> : undefined} onClick={() => void run('gdrive', async () => { await window.plume.storage.gdriveConnect(); await refreshStorage() })}>
                      {t('connect')}
                    </Button>
                  )}
                </div>
              </div>

              {(storage.provider === 'gdrive' || storage.gdrive.connected) && (
                <div className="flex items-center justify-between rounded-xl bg-elev px-4 py-3">
                  <span className="text-[13px] text-fg-2">
                    {migration && busy === 'migrate'
                      ? t('migrating', { done: migration.done, total: migration.total })
                      : migration && migration.failed.length
                        ? t('migrateFailed', { n: migration.failed.length })
                        : migration && migration.total > 0
                          ? t('migrateDone')
                          : t('migrate', { provider: providerLabel(otherProvider) })}
                  </span>
                  <Button size="sm" disabled={busy === 'migrate'} onClick={() => void migrate(otherProvider)}>
                    {t('migrate', { provider: providerLabel(otherProvider) })}
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-fg-2">{t('cache')}</div>
                  <div className="mt-0.5 text-[12px] text-fg-3">
                    {t('cacheDesc')} {cache ? `${fmtBytes(cache.originalsBytes)} · ${t('thumbnails')} ${fmtBytes(cache.thumbsBytes)}` : ''}
                  </div>
                </div>
                <Button size="sm" onClick={() => void run('cache', async () => setCache(await window.plume.storage.clearCache()))}>
                  {t('clearCache')}
                </Button>
              </div>
            </div>
            <ErrorText>{error}</ErrorText>
          </Card>

          <Card>
            <SectionTitle>{t('voiceSettings')}</SectionTitle>
            <div className="space-y-2">
              <Choice selected={settings.transcribeMode === 'system'} title={t('transcribeSystem')} desc={t('transcribeSystemDesc')} onClick={() => void setSettings({ transcribeMode: 'system' })} />
              <Choice selected={settings.transcribeMode === 'local'} title={t('transcribeLocal')} desc={t('transcribeLocalDesc')} onClick={() => void setSettings({ transcribeMode: 'local' })} />
              <Choice selected={settings.transcribeMode === 'cloud'} title={t('transcribeCloud')} desc={t('transcribeCloudDesc')} onClick={() => void setSettings({ transcribeMode: 'cloud' })} />
            </div>
            <div className="mt-6 space-y-5 border-t border-line pt-6">
              <Row label={t('whisperModel')}>
                <Segmented
                  value={settings.whisperModel}
                  onChange={(v) => void setSettings({ whisperModel: v })}
                  options={[
                    { value: 'tiny', label: t('whisperTiny') },
                    { value: 'base', label: t('whisperBase') },
                    { value: 'small', label: t('whisperSmall') }
                  ]}
                />
              </Row>
              <Row label={t('whisperLanguage')}>
                <Segmented
                  value={settings.whisperLanguage}
                  onChange={(v) => void setSettings({ whisperLanguage: v })}
                  options={[
                    { value: 'auto', label: t('langAuto') },
                    { value: 'zh', label: '中文' },
                    { value: 'en', label: 'English' },
                    { value: 'ja', label: '日本語' }
                  ]}
                />
              </Row>
              <Field label={t('openaiKey')} hint={settings.openaiKeySet ? t('openaiKeySet') : undefined}>
                <Input
                  type="password"
                  value={openai}
                  onChange={(e) => setOpenai(e.target.value)}
                  placeholder={settings.openaiKeySet ? '••••••••••••' : t('openaiKeyPlaceholder')}
                  onBlur={() => {
                    if (openai) {
                      void setOpenaiKey(openai)
                      setOpenai('')
                    }
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle>{t('maps')}</SectionTitle>
            <p className="mb-4 text-[13px] leading-relaxed text-fg-2">
              {t('appleMapsHelp')}{' '}
              <button className="underline underline-offset-2 hover:text-fg" onClick={() => void window.plume.app.openExternal('https://developer.apple.com/account/resources/services/maps-tokens')}>
                developer.apple.com
              </button>
            </p>
            <Field label={t('appleMapsToken')} hint={settings.appleMapsTokenSet ? t('appleMapsTokenSet') : t('appleMapsTokenMissing')}>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={mapToken}
                  onChange={(e) => setMapToken(e.target.value)}
                  placeholder={settings.appleMapsTokenSet ? '••••••••••••' : 'eyJ…'}
                  onBlur={() => {
                    if (mapToken) {
                      void setAppleMapsToken(mapToken)
                      setMapToken('')
                    }
                  }}
                />
                {settings.appleMapsTokenSet && (
                  <Button onClick={() => void setAppleMapsToken('')}>{t('removeToken')}</Button>
                )}
              </div>
            </Field>
          </Card>

          <Card>
            <SectionTitle>{t('about')}</SectionTitle>
            <p className="text-[14px] leading-relaxed text-fg-2">{t('aboutBody')}</p>
            <p className="mt-3 text-[12px] text-fg-3">
              {t('version')} {VERSION}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-[14px]">{label}</span>
      {children}
    </div>
  )
}
