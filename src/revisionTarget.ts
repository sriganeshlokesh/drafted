// Pure helpers for the suggestion apply loop. Kept free of React so target
// resolution / application logic is unit-testable, and id-addressed so a
// reorder or delete between evaluate and apply can never touch the wrong item.

import type { ResumeData } from './types'
import type { EvaluationSuggestion, RevisionChange, RevisionTarget } from './evaluation'

/** The slice of the résumé a revision rewrites, plus prompt-flavor context. */
export interface ResolvedTarget {
  content: string
  context: { company?: string; role?: string; name?: string }
}

/**
 * Resolves a suggestion's action target against the CURRENT résumé state.
 * Returns null when the (section, field) combo is unknown or the item id no
 * longer exists — i.e. the target went stale since the evaluation ran.
 */
export function resolveTarget(state: ResumeData, target: RevisionTarget): ResolvedTarget | null {
  if (target.section === 'summary' && target.field === 'summary' && !target.item_id) {
    return { content: state.summary, context: { role: state.targetRole || undefined } }
  }
  if (target.section === 'experience' && target.field === 'bullets' && target.item_id) {
    const exp = state.experience.find((e) => e.id === target.item_id)
    if (!exp) return null
    return { content: exp.bulletsText, context: { company: exp.company, role: exp.role } }
  }
  if (target.section === 'projects' && target.field === 'description' && target.item_id) {
    const proj = state.projects.find((p) => p.id === target.item_id)
    if (!proj) return null
    return { content: proj.description, context: { name: proj.name } }
  }
  return null
}

/** A state mutation the editor performs with its existing `patch`/`setItemField` helpers. */
export type ApplyOp =
  | { kind: 'patch'; value: Partial<ResumeData> }
  | { kind: 'setItemField'; list: 'experience' | 'projects'; index: number; field: 'bulletsText' | 'description'; value: string }

/**
 * Translates an accepted change into the editor mutation that applies it,
 * re-resolving the item id against CURRENT state on accept. Returns null when
 * the target vanished in the meantime (stale — nothing must be written).
 */
export function applyChange(state: ResumeData, change: RevisionChange): ApplyOp | null {
  const { target } = change
  if (target.section === 'summary' && target.field === 'summary' && !target.item_id) {
    return { kind: 'patch', value: { summary: change.after } }
  }
  if (target.section === 'experience' && target.field === 'bullets' && target.item_id) {
    const index = state.experience.findIndex((e) => e.id === target.item_id)
    if (index === -1) return null
    return { kind: 'setItemField', list: 'experience', index, field: 'bulletsText', value: change.after }
  }
  if (target.section === 'projects' && target.field === 'description' && target.item_id) {
    const index = state.projects.findIndex((p) => p.id === target.item_id)
    if (index === -1) return null
    return { kind: 'setItemField', list: 'projects', index, field: 'description', value: change.after }
  }
  return null
}

/** Stable identity for applied-suggestion tracking (survives reloads via drafted:match:v1). */
export function suggestionKey(s: EvaluationSuggestion): string {
  return `${s.section}|${s.action?.target.item_id ?? ''}|${s.text}`
}
