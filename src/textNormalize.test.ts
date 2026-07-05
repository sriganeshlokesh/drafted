import { describe, it, expect } from 'vitest'
import { normalizeText, dehyphenate } from './textNormalize'

// Build invisible characters from code points so the test source stays ASCII-clean.
const SHY = String.fromCharCode(0x00ad) // soft hyphen
const ZWSP = String.fromCharCode(0x200b) // zero-width space
const NBSP = String.fromCharCode(0x00a0) // non-breaking space
const THIN = String.fromCharCode(0x2009) // thin space

describe('normalizeText', () => {
  it('expands ligatures via NFKC', () => {
    // ﬁ = fi ligature, ﬂ = fl ligature
    expect(normalizeText('ﬁle ﬂag')).toBe('file flag')
  })
  it('strips soft hyphens and zero-width characters', () => {
    expect(normalizeText('re' + SHY + 'su' + ZWSP + 'me')).toBe('resume')
  })
  it('replaces non-breaking and thin spaces with a normal space', () => {
    expect(normalizeText('New' + NBSP + 'York,' + THIN + 'NY')).toBe('New York, NY')
  })
  it('normalizes smart quotes and dashes', () => {
    expect(normalizeText('“Hi” — there')).toBe('"Hi" – there')
    expect(normalizeText('2020‑2021')).toBe('2020-2021') // non-breaking hyphen → ASCII
  })
  it('is a no-op on clean ASCII', () => {
    expect(normalizeText('jane.doe@example.com')).toBe('jane.doe@example.com')
  })
})

describe('dehyphenate', () => {
  it('joins words split at a line end', () => {
    expect(dehyphenate('collabo-\nrate daily')).toBe('collaborate daily')
  })
  it('leaves normal hyphenation intact', () => {
    expect(dehyphenate('full-stack engineer')).toBe('full-stack engineer')
  })
})
