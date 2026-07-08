import type { ResumeData } from './types'
import { hasResumeContent } from './resumeContent'

// ── Request DTOs ──────────────────────────────────────────────────────────
// Mirror forged/api/dto/evaluation.go (all keys snake_case). Rich-text fields
// (summary, bullets, description) are sent as the HTML strings Tiptap produces.

export interface EvaluationRequestExperience {
  company: string
  role: string
  employment: string
  start: string
  end: string
  present: boolean
  bullets: string
}

export interface EvaluationRequestProject {
  name: string
  link: string
  description: string
  tech_stack: string[]
}

export interface EvaluationRequestEducationDetail {
  label: string
  value: string
}

export interface EvaluationRequestEducation {
  school: string
  degree: string
  start: string
  end: string
  extra_details: EvaluationRequestEducationDetail[]
}

export interface EvaluationRequestSkillGroup {
  label: string
  items: string[]
}

export interface EvaluationRequestResume {
  first_name: string
  last_name: string
  email: string
  linkedin: string
  phone: string
  location: string
  summary: string
  experience: EvaluationRequestExperience[]
  projects: EvaluationRequestProject[]
  education: EvaluationRequestEducation[]
  skill_groups: EvaluationRequestSkillGroup[]
}

export interface EvaluationRequest {
  job_description: string
  resume: EvaluationRequestResume
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export interface EvaluationDimension {
  key: string
  label: string
  score: number
  max: number
  evidence: string
}

export interface EvaluationResponse {
  status: string
  score: number
  summary: string
  dimensions: EvaluationDimension[]
  strengths: string[]
  gaps: string[]
  suggestions: string[]
}

// ── Errors ────────────────────────────────────────────────────────────────

/** The `{ code, message }` envelope forged returns for every non-2xx response. */
interface ApiErrorEnvelope {
  code: number
  message: string
}

/** Friendlier copy per forged error code (error_code/error_code.go). */
const FRIENDLY_MESSAGES: Record<number, string> = {
  10001: 'The request was malformed. Please try again.',
  10002: 'Add a job description and some résumé content before evaluating.',
  10003: 'Too many requests — wait a moment and try again.',
  30001: 'Something went wrong on the server. Please try again.',
  30002: 'The evaluation service is temporarily unavailable. Please try again shortly.',
}

/** Error thrown by {@link evaluateResume}; carries the backend code + HTTP status when available. */
export class EvaluationError extends Error {
  code?: number
  status?: number

  constructor(message: string, opts: { code?: number; status?: number } = {}) {
    super(message)
    this.name = 'EvaluationError'
    this.code = opts.code
    this.status = opts.status
  }
}

// ── Mapping ───────────────────────────────────────────────────────────────

/**
 * Maps the editor's {@link ResumeData} to the API request shape: camelCase →
 * snake_case, `bulletsText` → `bullets`, `techStack` → `tech_stack`, and drops
 * UI-only fields (drafts, targetCompany/targetRole, docTitle, wizard/view state).
 */
export function toEvaluationRequest(resume: ResumeData, jobDescription: string): EvaluationRequest {
  return {
    job_description: jobDescription,
    resume: {
      first_name: resume.firstName,
      last_name: resume.lastName,
      email: resume.email,
      linkedin: resume.linkedin,
      phone: resume.phone,
      location: resume.location,
      summary: resume.summary,
      experience: resume.experience.map((e) => ({
        company: e.company,
        role: e.role,
        employment: e.employment,
        start: e.start,
        end: e.end,
        present: e.present,
        bullets: e.bulletsText,
      })),
      projects: resume.projects.map((p) => ({
        name: p.name,
        link: p.link,
        description: p.description,
        tech_stack: p.techStack,
      })),
      education: resume.education.map((ed) => ({
        school: ed.school,
        degree: ed.degree,
        start: ed.start,
        end: ed.end,
        extra_details: ed.extraDetails.map((d) => ({ label: d.label, value: d.value })),
      })),
      skill_groups: resume.skillGroups.map((sg) => ({
        label: sg.label,
        items: sg.items,
      })),
    },
  }
}

// ── Client ────────────────────────────────────────────────────────────────

// Empty in local dev: requests hit the relative `/v1/...`, which the Vite dev
// server proxies to http://localhost:8080 (see vite.config.ts), keeping them
// same-origin. Set VITE_API_BASE_URL for non-proxied/production builds.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * POSTs the résumé + job description to forged's `/v1/evaluations` and returns
 * the scored evaluation. Throws {@link EvaluationError} on validation, HTTP, or
 * network failure. Pass a {@link AbortSignal} to cancel in-flight requests.
 */
export async function evaluateResume(
  resume: ResumeData,
  jobDescription: string,
  signal?: AbortSignal,
): Promise<EvaluationResponse> {
  // Fail fast with a friendly message instead of a wasted round-trip — mirrors
  // the backend's validation (code 10002), which stays the source of truth.
  if (!jobDescription.trim()) {
    throw new EvaluationError('Add a job description to evaluate against.', { code: 10002 })
  }
  if (!hasResumeContent(resume)) {
    throw new EvaluationError('Add some résumé content before evaluating.', { code: 10002 })
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/v1/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toEvaluationRequest(resume, jobDescription)),
      signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new EvaluationError('Evaluation cancelled.')
    }
    throw new EvaluationError(
      "Couldn't reach the evaluation service. Check your connection and that the server is running.",
    )
  }

  if (!res.ok) {
    const envelope = (await res.json().catch(() => null)) as ApiErrorEnvelope | null
    const code = envelope?.code
    const message =
      (code != null && FRIENDLY_MESSAGES[code]) ||
      envelope?.message ||
      `Evaluation failed (HTTP ${res.status}).`
    throw new EvaluationError(message, { code, status: res.status })
  }

  return (await res.json()) as EvaluationResponse
}
