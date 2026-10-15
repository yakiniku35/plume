import { createServer } from 'http'
import { randomBytes, createHash } from 'crypto'
import { shell } from 'electron'
import { StorageError } from './provider'

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  /** epoch ms */
  expires_at: number
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Desktop-app loopback flow with PKCE: open the consent screen in the default browser,
 * catch the redirect on 127.0.0.1:<random port>, exchange the code for tokens.
 */
export async function authorizeLoopback(clientId: string, clientSecret: string, scope: string): Promise<OAuthTokens> {
  const verifier = b64url(randomBytes(48))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  return new Promise<OAuthTokens>((resolveTokens, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const code = url.searchParams.get('code')
      const gotState = url.searchParams.get('state')
      const err = url.searchParams.get('error')
      const page = (title: string, body: string): string =>
        `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:-apple-system,system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#fff;color:#111"><div style="text-align:center"><h1 style="font-weight:500">${title}</h1><p style="color:#666">${body}</p></div></body>`
      if (err || !code || gotState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end(page('Plume', 'Sign-in was cancelled. You can close this tab.'))
        cleanup()
        reject(new StorageError('NETWORK', err ?? 'oauth_denied'))
        return
      }
      try {
        const port = (server.address() as { port: number }).port
        const tokens = await exchange(clientId, clientSecret, {
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          redirect_uri: `http://127.0.0.1:${port}/callback`
        })
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(page('Connected to Plume', 'Google Drive is linked. You can close this tab and return to Plume.'))
        cleanup()
        resolveTokens(tokens)
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' }).end(page('Plume', 'Something went wrong. Please try again from Plume.'))
        cleanup()
        reject(e)
      }
    })
    const timer = setTimeout(() => {
      cleanup()
      reject(new StorageError('NETWORK', 'oauth_timeout'))
    }, 5 * 60 * 1000)
    function cleanup(): void {
      clearTimeout(timer)
      server.close()
    }
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://127.0.0.1:${port}/callback`,
        response_type: 'code',
        scope: `${scope} openid email`,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state
      })
      void shell.openExternal(`${AUTH_URL}?${params.toString()}`)
    })
  })
}

async function exchange(clientId: string, clientSecret: string, body: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }).toString(),
    signal: AbortSignal.timeout(30_000)
  })
  if (!res.ok) throw new StorageError('NETWORK', `token_${res.status}`)
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in - 60) * 1000
  }
}

export async function refreshTokens(clientId: string, clientSecret: string, refreshToken: string): Promise<OAuthTokens> {
  try {
    const t = await exchange(clientId, clientSecret, { grant_type: 'refresh_token', refresh_token: refreshToken })
    return { ...t, refresh_token: t.refresh_token ?? refreshToken }
  } catch {
    throw new StorageError('GDRIVE_REAUTH_REQUIRED')
  }
}

export async function fetchEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) return undefined
    return ((await res.json()) as { email?: string }).email
  } catch {
    return undefined
  }
}
