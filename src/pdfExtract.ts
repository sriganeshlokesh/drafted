import { normalizeText } from './textNormalize'

// PDF → positioned lines. A flat string can't carry the bold / font-size / column
// signals the parser needs, so PDF extraction produces `Line[]` (one per visual
// line) with those signals attached. Pure helpers (detectColumns, reconstructLines)
// are unit-tested with synthetic items; extractPdfLines wraps them around pdf.js.

export interface Line {
  text: string
  /** left edge of the line */
  x: number
  /** baseline y — PDF bottom-left origin, so larger y = higher on the page */
  y: number
  /** representative (max) font size on the line */
  fontSize: number
  /** true when the majority of the line's items are bold */
  bold: boolean
  /** vertical gap to the previous line in reading order (0 for the first line) */
  gapBefore: number
}

export interface RawItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  bold: boolean
  hasEOL: boolean
}

// ── pure helpers ─────────────────────────────────────────────────────────────

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Most common font size (in 0.5 buckets), weighted by character count = body text. */
function modeFontSize(items: RawItem[]): number {
  const counts = new Map<number, number>()
  for (const it of items) {
    const k = Math.round(it.fontSize * 2) / 2
    counts.set(k, (counts.get(k) || 0) + Math.max(1, it.str.length))
  }
  let best = 0
  let bestN = -1
  for (const [k, n] of counts) if (n > bestN) ((bestN = n), (best = k))
  return best
}

/**
 * Detect a two-column layout by finding a vertical "gutter" — a clean x-band no
 * item crosses, with substantial and tall text on both sides. Returns items
 * partitioned into ordered columns (left then right), else `[items]` for a single
 * column. Conservative, so a single-column résumé with right-aligned dates isn't
 * mis-split.
 */
export function detectColumns(items: RawItem[], _pageWidth: number, pageHeight: number): RawItem[][] {
  const t = items.filter((i) => i.str.trim())
  if (t.length < 12) return [items]
  const minX = Math.min(...t.map((i) => i.x))
  const maxX = Math.max(...t.map((i) => i.x + i.width))
  const span = maxX - minX
  if (span <= 0) return [items]

  const coverage = (arr: RawItem[]) => {
    const ys = arr.map((i) => i.y)
    return arr.length ? Math.max(...ys) - Math.min(...ys) : 0
  }

  let best: { left: RawItem[]; right: RawItem[]; score: number } | null = null
  for (let c = minX + span * 0.3; c <= minX + span * 0.7; c += span * 0.02) {
    const crossing = t.filter((i) => i.x < c - 1 && i.x + i.width > c + 1)
    if (crossing.length > t.length * 0.02) continue
    const left = t.filter((i) => i.x + i.width / 2 <= c)
    const right = t.filter((i) => i.x + i.width / 2 > c)
    if (left.length < t.length * 0.15 || right.length < t.length * 0.15) continue
    if (coverage(left) < pageHeight * 0.4 || coverage(right) < pageHeight * 0.4) continue
    const score = Math.min(left.length, right.length)
    if (!best || score > best.score) best = { left, right, score }
  }
  return best ? [best.left, best.right] : [items]
}

/**
 * Reconstruct reading-order lines from positioned items in one column. Groups by
 * y, then within each line inserts a space only where the horizontal gap exceeds a
 * space width — fixing pdf.js glyph-splitting ("S e n i o r" / "SeniorEngineer").
 */
export function reconstructLines(items: RawItem[]): Line[] {
  const its = items.filter((i) => i.str && i.str.trim())
  if (!its.length) return []
  its.sort((a, b) => b.y - a.y || a.x - b.x)

  const medH = median(its.map((i) => i.height || i.fontSize || 8)) || 8
  const tol = Math.max(2, medH * 0.5)

  const groups: RawItem[][] = []
  let group: RawItem[] = []
  let lineY: number | null = null
  for (const it of its) {
    if (lineY === null || Math.abs(it.y - lineY) <= tol) {
      group.push(it)
      if (lineY === null) lineY = it.y
    } else {
      groups.push(group)
      group = [it]
      lineY = it.y
    }
  }
  if (group.length) groups.push(group)

  const bodySize = modeFontSize(its)
  const bodyItems = its.filter((i) => Math.abs(i.fontSize - bodySize) < 0.75)
  const totalW = bodyItems.reduce((s, i) => s + i.width, 0)
  const totalC = bodyItems.reduce((s, i) => s + i.str.length, 0)
  const typicalCharWidth = totalC ? totalW / totalC : 0

  const lines: Line[] = []
  let prevY: number | null = null
  for (const g of groups) {
    const sorted = [...g].sort((a, b) => a.x - b.x)
    let text = ''
    for (let k = 0; k < sorted.length; k++) {
      const it = sorted[k]
      if (k > 0) {
        const prev = sorted[k - 1]
        const gap = it.x - (prev.x + prev.width)
        const spaceW = Math.max(typicalCharWidth * 0.4, it.fontSize * 0.2)
        if (gap > spaceW && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' '
      }
      text += it.str
    }
    // Collapse a stray space after an "approximately" tilde (incl. the combining/small
    // tilde variants CMU fonts emit) so "~ 20K" → "~20K".
    text = normalizeText(text).replace(/\s+/g, ' ').replace(/[~˜̃∼]\s*(?=[\d$])/g, '~').trim()
    if (!text) continue
    const y = Math.max(...sorted.map((i) => i.y))
    lines.push({
      text,
      x: Math.min(...sorted.map((i) => i.x)),
      y,
      fontSize: Math.max(...sorted.map((i) => i.fontSize)),
      bold: sorted.filter((i) => i.bold).length * 2 >= sorted.length,
      gapBefore: prevY === null ? 0 : Math.max(0, prevY - y),
    })
    prevY = y
  }
  return lines
}

// ── impure: real PDF via unpdf's bundled pdf.js ──────────────────────────────

interface PdfTextItem {
  str: string
  transform: number[]
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

const BOLD_RE = /bold|black|heavy|semibold|semib|demi/i

/**
 * Extract lines from a PDF via unpdf's bundled pdf.js. Reads raw text items so we
 * can derive bold (real font name via `commonObjs` — best-effort, falls back to
 * false), font size, and coordinates, then runs column detection + line
 * reconstruction per page. Lazy-imported so pdf.js stays in its own chunk.
 */
export async function extractPdfLines(file: File): Promise<Line[]> {
  const { getDocumentProxy } = await import('unpdf')
  const buf = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocumentProxy(buf)
  const out: Line[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const items: RawItem[] = []

    for (const raw of content.items as unknown as PdfTextItem[]) {
      if (raw.str == null) continue // skip marked-content items
      const tr = raw.transform
      const fontSize = Math.hypot(tr[2], tr[3]) || raw.height || 8
      let bold = false
      try {
        const fontObj = page.commonObjs.get(raw.fontName) as { name?: string; fallbackName?: string } | null
        bold = BOLD_RE.test(fontObj?.name ?? fontObj?.fallbackName ?? '')
      } catch {
        bold = false // commonObjs may not be resolved in the worker-inlined build
      }
      items.push({ str: raw.str, x: tr[4], y: tr[5], width: raw.width, height: raw.height, fontSize, bold, hasEOL: raw.hasEOL })
    }

    for (const col of detectColumns(items, viewport.width, viewport.height)) {
      const lines = reconstructLines(col)
      if (lines.length) {
        lines[0].gapBefore = 999 // page/column start → always a fresh entry boundary
        out.push(...lines)
      }
    }
  }
  return out
}
