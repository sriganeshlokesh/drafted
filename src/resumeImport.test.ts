import { describe, it, expect } from 'vitest'
import { parseResumeText, parseDateRange, importResume } from './resumeImport'
import { normalizeResumeData } from './normalize'

// A clean, single-column résumé — the shape the heuristics target.
const SAMPLE = `Jane Doe
jane.doe@example.com | (555) 123-4567 | linkedin.com/in/janedoe | San Francisco, CA

Summary
Full-stack engineer with 6 years building web apps.

Experience
Senior Software Engineer — Acme Corp    Jan 2021 – Present
• Led migration to React
• Cut load time by 40%
Software Engineer at Globex    Jun 2018 – Dec 2020
• Built REST APIs

Education
Massachusetts Institute of Technology    2014 – 2018
Bachelor of Science in Computer Science
GPA: 3.9/4.0

Projects
Portfolio Site — github.com/janedoe/portfolio
Personal site built with Next.js

Skills
Languages: JavaScript, TypeScript, Python
Frameworks: React, Node.js
`

describe('parseDateRange', () => {
  it('parses a month-name range with "Present"', () => {
    expect(parseDateRange('Jan 2020 – Present')).toEqual({ start: '2020-01-01', end: '', present: true })
  })
  it('parses a month-name start and end', () => {
    expect(parseDateRange('Jun 2018 - Dec 2020')).toEqual({ start: '2018-06-01', end: '2020-12-01', present: false })
  })
  it('parses numeric MM/YYYY', () => {
    expect(parseDateRange('03/2019 – 05/2021')).toEqual({ start: '2019-03-01', end: '2021-05-01', present: false })
  })
  it('parses year-only ranges', () => {
    expect(parseDateRange('2015 - 2019')).toEqual({ start: '2015-01-01', end: '2019-01-01', present: false })
  })
  it('treats a bare "Current" as present with no dates', () => {
    expect(parseDateRange('Current')).toEqual({ start: '', end: '', present: true })
  })
  it('returns null when there is no date', () => {
    expect(parseDateRange('Senior Software Engineer')).toBeNull()
  })
})

describe('parseResumeText — contact', () => {
  const d = parseResumeText(SAMPLE)
  it('extracts the name', () => {
    expect(d.firstName).toBe('Jane')
    expect(d.lastName).toBe('Doe')
  })
  it('extracts email, phone, linkedin, location', () => {
    expect(d.email).toBe('jane.doe@example.com')
    expect(d.phone).toMatch(/555/)
    expect(d.linkedin).toBe('linkedin.com/in/janedoe')
    expect(d.location).toBe('San Francisco, CA')
  })
  it('extracts the summary as plain text', () => {
    expect(d.summary).toContain('Full-stack engineer')
  })
})

describe('parseResumeText — experience', () => {
  const d = parseResumeText(SAMPLE)
  it('finds both roles', () => {
    expect(d.experience).toHaveLength(2)
  })
  it('splits role and company across the "—" separator', () => {
    expect(d.experience![0].role).toBe('Senior Software Engineer')
    expect(d.experience![0].company).toBe('Acme Corp')
  })
  it('marks a current role as present', () => {
    expect(d.experience![0].start).toBe('2021-01-01')
    expect(d.experience![0].present).toBe(true)
    expect(d.experience![0].end).toBe('')
  })
  it('parses "Role at Company" and a closed date range', () => {
    expect(d.experience![1].role).toBe('Software Engineer')
    expect(d.experience![1].company).toBe('Globex')
    expect(d.experience![1].start).toBe('2018-06-01')
    expect(d.experience![1].end).toBe('2020-12-01')
  })
  it('collects bullet lines (newline-joined, pre-normalize)', () => {
    expect(d.experience![0].bulletsText).toContain('Led migration to React')
    expect(d.experience![0].bulletsText).toContain('Cut load time by 40%')
  })
})

describe('parseResumeText — education, projects, skills', () => {
  const d = parseResumeText(SAMPLE)
  it('parses education with GPA', () => {
    expect(d.education).toHaveLength(1)
    expect(d.education![0].school).toContain('Massachusetts Institute of Technology')
    expect(d.education![0].degree).toContain('Bachelor of Science')
    expect(d.education![0].extraDetails).toContainEqual({ label: 'GPA', value: '3.9/4.0' })
  })
  it('parses a project with a link', () => {
    expect(d.projects).toHaveLength(1)
    expect(d.projects![0].name).toBe('Portfolio Site')
    expect(d.projects![0].link).toContain('github.com/janedoe/portfolio')
    expect(d.projects![0].description).toContain('Personal site')
  })
  it('parses labeled skill groups', () => {
    expect(d.skillGroups).toHaveLength(2)
    expect(d.skillGroups![0].label).toBe('Languages')
    expect(d.skillGroups![0].items).toContain('TypeScript')
    expect(d.skillGroups![1].label).toBe('Frameworks')
  })
})

describe('normalizeResumeData', () => {
  it('wraps plain text and pads legacy dates', () => {
    const out = normalizeResumeData({
      summary: 'Hello',
      experience: [{ bulletsText: 'a\nb' }],
      projects: [{ description: 'd' }],
      education: [{ start: '2020-05', end: '2021-06', gpa: '3.5' }],
    })
    expect(out.summary).toBe('<p>Hello</p>')
    expect(out.experience![0].bulletsText).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(out.projects![0].description).toBe('<p>d</p>')
    expect(out.education![0].start).toBe('2020-05-01')
    expect(out.education![0].end).toBe('2021-06-01')
    expect(out.education![0].extraDetails).toContainEqual({ label: 'GPA', value: '3.5' })
  })
  it('leaves already-HTML content untouched (idempotent)', () => {
    const out = normalizeResumeData({ summary: '<p>Existing</p>' })
    expect(out.summary).toBe('<p>Existing</p>')
  })
})

describe('importResume — guard', () => {
  it('reports ok for a real text résumé and applies normalization', async () => {
    const file = new File([SAMPLE], 'resume.txt', { type: 'text/plain' })
    const { data, ok } = await importResume(file)
    expect(ok).toBe(true)
    expect(data.firstName).toBe('Jane')
    // normalized on the way out
    expect(data.summary).toBe('<p>Full-stack engineer with 6 years building web apps.</p>')
    expect(data.experience![0].bulletsText).toContain('<li>Led migration to React</li>')
  })
  it('reports not-ok for an empty / unreadable file (guards against wiping the form)', async () => {
    const file = new File(['   \n  \n'], 'empty.txt', { type: 'text/plain' })
    const { ok } = await importResume(file)
    expect(ok).toBe(false)
  })
})
