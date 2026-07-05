/**
 * Résumé font-size (A− / A+) scaling — a single multiplier applied across every
 * renderer (preview, PDF, Word, LaTeX) so on-screen and downloaded sizes match.
 * This module is the single source of truth for the allowed range and step, so
 * the UI limits and each renderer's defensive clamp can never drift apart.
 */
export const FONT_SCALE_MIN = 0.9
export const FONT_SCALE_MAX = 1.1
export const FONT_SCALE_STEP = 0.05
export const DEFAULT_FONT_SCALE = 1

/** Coerce any value into a safe multiplier within [FONT_SCALE_MIN, FONT_SCALE_MAX]. */
export const clampFontScale = (v: number): number => {
  const n = typeof v === 'number' && isFinite(v) ? v : DEFAULT_FONT_SCALE
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n))
}
