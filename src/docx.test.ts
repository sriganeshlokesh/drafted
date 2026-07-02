import { describe, it, expect } from 'vitest'
import { genDocx } from './docx'
import type { ResumeData } from './types'

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
  summary: '<p>Experienced engineer.</p>',
  experience: [
    {
      company: 'Acme Corp',
      role: 'Software Engineer',
      employment: 'Full-time',
      start: '2020-01',
      end: '2022-06',
      present: false,
      bulletsText: '<ul><li>Built systems</li><li>Scaled them</li></ul>',
    },
  ],
  projects: [{ name: 'MyApp', link: 'github.com/myapp', description: '<p>A cool app.</p>' }],
  education: [
    {
      school: 'State University',
      degree: 'B.S. Computer Science',
      start: '2015-08',
      end: '2019-05',
      extraDetails: [{ label: 'GPA', value: '3.9' }],
    },
  ],
  skillGroups: [
    { label: 'Languages', items: ['Go', 'Python'], draft: '' },
  ],
  step: 0,
  view: 'preview',
  format: 'Word',
}

describe('genDocx', () => {
  it('returns a Blob', async () => {
    const blob = await genDocx(BASE, 'Letter')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('returns the correct MIME type', async () => {
    const blob = await genDocx(BASE, 'Letter')
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  })

  it('returns a non-empty file', async () => {
    const blob = await genDocx(BASE, 'Letter')
    expect(blob.size).toBeGreaterThan(5000)
  })

  it('works with Letter and A4 paper sizes without throwing', async () => {
    await expect(genDocx(BASE, 'Letter')).resolves.toBeInstanceOf(Blob)
    await expect(genDocx(BASE, 'A4')).resolves.toBeInstanceOf(Blob)
  })

  it('works with empty sections without throwing', async () => {
    const minimal: ResumeData = {
      ...BASE,
      summary: '',
      experience: [],
      projects: [],
      education: [],
      skillGroups: [],
    }
    const blob = await genDocx(minimal, 'Letter')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('works when name is missing', async () => {
    const blob = await genDocx({ ...BASE, firstName: '', lastName: '' }, 'Letter')
    expect(blob).toBeInstanceOf(Blob)
  })
})
