// Keysmith auth API client. In dev the Vite proxy forwards `/auth/*` to the
// local keysmith (same-origin, cookies just work); production builds set
// VITE_AUTH_BASE_URL to the deployed keysmith origin.

const AUTH_BASE = import.meta.env.VITE_AUTH_BASE_URL ?? ''

/** Structured error from keysmith's {code, message} envelope. */
export class ApiError extends Error {
  readonly code: number
  readonly status: number

  constructor(status: number, code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Keysmith error codes the UI branches on (api/error_code in keysmith).
export const ERR_INVALID_CREDENTIALS = 20001
export const ERR_INVALID_TOKEN = 20003
export const ERR_EMAIL_NOT_VERIFIED = 20004
export const ERR_EMAIL_TAKEN = 40001
export const ERR_RATE_LIMITED = 10003

export interface Session {
  access_token: string
  token_type: string
  expires_at: number // unix seconds
}

export interface Me {
  id: string
  email: string
  email_verified: boolean
  name: string | null
  avatar_url: string | null
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    credentials: 'include', // refresh cookie
    ...init,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.code ?? 0, body?.message ?? 'Something went wrong')
  }
  return body as T
}

function post<T>(path: string, payload?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    ...(payload !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  })
}

export const authApi = {
  signup(name: string, email: string, password: string): Promise<{ message: string }> {
    return post('/auth/signup', name ? { name, email, password } : { email, password })
  },
  login(email: string, password: string): Promise<Session> {
    return post('/auth/login', { email, password })
  },
  refresh(): Promise<Session> {
    return post('/auth/refresh')
  },
  logout(): Promise<{ message: string }> {
    return post('/auth/logout')
  },
  me(accessToken: string): Promise<Me> {
    return request('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
  },
  verifyEmail(token: string): Promise<{ message: string }> {
    return post('/auth/verify-email', { token })
  },
  requestPasswordReset(email: string): Promise<{ message: string }> {
    return post('/auth/request-password-reset', { email })
  },
  resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return post('/auth/reset-password', { token, new_password: newPassword })
  },
  /** Full-page navigation target for "Continue with Google". */
  googleLoginURL: `${AUTH_BASE}/auth/google/login`,
}
