import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { useApp } from '@/lib/store'
import { useI18n, type TKey } from '@/lib/i18n'
import { Button, ErrorText, Field, Input } from '@/components/ui'
import { Feather } from '@/components/Logo'

const errKey: Record<string, TKey> = {
  EMAIL_TAKEN: 'errEmailTaken',
  INVALID_CREDENTIALS: 'errInvalidCredentials',
  WEAK_PASSWORD: 'errWeakPassword',
  INVALID_EMAIL: 'errInvalidEmail'
}

export function errorMessage(e: unknown, t: (k: TKey) => string): string {
  const msg = e instanceof Error ? e.message : String(e)
  const code = Object.keys(errKey).find((c) => msg.includes(c))
  if (code) return t(errKey[code])
  if (msg.includes('GDRIVE_CONFIG_MISSING')) return t('errGdriveConfig')
  if (msg.includes('GDRIVE_REAUTH_REQUIRED') || msg.includes('GDRIVE_NOT_CONNECTED')) return t('errGdriveReauth')
  if (msg.includes('OPENAI_KEY')) return t('errOpenaiKey')
  if (msg.includes('NETWORK') || msg.includes('fetch')) return t('errNetwork')
  return t('errGeneric')
}

export function Welcome(): JSX.Element {
  const { login, register } = useApp()
  const { t } = useI18n()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, name)
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="drag flex h-full flex-col items-center justify-center bg-bg px-8">
      <motion.div className="no-drag w-full max-w-[380px]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}>
        <div className="mb-12 flex flex-col items-center text-center">
          <span className="mb-6 flex size-16 items-center justify-center rounded-[18px] bg-[#f4f0e8] text-[#111] shadow-[var(--shadow)]">
            <Feather size={38} />
          </span>
          <h1 className="text-[32px] font-semibold tracking-tight">{t('appName')}</h1>
          <p className="mt-2 text-[15px] text-fg-2">{t('tagline')}</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {mode === 'register' && (
            <Field label={t('name')}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            </Field>
          )}
          <Field label={t('email')}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus={mode === 'login'} required />
          </Field>
          <Field label={t('password')}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {mode === 'login' ? t('signIn') : t('createAccount')}
          </Button>
        </form>

        <p className="mt-8 text-center text-[14px] text-fg-2">
          {mode === 'login' ? t('noAccount') : t('haveAccount')}{' '}
          <button
            className="font-medium text-fg underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            {mode === 'login' ? t('createAccount') : t('signIn')}
          </button>
        </p>
      </motion.div>
    </div>
  )
}
