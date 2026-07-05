// Unicode cleanup for text pulled out of PDFs (and text files). PDF glyph
// extraction introduces ligatures, soft hyphens, non-breaking/fixed-width spaces,
// smart quotes, and dash variants that break naive regexes (email, dates,
// sections). Normalizing here makes the downstream heuristics far more reliable.

/**
 * Char-level normalization (no newline logic — see `dehyphenate`). Safe to run on
 * a whole string, a single line, or a single PDF text item; idempotent.
 *
 * Uses Unicode property escapes so we don't embed invisible characters in source:
 *   \p{Cf} = format chars (soft hyphen, zero-width space/joiner, BOM, bidi marks)
 *   \p{Zs} = space separators (nbsp, en/em/thin/hair spaces, …)
 * NFKC already handles ligatures (ﬁ→fi) and most compatibility/width variants.
 */
export function normalizeText(s: string): string {
  if (!s) return s
  return s
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '') // strip format chars (incl. soft hyphen, zero-width)
    .replace(/\p{Zs}/gu, ' ') // any space separator → normal space (keeps \n and \t)
    .replace(/[‘’‛′]/g, "'") // smart single quotes / prime
    .replace(/[“”″]/g, '"') // smart double quotes / double prime
    .replace(/[‐‑‒]/g, '-') // hyphen / non-breaking hyphen / figure dash → ASCII hyphen
    .replace(/[—―]/g, '–') // em dash / horizontal bar → en dash (parseDateRange handles it)
}

/**
 * Join words split across a line break by end-of-line hyphenation
 * ("collabo-\nrate" -> "collaborate"). Run on multi-line text before splitting into
 * lines. Requires >=2 letters on each side so real hyphenated tokens are left alone.
 */
export function dehyphenate(text: string): string {
  return text.replace(/([A-Za-z]{2,})-\n[ \t]*([a-z]{2,})/g, '$1$2')
}
