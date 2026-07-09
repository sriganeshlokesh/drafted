import { describe, it, expect } from 'vitest'
import { matchBand, pointsLeft, relativeTime, sectionTarget, shortDimLabel } from './matchScore'
import { suggestionKey } from './revisionTarget'
import type { EvaluationSuggestion } from './evaluation'

describe('matchBand', () => {
  it.each([
    [100, 'Strong match'],
    [85, 'Strong match'],
    [84, 'Good match'],
    [70, 'Good match'],
    [69, 'Fair match'],
    [50, 'Fair match'],
    [49, 'Needs work'],
    [0, 'Needs work'],
  ] as const)('scores %i as "%s"', (score, label) => {
    expect(matchBand(score).label).toBe(label)
  })
})

describe('pointsLeft', () => {
  it('is 100 - score, floored at 0', () => {
    expect(pointsLeft(74)).toBe(26)
    expect(pointsLeft(100)).toBe(0)
    expect(pointsLeft(120)).toBe(0)
  })

  const sug = (text: string, lift: number, itemId = ''): EvaluationSuggestion => ({
    text,
    section: itemId ? 'experience' : 'summary',
    dimension: '',
    estimated_lift: lift,
    action: {
      type: 'rewrite_field',
      target: itemId
        ? { section: 'experience', item_id: itemId, field: 'bullets' }
        : { section: 'summary', item_id: '', field: 'summary' },
    },
  })

  it('excludes the estimated lift of applied suggestions', () => {
    const a = sug('tighten summary', 4)
    const b = sug('quantify bullet', 6, 'exp1')
    expect(pointsLeft(70, [a, b], new Set([suggestionKey(b)]))).toBe(24) // 30 − 6
  })

  it('floors at 0 when applied lift exceeds the remaining gap', () => {
    const b = sug('big win', 40, 'exp1')
    expect(pointsLeft(90, [b], new Set([suggestionKey(b)]))).toBe(0)
  })

  it('ignores unapplied suggestions and treats negative lift as 0', () => {
    const a = sug('meh', -3)
    const b = sug('other', 5, 'exp2')
    expect(pointsLeft(50, [a, b], new Set([suggestionKey(a)]))).toBe(50)
  })
})

describe('relativeTime', () => {
  const now = 1_000_000_000_000
  it.each([
    [now - 5_000, 'just now'],
    [now - 90_000, '1 min ago'],
    [now - 3 * 60_000, '3 min ago'],
    [now - 3 * 3_600_000, '3 h ago'],
    [now - 2 * 86_400_000, '2 d ago'],
    [now - 45 * 86_400_000, '1 mo ago'],
    [now - 400 * 86_400_000, '1 y ago'],
  ] as const)('formats %i as "%s"', (ts, expected) => {
    expect(relativeTime(ts, now)).toBe(expected)
  })

  it('clamps future timestamps to "just now"', () => {
    expect(relativeTime(now + 10_000, now)).toBe('just now')
  })
})

describe('shortDimLabel', () => {
  it('maps known dimension keys', () => {
    expect(shortDimLabel('skills_match', 'Skills match')).toBe('Skills')
    expect(shortDimLabel('experience_relevance', 'x')).toBe('Experience')
    expect(shortDimLabel('impact_evidence', 'x')).toBe('Impact')
    expect(shortDimLabel('education_extras', 'x')).toBe('Education')
  })

  it('falls back for unknown keys', () => {
    expect(shortDimLabel('mystery', 'Mystery Label')).toBe('Mystery Label')
  })
})

describe('sectionTarget', () => {
  it.each([
    ['summary', 0, 'Summary'],
    ['experience', 1, 'Experience'],
    ['projects', 2, 'Projects'],
    ['education', 3, 'Education'],
    ['skills', 4, 'Skills'],
  ] as const)('maps %s to step %i', (section, step, label) => {
    expect(sectionTarget(section)).toEqual({ step, label })
  })

  it('returns null for an unknown section', () => {
    expect(sectionTarget('references')).toBeNull()
  })
})
