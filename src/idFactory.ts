/**
 * Generates an opaque, client-side item ID. The backend round-trips these as
 * strings and only keeps ones matching `^[A-Za-z0-9_-]{1,64}$`, so both paths
 * stay well within 64 chars. `crypto.randomUUID` needs a secure context /
 * modern browser; the `Math.random` fallback covers older Safari.
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID() // 36 chars
  }
  return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 64)
}
