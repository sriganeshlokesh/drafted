// Pure helpers for the Job Match report. Kept separate from JobMatch.tsx so the
// scoring/formatting logic is unit-testable without pulling in React.

export interface MatchBand {
  label: string
  /** Inclusive lower bound of the band. */
  min: number
}

// Highest band first so the first `score >= min` wins.
const BANDS: MatchBand[] = [
  { label: 'Strong match', min: 85 },
  { label: 'Good match', min: 70 },
  { label: 'Fair match', min: 50 },
  { label: 'Needs work', min: 0 },
]

/** Maps a 0–100 score to its match-quality band. */
export function matchBand(score: number): MatchBand {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]
}

/** Points still available — "N pts left on the table". */
export function pointsLeft(score: number): number {
  return Math.max(0, 100 - score)
}

/** Compact relative time ("just now", "3 h ago"). `now` is injectable for tests. */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - ts) / 1000))
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} d ago`
  const mon = Math.floor(day / 30)
  if (mon < 12) return `${mon} mo ago`
  return `${Math.floor(day / 365)} y ago`
}

const SHORT_LABELS: Record<string, string> = {
  skills_match: 'Skills',
  experience_relevance: 'Experience',
  impact_evidence: 'Impact',
  education_extras: 'Education',
}

/** Short chip label for a dimension key; falls back to the dimension's own label. */
export function shortDimLabel(key: string, fallback: string): string {
  return SHORT_LABELS[key] ?? fallback
}

// Résumé sections the backend can target, mapped to the editor's wizard step.
const SECTION_STEPS: Record<string, { step: number; label: string }> = {
  summary: { step: 0, label: 'Summary' },
  experience: { step: 1, label: 'Experience' },
  projects: { step: 2, label: 'Projects' },
  education: { step: 3, label: 'Education' },
  skills: { step: 4, label: 'Skills' },
}

/** Maps a suggestion's `section` to a wizard step + display label; null if unknown. */
export function sectionTarget(section: string): { step: number; label: string } | null {
  return SECTION_STEPS[section] ?? null
}

// Four descending accent shades for the stacked bar + chip dots. Mixing with the
// page background keeps them solid and theme-aware (works in light and dark).
export const DIM_SHADES: string[] = [
  'var(--accent)',
  'color-mix(in srgb, var(--accent) 72%, var(--c-bg))',
  'color-mix(in srgb, var(--accent) 50%, var(--c-bg))',
  'color-mix(in srgb, var(--accent) 32%, var(--c-bg))',
]

/** Hatched fill for the "missed" (unearned) portion of the score bar. */
export const MISSED_FILL =
  'repeating-linear-gradient(45deg, var(--c-border) 0, var(--c-border) 5px, transparent 5px, transparent 10px)'
