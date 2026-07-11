import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, authApi, ERR_EMAIL_TAKEN } from './api'
import AuthLayout from './AuthLayout'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authApi.signup(name.trim(), email, password)
      setCreated(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === ERR_EMAIL_TAKEN) {
        setError('That email already has an account — try signing in instead.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not reach the server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <AuthLayout>
        <h1>Check your inbox</h1>
        <p className="auth-subtitle">
          We sent a verification link to <b>{email}</b>. Click it to confirm your email, then sign in.
        </p>
        <p className="auth-footer">
          Done verifying?{' '}
          <Link className="auth-link" to="/login">
            Sign in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1>Start building your profile.</h1>
      <p className="auth-subtitle">It only takes a minute.</p>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <input
            id="signup-name"
            className="auth-input"
            type="text"
            placeholder="Full name (optional)"
            aria-label="Full name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <input
            id="signup-email"
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

        <div className="auth-field" style={{ marginBottom: 22 }}>
          <div className="auth-input-wrap">
            <input
              id="signup-password"
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (8+ characters)"
              aria-label="Password"
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
          {submitting ? 'Creating account…' : 'Create my account'}
        </button>
      </form>

      <p className="auth-fineprint">
        By signing up you agree to the <b>Terms</b> and <b>Privacy Policy</b>.
      </p>

      <p className="auth-footer">
        Already have an account?{' '}
        <Link className="auth-link" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
