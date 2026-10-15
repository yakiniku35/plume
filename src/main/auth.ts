import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import type { Avatar, User } from '@shared/types'
import { paths } from './paths'
import { readJson, writeJson } from './store'
import { getSettings, setSettings } from './settings'

interface Account extends User {
  passwordHash: string
}

let sessionCache: { id: string | null; user: User | null } | null = null

function loadAccounts(): Account[] {
  return readJson<Account[]>(paths.accounts(), [])
}

function saveAccounts(accounts: Account[]): void {
  writeJson(paths.accounts(), accounts)
  sessionCache = null
}

function toUser(a: Account): User {
  const { passwordHash: _ph, ...user } = a
  return user
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export class AuthError extends Error {
  constructor(public code: 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS' | 'WEAK_PASSWORD' | 'INVALID_EMAIL') {
    super(code)
  }
}

export function register(input: { email: string; password: string; name: string }): User {
  const email = normaliseEmail(input.email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AuthError('INVALID_EMAIL')
  if (input.password.length < 6) throw new AuthError('WEAK_PASSWORD')
  const accounts = loadAccounts()
  if (accounts.some((a) => a.email === email)) throw new AuthError('EMAIL_TAKEN')
  const account: Account = {
    id: nanoid(12),
    email,
    name: input.name.trim() || email.split('@')[0],
    createdAt: new Date().toISOString(),
    passwordHash: bcrypt.hashSync(input.password, 10)
  }
  saveAccounts([...accounts, account])
  setSettings({ sessionUserId: account.id })
  sessionCache = null
  return toUser(account)
}

export function login(input: { email: string; password: string }): User {
  const email = normaliseEmail(input.email)
  const account = loadAccounts().find((a) => a.email === email)
  if (!account || !bcrypt.compareSync(input.password, account.passwordHash)) {
    throw new AuthError('INVALID_CREDENTIALS')
  }
  setSettings({ sessionUserId: account.id })
  sessionCache = null
  return toUser(account)
}

export function logout(): void {
  setSettings({ sessionUserId: null })
  sessionCache = null
}

/** Cached: the media://, thumb:// and avatar:// handlers call this for every request. */
export function currentUser(): User | null {
  if (sessionCache) return sessionCache.user
  const id = getSettings().sessionUserId
  const account = id ? loadAccounts().find((a) => a.id === id) : undefined
  sessionCache = { id, user: account ? toUser(account) : null }
  return sessionCache.user
}

export function updateProfile(userId: string, patch: { name?: string; avatar?: Avatar }): User {
  const accounts = loadAccounts()
  const idx = accounts.findIndex((a) => a.id === userId)
  if (idx < 0) throw new Error('NOT_AUTHENTICATED')
  const next: Account = { ...accounts[idx] }
  if (patch.name !== undefined) next.name = patch.name.trim() || next.name
  if (patch.avatar !== undefined) next.avatar = patch.avatar
  accounts[idx] = next
  saveAccounts(accounts)
  return toUser(next)
}

export function requireUser(): User {
  const u = currentUser()
  if (!u) throw new Error('NOT_AUTHENTICATED')
  return u
}
