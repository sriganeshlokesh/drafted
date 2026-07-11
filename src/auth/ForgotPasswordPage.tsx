import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { authApi } from './api'
import AuthLayout from './AuthLayout'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.requestPasswordReset(email)
      setSent(true)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h1>Reset your password</h1>
      <p className="auth-subtitle">
        Enter your email and we&rsquo;ll send you a link to set a new password.
      </p>

      {error && <div className="auth-error">{error}</div>}
      {sent && (
        <div className="auth-notice">
          If that account exists, a reset email is on its way. The link expires in 1 hour.
        </div>
      )}

      {!sent && (
        <form onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="auth-footer">
        Remembered it?{' '}
        <Link className="auth-link" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
