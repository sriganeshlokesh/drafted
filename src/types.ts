export type Format = 'PDF' | 'LaTeX' | 'Word'
export type View = 'preview' | 'source'
export type SaveState = 'saving' | 'saved'
export type PaperSize = 'Letter' | 'A4'

export interface Experience {
  /** Opaque client-generated ID (see idFactory); round-tripped by the backend. */
  id: string
  company: string
  role: string
  employment: string
  start: string
  end: string
  present: boolean
  bulletsText: string
}

export interface Project {
  /** Opaque client-generated ID (see idFactory); round-tripped by the backend. */
  id: string
  name: string
  link: string
  description: string
  techStack: string[]
  techStackDraft: string
}

export interface EducationDetail {
  label: string
  value: string
}

export interface Education {
  /** Opaque client-generated ID (see idFactory); round-tripped by the backend. */
  id: string
  school: string
  degree: string
  start: string
  end: string
  extraDetails: EducationDetail[]
}

export interface SkillGroup {
  /** Opaque client-generated ID (see idFactory); round-tripped by the backend. */
  id: string
  label: string
  items: string[]
  draft: string
}

/** The full editable document — exactly the slice persisted to localStorage. */
export interface ResumeData {
  firstName: string
  lastName: string
  email: string
  linkedin: string
  phone: string
  location: string
  targetCompany: string
  targetRole: string
  docTitle: string
  summary: string
  experience: Experience[]
  projects: Project[]
  education: Education[]
  skillGroups: SkillGroup[]
  step: number
  view: View
  format: Format
  /** Résumé text-size multiplier (A− / A+). 1 = default; clamped to [0.9, 1.1]. */
  fontScale?: number
}

export type ListKey = 'experience' | 'projects' | 'education' | 'skillGroups'
