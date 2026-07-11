import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from './AuthContext'

/** OAuth landing route: keysmith redirects here after a provider callback
 * with the refresh cookie already set — bootstrap a session and route in. */
export default function AuthCompletePage() {
  const { bootstrap } = useAuth()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    void bootstrap().then((ok) => {
      navigate(ok ? '/' : '/login?error=oauth_failed', { replace: true })
    })
  }, [bootstrap, navigate])

  return <div className="auth-splash">Signing you in…</div>
}
