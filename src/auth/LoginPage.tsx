import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError, ERR_EMAIL_NOT_VERIFIED } from './api'
import AuthLayout from './AuthLayout'
import { useAuth } from './AuthContext'

const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed: 'Google sign-in didn\'t complete. Please try again.',
  provider_denied: 'Google sign-in was cancelled.',
  email_in_use:
    'That email already has an account. Sign in with your password, then link Google from settings.',
  no_email: 'Google didn\'t share an email address for your account.',
  missing_state: 'Google sign-in expired. Please try again.',
  invalid_state: 'Google sign-in expired. Please try again.',
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const code = params.get('error')
    return code ? (OAUTH_ERRORS[code] ?? 'Sign-in didn\'t complete. Please try again.') : null
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === ERR_EMAIL_NOT_VERIFIED) {
        setError('Please verify your email first — check your inbox for the link.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not reach the server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h1>Good to see you again</h1>
      <p className="auth-subtitle">Pick up where you left off.</p>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <input
            id="login-email"
            className="auth-input"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <div className="auth-input-wrap">
            <input
              id="login-password"
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-show-btn"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="auth-remember-row">
          <label className="auth-remember-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <Link className="auth-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="auth-footer">
        New here?{' '}
        <Link className="auth-link" to="/signup">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
