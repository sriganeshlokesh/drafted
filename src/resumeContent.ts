import type { ResumeData } from './types'

/**
 * True when the résumé holds any user-entered content.
 *
 * Used to decide whether importing a file would overwrite real work — the
 * "This will replace your current information." warning only shows when this is
 * true. `docTitle` is intentionally ignored because it is always defaulted, and
 * a section counts as content as soon as it has any entry (the user has started
 * it), while personal fields must be non-whitespace.
 */
export function hasResumeContent(d: ResumeData): boolean {
  return !!(
    d.firstName.trim() || d.lastName.trim() || d.email.trim() || d.linkedin.trim() ||
    d.phone.trim() || d.location.trim() || d.targetCompany.trim() || d.targetRole.trim() ||
    d.summary.trim() ||
    d.experience.length || d.projects.length || d.education.length || d.skillGroups.length
  )
}
