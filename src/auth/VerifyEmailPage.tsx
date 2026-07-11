import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { authApi } from './api'
import AuthLayout from './AuthLayout'

type State = 'verifying' | 'verified' | 'failed'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<State>(token ? 'verifying' : 'failed')
  // Verification tokens are single-use; guard against StrictMode's double
  // effect consuming the token twice (the second attempt would report failure).
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || attempted.current) {
      return
    }
    attempted.current = true
    authApi
      .verifyEmail(token)
      .then(() => setState('verified'))
      .catch(() => setState('failed'))
  }, [token])

  return (
    <AuthLayout>
      {state === 'verifying' && (
        <>
          <h1>Verifying…</h1>
          <p className="auth-subtitle">Confirming your email address.</p>
        </>
      )}
      {state === 'verified' && (
        <>
          <h1>Email verified 🎉</h1>
          <div className="auth-notice">Your email is confirmed — you can sign in now.</div>
          <p className="auth-footer">
            <Link className="auth-link" to="/login">
              Sign in
            </Link>
          </p>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1>Link expired</h1>
          <div className="auth-error">
            This verification link is invalid or has already been used. Signing up again with the
            same email will send a fresh link.
          </div>
          <p className="auth-footer">
            <Link className="auth-link" to="/login">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
