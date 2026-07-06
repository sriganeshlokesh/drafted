import { describe, it, expect } from 'vitest'
import { parseResumeText, parseResumeLines, parseDateRange, importResume } from './resumeImport'
import { normalizeResumeData } from './normalize'
import type { Line } from './pdfExtract'

const L = (text: string, extra: Partial<Line> = {}): Line => ({
  text,
  x: 0,
  y: 0,
  fontSize: 0,
  bold: false,
  gapBefore: 1,
  ...extra,
})

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

describe('parseResumeLines — style signals (PDF)', () => {
  it('feature-scoring prefers a bold line for the name', () => {
    const data = parseResumeLines([
      L('Software Engineer'), // letters-only: +3
      L('Jane Doe', { bold: true }), // letters-only +3, bold +2 = 5 → wins
      L('jane@example.com'),
    ])
    expect(data.firstName).toBe('Jane')
    expect(data.lastName).toBe('Doe')
  })

  it('splits date-less experience entries on bold company titles', () => {
    const data = parseResumeLines([
      L('Experience'),
      L('Acme Corporation', { bold: true, gapBefore: 2 }),
      L('Software Engineer'),
      L('Globex Inc', { bold: true, gapBefore: 2 }),
      L('Staff Engineer'),
    ])
    expect(data.experience).toHaveLength(2)
    expect(data.experience![0].company).toBe('Acme Corporation')
    expect(data.experience![1].company).toBe('Globex Inc')
  })

  it('splits date-less experience entries on a large vertical gap', () => {
    const data = parseResumeLines([
      L('Experience'),
      L('Engineer at Acme', { gapBefore: 1 }),
      L('Shipped things', { gapBefore: 1 }),
      L('Engineer at Globex', { gapBefore: 4 }), // big gap → new entry
      L('Shipped more', { gapBefore: 1 }),
    ])
    expect(data.experience).toHaveLength(2)
  })

  it('treats an ALL-CAPS keyword line as a section header', () => {
    const data = parseResumeLines([
      L('Jane Doe'),
      L('SKILLS'), // all-caps section header
      L('Languages: TypeScript, Go'),
    ])
    expect(data.skillGroups).toHaveLength(1)
    expect(data.skillGroups![0].label).toBe('Languages')
  })

  it('joins soft-wrapped bullet continuations into one bullet', () => {
    const data = parseResumeLines([
      L('Experience'),
      L('Senior Software Engineer — Acme Corp', { bold: true, gapBefore: 4 }),
      L('• Led a team, scaling to 13M MAUs', { x: 40 }),
      L('at 20K peak QPS under 60ms', { x: 52 }), // continuation, no marker
      L('• Architected microservices processing 200M events', { x: 40 }),
      L('with idempotent handling and graceful degradation', { x: 52 }),
    ])
    const bullets = data.experience![0].bulletsText.split('\n')
    expect(bullets).toHaveLength(2)
    expect(bullets[0]).toBe('Led a team, scaling to 13M MAUs at 20K peak QPS under 60ms')
    expect(bullets[1]).toContain('graceful degradation')
  })

  it('re-merges lowercase-leading marker fragments (re-exported fragmented résumé)', () => {
    const data = parseResumeLines([
      L('Experience'),
      L('Software Engineer — Acme', { bold: true, gapBefore: 4 }),
      L('• Led a real-time platform scaling to 13M', { x: 34 }),
      L('• at 20K QPS growing revenue to $30M', { x: 34 }), // own marker + lowercase → continuation
      L('• Architected microservices with graceful', { x: 34 }),
      L('• degradation and regional deployments', { x: 34 }), // own marker + lowercase → continuation
    ])
    const bullets = data.experience![0].bulletsText.split('\n')
    expect(bullets).toHaveLength(2)
    expect(bullets[0]).toBe('Led a real-time platform scaling to 13M at 20K QPS growing revenue to $30M')
    expect(bullets[1]).toBe('Architected microservices with graceful degradation and regional deployments')
  })

  it('parses degree-first education entries (a second degree line starts a new entry)', () => {
    const data = parseResumeLines([
      L('Education'),
      L('Master of Science, Computer Science    Aug 2019 – May 2021'),
      L('University of North Carolina at Charlotte GPA: 4.0'),
      L('Bachelor of Science, Information Science    Aug 2015 – May 2019'),
      L('SJB Institute of Technology GPA: 3.6'),
    ])
    expect(data.education).toHaveLength(2)
    expect(data.education![0].degree).toContain('Master of Science')
    expect(data.education![0].school).toContain('University of North Carolina')
    expect(data.education![1].degree).toContain('Bachelor of Science')
    expect(data.education![1].school).toContain('SJB Institute of Technology')
    expect(data.education![1].start).toBe('2015-08-01')
    expect(data.education![1].end).toBe('2019-05-01')
  })
})
