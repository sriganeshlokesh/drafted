import { describe, expect, it } from 'vitest'
import { applyChange, resolveTarget, suggestionKey } from './revisionTarget'
import type { EvaluationSuggestion, RevisionChange, RevisionTarget } from './evaluation'
import type { ResumeData } from './types'

const STATE: ResumeData = {
  firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.dev', linkedin: '', phone: '', location: '',
  targetCompany: 'Analytical', targetRole: 'Engine Architect', docTitle: 'My résumé',
  summary: '<p>Pioneer of computing.</p>',
  experience: [
    {
      id: 'exp-1', company: 'Babbage & Co', role: 'Analyst', employment: 'Full-time',
      start: '1842-01', end: '1843-01', present: false, bulletsText: '<ul><li>Wrote the first program</li></ul>',
    },
    {
      id: 'exp-2', company: 'Royal Society', role: 'Fellow', employment: 'Part-time',
      start: '1844-01', end: '', present: true, bulletsText: '<ul><li>Published the notes</li></ul>',
    },
  ],
  projects: [
    { id: 'prj-1', name: 'Analytical Engine', link: '', description: '<p>General-purpose computer.</p>', techStack: ['brass'], techStackDraft: '' },
  ],
  education: [],
  skillGroups: [],
  step: 0, view: 'preview', format: 'PDF',
}

const target = (section: string, item_id: string, field: string): RevisionTarget => ({ section, item_id, field })

const change = (t: RevisionTarget, after = '<p>rewritten</p>'): RevisionChange => ({
  target: t, before: '<p>old</p>', after, rationale: 'tightened',
})

describe('resolveTarget', () => {
  it('resolves the résumé summary with the target role as context', () => {
    expect(resolveTarget(STATE, target('summary', '', 'summary'))).toEqual({
      content: '<p>Pioneer of computing.</p>',
      context: { role: 'Engine Architect' },
    })
  })

  it('omits the summary role context when targetRole is empty', () => {
    const resolved = resolveTarget({ ...STATE, targetRole: '' }, target('summary', '', 'summary'))
    expect(resolved?.context.role).toBeUndefined()
  })

  it('rejects a summary target carrying an item_id', () => {
    expect(resolveTarget(STATE, target('summary', 'exp-1', 'summary'))).toBeNull()
  })

  it('resolves an experience entry by id with company/role context', () => {
    expect(resolveTarget(STATE, target('experience', 'exp-2', 'bullets'))).toEqual({
      content: '<ul><li>Published the notes</li></ul>',
      context: { company: 'Royal Society', role: 'Fellow' },
    })
  })

  it('resolves a project by id with its name as context', () => {
    expect(resolveTarget(STATE, target('projects', 'prj-1', 'description'))).toEqual({
      content: '<p>General-purpose computer.</p>',
      context: { name: 'Analytical Engine' },
    })
  })

  it.each([
    ['stale experience id', target('experience', 'gone', 'bullets')],
    ['stale project id', target('projects', 'gone', 'description')],
    ['experience without an id', target('experience', '', 'bullets')],
    ['field mismatch on experience', target('experience', 'exp-1', 'description')],
    ['field mismatch on projects', target('projects', 'prj-1', 'bullets')],
    ['unsupported section', target('education', 'edu-1', 'degree')],
  ])('returns null for %s', (_name, t) => {
    expect(resolveTarget(STATE, t)).toBeNull()
  })
})

describe('applyChange', () => {
  it('maps a summary change to a patch', () => {
    expect(applyChange(STATE, change(target('summary', '', 'summary')))).toEqual({
      kind: 'patch',
      value: { summary: '<p>rewritten</p>' },
    })
  })

  it('maps an experience change to setItemField at the id-resolved index', () => {
    const after = '<ul><li>Led publication of the notes</li></ul>'
    expect(applyChange(STATE, change(target('experience', 'exp-2', 'bullets'), after))).toEqual({
      kind: 'setItemField', list: 'experience', index: 1, field: 'bulletsText', value: after,
    })
  })

  it('maps a project change to setItemField on description', () => {
    expect(applyChange(STATE, change(target('projects', 'prj-1', 'description')))).toEqual({
      kind: 'setItemField', list: 'projects', index: 0, field: 'description', value: '<p>rewritten</p>',
    })
  })

  it('re-resolves against current state after a reorder (id-addressed, not index-addressed)', () => {
    const reordered = { ...STATE, experience: [STATE.experience[1], STATE.experience[0]] }
    expect(applyChange(reordered, change(target('experience', 'exp-1', 'bullets')))).toMatchObject({ index: 1 })
  })

  it.each([
    ['deleted experience entry', target('experience', 'gone', 'bullets')],
    ['deleted project entry', target('projects', 'gone', 'description')],
    ['summary with an item_id', target('summary', 'x', 'summary')],
    ['unsupported combo', target('skills', 'sg-1', 'items')],
  ])('returns null for a stale target: %s', (_name, t) => {
    expect(applyChange(STATE, change(t))).toBeNull()
  })
})

describe('suggestionKey', () => {
  const base: EvaluationSuggestion = {
    text: 'Tighten the payments bullet', section: 'experience', dimension: 'impact_evidence', estimated_lift: 6,
  }

  it('includes the action target id when present', () => {
    const s: EvaluationSuggestion = {
      ...base,
      action: { type: 'rewrite_field', target: target('experience', 'exp-1', 'bullets') },
    }
    expect(suggestionKey(s)).toBe('experience|exp-1|Tighten the payments bullet')
  })

  it('falls back to an empty id segment for display-only suggestions', () => {
    expect(suggestionKey(base)).toBe('experience||Tighten the payments bullet')
  })
})
