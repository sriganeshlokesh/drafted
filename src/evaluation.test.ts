import { afterEach, describe, expect, it, vi } from 'vitest'
import { EvaluationError, evaluateResume, toEvaluationRequest } from './evaluation'
import type { EvaluationResponse } from './evaluation'
import type { Education, Experience, Project, ResumeData, SkillGroup } from './types'

const experience: Experience = {
  company: 'Acme', role: 'Engineer', employment: 'Full-time',
  start: '2020-01', end: '2022-03', present: false, bulletsText: '<ul><li>Shipped things</li></ul>',
}
const project: Project = {
  name: 'Widget', link: 'https://x.dev', description: '<p>A widget</p>',
  techStack: ['Go', 'React'], techStackDraft: 'Type',
}
const education: Education = {
  school: 'State U', degree: 'BSc', start: '2016-09', end: '2020-05',
  extraDetails: [{ label: 'GPA', value: '3.9' }],
}
const skillGroup: SkillGroup = { label: 'Languages', items: ['Go', 'TS'], draft: 'Ru' }

const RESUME: ResumeData = {
  firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.dev', linkedin: 'in/ada',
  phone: '555', location: 'London', targetCompany: 'Analytical', targetRole: 'Eng',
  docTitle: 'My résumé', summary: '<p>Summary</p>',
  experience: [experience], projects: [project], education: [education], skillGroups: [skillGroup],
  step: 2, view: 'source', format: 'LaTeX', fontScale: 1.1,
}

const EMPTY_RESUME: ResumeData = {
  firstName: '', lastName: '', email: '', linkedin: '', phone: '', location: '',
  targetCompany: '', targetRole: '', docTitle: 'My résumé', summary: '',
  experience: [], projects: [], education: [], skillGroups: [],
  step: 0, view: 'preview', format: 'PDF',
}

describe('toEvaluationRequest', () => {
  it('maps camelCase fields to snake_case and renames rich-text/list keys', () => {
    const req = toEvaluationRequest(RESUME, 'Build great software')

    expect(req.job_description).toBe('Build great software')
    expect(req.resume.first_name).toBe('Ada')
    expect(req.resume.last_name).toBe('Lovelace')
    expect(req.resume.experience[0].bullets).toBe('<ul><li>Shipped things</li></ul>')
    expect(req.resume.projects[0].tech_stack).toEqual(['Go', 'React'])
    expect(req.resume.education[0].extra_details).toEqual([{ label: 'GPA', value: '3.9' }])
    expect(req.resume.skill_groups[0]).toEqual({ label: 'Languages', items: ['Go', 'TS'] })
  })

  it('drops UI-only fields (drafts, targets, docTitle, wizard/view state)', () => {
    const req = toEvaluationRequest(RESUME, 'jd')
    const json = JSON.stringify(req)

    expect(json).not.toContain('techStackDraft')
    expect(json).not.toContain('bulletsText')
    expect(json).not.toContain('targetCompany')
    expect(json).not.toContain('docTitle')
    expect(req.resume).not.toHaveProperty('step')
    expect(req.resume.projects[0]).not.toHaveProperty('techStackDraft')
    expect(req.resume.skill_groups[0]).not.toHaveProperty('draft')
  })
})

describe('evaluateResume', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs to /v1/evaluations and returns the parsed evaluation', async () => {
    const body: EvaluationResponse = {
      status: 'ok', score: 82, summary: 'Strong match',
      dimensions: [{ key: 'skills_match', label: 'Skills', score: 30, max: 35, evidence: 'Go, TS' }],
      strengths: ['Go'], gaps: [], suggestions: [{ text: 'Add metrics', section: 'experience', dimension: 'impact_evidence', estimated_lift: 4 }],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(body),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await evaluateResume(RESUME, 'jd')

    expect(result).toEqual(body)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/v1/evaluations')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).job_description).toBe('jd')
  })

  it('maps an error envelope to a friendly EvaluationError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429, json: () => Promise.resolve({ code: 10003, message: 'too many requests' }),
    }))

    await expect(evaluateResume(RESUME, 'jd')).rejects.toMatchObject({
      name: 'EvaluationError', code: 10003, status: 429,
    })
    await expect(evaluateResume(RESUME, 'jd')).rejects.toThrow(/too many requests/i)
  })

  it('wraps a network failure in an EvaluationError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(evaluateResume(RESUME, 'jd')).rejects.toBeInstanceOf(EvaluationError)
  })

  it('guards empty input before making a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(evaluateResume(RESUME, '   ')).rejects.toMatchObject({ code: 10002 })
    await expect(evaluateResume(EMPTY_RESUME, 'jd')).rejects.toMatchObject({ code: 10002 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
