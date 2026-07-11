// In-memory access-token store (never localStorage/sessionStorage — master
// plan §8) plus the single-flight refresh and the authenticated fetch used
// for forged API calls.
//
// The single-flight matters: two concurrent refreshes would present the same
// rotating cookie twice, which keysmith treats as token reuse and answers by
// revoking the whole session family (React StrictMode double-effects would
// trigger exactly that).

import { authApi, type Session } from './api'

let accessToken: string | null = null
let expiresAt = 0 // unix seconds
let refreshInFlight: Promise<string | null> | null = null

export function setSession(session: Session | null): void {
  accessToken = session?.access_token ?? null
  expiresAt = session?.expires_at ?? 0
}

export function getAccessToken(): string | null {
  return accessToken
}

/** Refresh the session via the httpOnly cookie; deduplicates concurrent calls. */
export function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = authApi
      .refresh()
      .then((session) => {
        setSession(session)
        return session.access_token
      })
      .catch(() => {
        setSession(null)
        return null
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

/** Return a token that is valid for at least 30 more seconds, refreshing if needed. */
export async function getValidToken(): Promise<string | null> {
  if (accessToken && expiresAt - 30 > Date.now() / 1000) {
    return accessToken
  }
  return refreshSession()
}

/**
 * fetch with the keysmith access token attached. On a 401 it refreshes once
 * (single-flight) and retries — the wrapper the forged calls go through
 * (master plan §8).
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const doFetch = (token: string | null) =>
    fetch(input, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  let res = await doFetch(await getValidToken())
  if (res.status === 401) {
    const fresh = await refreshSession()
    if (fresh) {
      res = await doFetch(fresh)
    }
  }
  return res
}
