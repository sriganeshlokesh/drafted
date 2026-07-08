import { describe, it, expect } from 'vitest'
import { hasResumeContent } from './resumeContent'
import type { ResumeData, Experience, SkillGroup } from './types'

const EMPTY: ResumeData = {
  firstName: '', lastName: '', email: '', linkedin: '', phone: '', location: '',
  targetCompany: '', targetRole: '', docTitle: 'My résumé', summary: '',
  experience: [], projects: [], education: [], skillGroups: [],
  step: 0, view: 'preview', format: 'PDF',
}

const blankExperience: Experience = {
  id: 'exp-blank', company: '', role: '', employment: '', start: '', end: '', present: false, bulletsText: '',
}
const blankSkillGroup: SkillGroup = { id: 'sg-blank', label: '', items: [], draft: '' }

describe('hasResumeContent', () => {
  it('is false for a blank résumé', () => {
    expect(hasResumeContent(EMPTY)).toBe(false)
  })

  it('ignores docTitle (always defaulted)', () => {
    expect(hasResumeContent({ ...EMPTY, docTitle: 'Something else' })).toBe(false)
  })

  it('treats whitespace-only personal fields as empty', () => {
    expect(hasResumeContent({ ...EMPTY, firstName: '   ', summary: '\n\t ' })).toBe(false)
  })

  it.each([
    'firstName', 'lastName', 'email', 'linkedin', 'phone',
    'location', 'targetCompany', 'targetRole', 'summary',
  ] as const)('is true when %s is filled', (field) => {
    expect(hasResumeContent({ ...EMPTY, [field]: 'x' })).toBe(true)
  })

  it('is true as soon as a section has any entry (even blank)', () => {
    expect(hasResumeContent({ ...EMPTY, experience: [blankExperience] })).toBe(true)
    expect(hasResumeContent({ ...EMPTY, skillGroups: [blankSkillGroup] })).toBe(true)
  })
})
