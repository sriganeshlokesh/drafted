import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ApiError, authApi } from './api'
import AuthLayout from './AuthLayout'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === 20003
            ? 'This reset link is invalid or has expired. Request a new one.'
            : err.message,
        )
      } else {
        setError('Could not reach the server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <h1>Reset your password</h1>
        <div className="auth-error">
          This reset link is missing its token. Use the link from your email, or request a new one.
        </div>
        <p className="auth-footer">
          <Link className="auth-link" to="/forgot-password">
            Request a new link
          </Link>
        </p>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout>
        <h1>Password updated</h1>
        <div className="auth-notice">
          Your password has been changed and all other sessions were signed out.
        </div>
        <p className="auth-footer">
          <Link className="auth-link" to="/login">
            Sign in with your new password
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1>Choose a new password</h1>
      <p className="auth-subtitle">This signs out every other session for your account.</p>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reset-password">
            New password
          </label>
          <div className="auth-input-wrap">
            <input
              id="reset-password"
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="8+ characters"
              autoComplete="new-password"
              minLength={8}
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
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}
