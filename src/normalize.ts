import type { ResumeData } from './types'
import { clampFontScale } from './fontScale'
import { genId } from './idFactory'

/** Keeps an existing non-empty string id; otherwise mints one (the id migration). */
const ensureId = (x: Record<string, unknown>): string =>
  typeof x.id === 'string' && x.id ? x.id : genId()

/**
 * Normalizes a loosely-shaped résumé object into the exact `ResumeData` field
 * formats the app expects, and migrates legacy field shapes. Used by BOTH the
 * localStorage loader (backward-compat for older saves) and the résumé importer
 * (so parsed data lands in the same normalized shape).
 *
 * - `summary`: plain text → `<p>…</p>`
 * - `experience[].bulletsText`: newline-separated plain text → `<ul><li>…</li></ul>`
 * - `projects[].description`: plain text → `<p>…</p>`
 * - `education[].start`/`end`: legacy `YYYY-MM` → `YYYY-MM-DD`
 * - `education[]`: legacy `gpa`/`detail` fields → `extraDetails: [{ label:'GPA', value }]`
 * - every list item: missing `id` → freshly generated (persisted on next autosave)
 *
 * Anything already containing HTML (has a `<`) is left untouched, so this is
 * idempotent and safe to run on already-normalized data.
 */
export function normalizeResumeData(input: Record<string, unknown>): Partial<ResumeData> {
  const d: Record<string, unknown> = { ...input }

  if (typeof d.summary === 'string' && d.summary && !d.summary.includes('<')) {
    d.summary = `<p>${d.summary}</p>`
  }

  if (Array.isArray(d.experience)) {
    d.experience = d.experience.map((x: Record<string, unknown>) => ({
      ...x,
      id: ensureId(x),
      bulletsText:
        typeof x.bulletsText === 'string' && x.bulletsText && !x.bulletsText.includes('<')
          ? `<ul>${x.bulletsText
              .split('\n')
              .filter((l) => l.trim())
              .map((l) => { const t = l.trim(); return `<li>${/[.!?;:]$/.test(t) ? t : t + '.'}</li>`; })
              .join('')}</ul>`
          : x.bulletsText || '',
    }))
  }

  if (Array.isArray(d.education)) {
    d.education = d.education.map((x: Record<string, unknown>) => {
      const start = typeof x.start === 'string' && /^\d{4}-\d{2}$/.test(x.start) ? x.start + '-01' : x.start
      const end = typeof x.end === 'string' && /^\d{4}-\d{2}$/.test(x.end) ? x.end + '-01' : x.end
      let extraDetails = Array.isArray(x.extraDetails) ? x.extraDetails : []
      // Migrate old gpa/detail fields into extraDetails
      const oldGpa =
        typeof x.gpa === 'string' && x.gpa
          ? x.gpa
          : typeof x.detail === 'string'
            ? x.detail.replace(/^GPA:\s*/i, '').trim()
            : ''
      if (oldGpa && !extraDetails.some((e: { label: string }) => e.label === 'GPA')) {
        extraDetails = [{ label: 'GPA', value: oldGpa }, ...extraDetails]
      }
      return { ...x, id: ensureId(x), start, end, extraDetails }
    })
  }

  if (Array.isArray(d.projects)) {
    d.projects = d.projects.map((x: Record<string, unknown>) => ({
      ...x,
      id: ensureId(x),
      description: (() => {
        if (typeof x.description !== 'string' || !x.description || x.description.includes('<'))
          return x.description || ''
        const lines = x.description.split('\n').map((l) => l.trim()).filter(Boolean)
        if (lines.length <= 1) return `<p>${x.description.trim()}</p>`
        return `<ul>${lines.map((l) => `<li>${/[.!?;:]$/.test(l) ? l : l + '.'}</li>`).join('')}</ul>`
      })(),
      techStack: Array.isArray(x.techStack) ? x.techStack : [],
      techStackDraft: typeof x.techStackDraft === 'string' ? x.techStackDraft : '',
    }))
  }

  if (Array.isArray(d.skillGroups)) {
    d.skillGroups = d.skillGroups.map((x: Record<string, unknown>) => ({
      ...x,
      id: ensureId(x),
    }))
  }

  if (typeof d.fontScale === 'number') d.fontScale = clampFontScale(d.fontScale as number)

  return d as Partial<ResumeData>
}
