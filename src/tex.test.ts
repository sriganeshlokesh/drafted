import { describe, it, expect } from 'vitest'
import { fmtMonth, expDates, genTex } from './tex'
import type { ResumeData } from './types'

// ── Minimal fixture ──────────────────────────────────────────────────────────

const BASE: ResumeData = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  linkedin: 'https://www.linkedin.com/in/janedoe',
  phone: '555-1234',
  location: 'New York, NY',
  targetCompany: '',
  targetRole: '',
  docTitle: 'Resume',
  summary: '',
  experience: [],
  projects: [],
  education: [],
  skillGroups: [],
  step: 0,
  view: 'preview',
  format: 'PDF',
}

// ── fmtMonth ─────────────────────────────────────────────────────────────────

describe('fmtMonth', () => {
  it('formats YYYY-MM-DD', () => {
    expect(fmtMonth('2019-08-15')).toBe('Aug 2019')
  })

  it('formats YYYY-MM', () => {
    expect(fmtMonth('2023-01')).toBe('Jan 2023')
  })

  it('handles December (month 12)', () => {
    expect(fmtMonth('2020-12')).toBe('Dec 2020')
  })

  it('handles January (month 01)', () => {
    expect(fmtMonth('2021-01')).toBe('Jan 2021')
  })

  it('returns empty string for empty input', () => {
    expect(fmtMonth('')).toBe('')
  })

  it('passes through non-date strings unchanged', () => {
    expect(fmtMonth('Present')).toBe('Present')
    expect(fmtMonth('Spring 2020')).toBe('Spring 2020')
  })
})

// ── expDates ─────────────────────────────────────────────────────────────────

describe('expDates', () => {
  it('formats a start–end range', () => {
    expect(expDates({ start: '2020-01', end: '2022-06', present: false }))
      .toBe('Jan 2020 – Jun 2022')
  })

  it('replaces end with Present when present=true', () => {
    expect(expDates({ start: '2022-03', end: '', present: true }))
      .toBe('Mar 2022 – Present')
  })

  it('ignores end date when present=true', () => {
    expect(expDates({ start: '2022-03', end: '2023-01', present: true }))
      .toBe('Mar 2022 – Present')
  })

  it('returns only end when start is empty', () => {
    expect(expDates({ start: '', end: '2022-06', present: false }))
      .toBe('Jun 2022')
  })

  it('returns empty string when both dates are empty and not present', () => {
    expect(expDates({ start: '', end: '', present: false })).toBe('')
  })

  it('returns Present alone when start is empty and present=true', () => {
    expect(expDates({ start: '', end: '', present: true })).toBe('Present')
  })
})

// ── genTex ───────────────────────────────────────────────────────────────────

describe('genTex — document structure', () => {
  it('produces a complete LaTeX document', () => {
    const tex = genTex(BASE, 'Letter')
    expect(tex).toContain('\\documentclass')
    expect(tex).toContain('\\begin{document}')
    expect(tex).toContain('\\end{document}')
  })

  it('uses letterpaper for Letter size', () => {
    expect(genTex(BASE, 'Letter')).toContain('letterpaper')
  })

  it('uses a4paper for A4 size', () => {
    expect(genTex(BASE, 'A4')).toContain('a4paper')
  })

  it('includes the person\'s full name', () => {
    const tex = genTex(BASE, 'Letter')
    expect(tex).toContain('Jane Doe')
  })

  it('strips LinkedIn URL protocol from contact line', () => {
    const tex = genTex(BASE, 'Letter')
    expect(tex).toContain('linkedin.com/in/janedoe')
    expect(tex).not.toContain('https://')
  })

  it('includes email and location in contact line', () => {
    const tex = genTex(BASE, 'Letter')
    expect(tex).toContain('jane@example.com')
    expect(tex).toContain('New York, NY')
  })
})

describe('genTex — LaTeX escaping', () => {
  it('escapes & in text fields', () => {
    const tex = genTex({ ...BASE, location: 'Sales & Marketing' }, 'Letter')
    expect(tex).toContain('Sales \\& Marketing')
    expect(tex).not.toContain('Sales & Marketing')
  })

  it('escapes _ in email', () => {
    const tex = genTex({ ...BASE, email: 'test_user@example.com' }, 'Letter')
    expect(tex).toContain('test\\_user@example.com')
  })

  it('escapes # in text', () => {
    const tex = genTex({ ...BASE, location: 'Suite #5' }, 'Letter')
    expect(tex).toContain('Suite \\#5')
  })

  it('escapes % in text', () => {
    const tex = genTex({
      ...BASE,
      skillGroups: [{ id: 'sg-cov', label: 'Coverage', items: ['100%'], draft: '' }],
    }, 'Letter')
    expect(tex).toContain('100\\%')
  })
})

describe('genTex — Summary section', () => {
  it('omits Summary section when summary is empty', () => {
    expect(genTex(BASE, 'Letter')).not.toContain('\\section*{Summary}')
  })

  it('omits Summary section when summary is whitespace-only HTML', () => {
    expect(genTex({ ...BASE, summary: '<p>  </p>' }, 'Letter'))
      .not.toContain('\\section*{Summary}')
  })

  it('includes Summary section with plain paragraph text', () => {
    const tex = genTex({ ...BASE, summary: '<p>Experienced engineer.</p>' }, 'Letter')
    expect(tex).toContain('\\section*{Summary}')
    expect(tex).toContain('Experienced engineer.')
  })

  it('renders bold text in summary', () => {
    const tex = genTex({ ...BASE, summary: '<p>A <strong>bold</strong> word.</p>' }, 'Letter')
    expect(tex).toContain('\\textbf{bold}')
  })

  it('renders italic text in summary', () => {
    const tex = genTex({ ...BASE, summary: '<p>An <em>italic</em> word.</p>' }, 'Letter')
    expect(tex).toContain('\\textit{italic}')
  })
})

describe('genTex — Experience section', () => {
  const EXP = {
    id: 'exp-1',
    company: 'Acme Corp',
    role: 'Software Engineer',
    employment: 'Full-time',
    start: '2020-01',
    end: '2022-06',
    present: false,
    bulletsText: '',
  }

  it('omits Experience section when list is empty', () => {
    expect(genTex(BASE, 'Letter')).not.toContain('\\section*{Experience}')
  })

  it('includes Experience section header', () => {
    expect(genTex({ ...BASE, experience: [EXP] }, 'Letter'))
      .toContain('\\section*{Experience}')
  })

  it('includes role and company', () => {
    const tex = genTex({ ...BASE, experience: [EXP] }, 'Letter')
    expect(tex).toContain('Software Engineer')
    expect(tex).toContain('Acme Corp')
  })

  it('includes formatted date range', () => {
    const tex = genTex({ ...BASE, experience: [EXP] }, 'Letter')
    expect(tex).toContain('Jan 2020 – Jun 2022')
  })

  it('shows Present for current jobs', () => {
    const tex = genTex({
      ...BASE,
      experience: [{ ...EXP, present: true, end: '' }],
    }, 'Letter')
    expect(tex).toContain('Present')
  })

  it('renders bullet points as LaTeX itemize', () => {
    const tex = genTex({
      ...BASE,
      experience: [{
        ...EXP,
        bulletsText: '<ul><li>Built a thing</li><li>Scaled it</li></ul>',
      }],
    }, 'Letter')
    expect(tex).toContain('\\begin{itemize}')
    expect(tex).toContain('\\item Built a thing')
    expect(tex).toContain('\\item Scaled it')
    expect(tex).toContain('\\end{itemize}')
  })

  it('renders multiple experience entries', () => {
    const tex = genTex({
      ...BASE,
      experience: [
        { ...EXP, id: 'exp-sr', role: 'Senior Engineer', company: 'Big Co' },
        { ...EXP, id: 'exp-jr', role: 'Junior Engineer', company: 'Small Co' },
      ],
    }, 'Letter')
    expect(tex).toContain('Senior Engineer')
    expect(tex).toContain('Big Co')
    expect(tex).toContain('Junior Engineer')
    expect(tex).toContain('Small Co')
  })
})

describe('genTex — Projects section', () => {
  const PROJ = { id: 'prj-1', name: 'MyApp', link: 'github.com/myapp', description: '', techStack: [], techStackDraft: '' }

  it('omits Projects section when list is empty', () => {
    expect(genTex(BASE, 'Letter')).not.toContain('\\section*{Projects}')
  })

  it('includes project name and link', () => {
    const tex = genTex({ ...BASE, projects: [PROJ] }, 'Letter')
    expect(tex).toContain('\\section*{Projects}')
    expect(tex).toContain('MyApp')
    expect(tex).toContain('github.com/myapp')
  })

  it('includes project description', () => {
    const tex = genTex({
      ...BASE,
      projects: [{ ...PROJ, description: '<p>A cool app.</p>' }],
    }, 'Letter')
    expect(tex).toContain('A cool app.')
  })
})

describe('genTex — Education section', () => {
  const EDU = {
    id: 'edu-1',
    school: 'State University',
    degree: 'B.S. Computer Science',
    start: '2015-08',
    end: '2019-05',
    extraDetails: [],
  }

  it('omits Education section when list is empty', () => {
    expect(genTex(BASE, 'Letter')).not.toContain('\\section*{Education}')
  })

  it('includes degree, school, and dates', () => {
    const tex = genTex({ ...BASE, education: [EDU] }, 'Letter')
    expect(tex).toContain('\\section*{Education}')
    expect(tex).toContain('B.S. Computer Science')
    expect(tex).toContain('State University')
    expect(tex).toContain('Aug 2015')
    expect(tex).toContain('May 2019')
  })

  it('includes extra details (GPA, Honours, etc.)', () => {
    const tex = genTex({
      ...BASE,
      education: [{
        ...EDU,
        extraDetails: [{ label: 'GPA', value: '3.9' }],
      }],
    }, 'Letter')
    expect(tex).toContain('GPA: 3.9')
  })

  it('omits extra details when value is empty', () => {
    const tex = genTex({
      ...BASE,
      education: [{
        ...EDU,
        extraDetails: [{ label: 'GPA', value: '' }],
      }],
    }, 'Letter')
    expect(tex).not.toContain('GPA:')
  })
})

describe('genTex — Skills section', () => {
  it('omits Skills section when all groups are empty', () => {
    const tex = genTex({
      ...BASE,
      skillGroups: [{ id: 'sg-1', label: 'Languages', items: [], draft: '' }],
    }, 'Letter')
    expect(tex).not.toContain('\\section*{Skills}')
  })

  it('includes skill group label and items', () => {
    const tex = genTex({
      ...BASE,
      skillGroups: [{ id: 'sg-1', label: 'Languages', items: ['Go', 'Python', 'TypeScript'], draft: '' }],
    }, 'Letter')
    expect(tex).toContain('\\section*{Skills}')
    expect(tex).toContain('Languages')
    expect(tex).toContain('Go, Python, TypeScript')
  })

  it('includes multiple skill groups', () => {
    const tex = genTex({
      ...BASE,
      skillGroups: [
        { id: 'sg-1', label: 'Languages', items: ['Go'], draft: '' },
        { id: 'sg-2', label: 'Tools', items: ['Docker', 'Kubernetes'], draft: '' },
      ],
    }, 'Letter')
    expect(tex).toContain('Languages')
    expect(tex).toContain('Tools')
    expect(tex).toContain('Docker, Kubernetes')
  })
})
