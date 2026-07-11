import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { authApi, type Me } from './api'
import { getAccessToken, refreshSession, setSession } from './tokenStore'

export type AuthStatus = 'loading' | 'authed' | 'anon'

interface AuthContextValue {
  status: AuthStatus
  user: Me | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-bootstrap from the refresh cookie (used by the OAuth landing route). */
  bootstrap: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<Me | null>(null)

  const loadUser = useCallback(async (): Promise<boolean> => {
    const token = getAccessToken()
    if (!token) {
      setUser(null)
      setStatus('anon')
      return false
    }
    try {
      setUser(await authApi.me(token))
      setStatus('authed')
      return true
    } catch {
      setSession(null)
      setUser(null)
      setStatus('anon')
      return false
    }
  }, [])

  const bootstrap = useCallback(async (): Promise<boolean> => {
    await refreshSession() // silent: 401 just means logged out
    return loadUser()
  }, [loadUser])

  // Session bootstrap on app load (master plan §8). refreshSession is
  // single-flight, so StrictMode's double effect cannot double-rotate.
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const login = useCallback(
    async (email: string, password: string) => {
      setSession(await authApi.login(email, password))
      await loadUser()
    },
    [loadUser],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setSession(null)
      setUser(null)
      setStatus('anon')
    }
  }, [])

  return (
    <AuthContext.Provider value={{ status, user, login, logout, bootstrap }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
