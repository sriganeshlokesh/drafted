import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import './auth.css'
import { useAuth } from './AuthContext'

/** Gate for app routes: waits for the session bootstrap, then either renders
 * the app or bounces to the login page. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="auth-splash">Loading drafted…</div>
  }
  if (status === 'anon') {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
