import { normalizeResumeData } from './normalize'
import { normalizeText, dehyphenate } from './textNormalize'
import { extractPdfLines, type Line } from './pdfExtract'
import { genId } from './idFactory'
import type { Education, Experience, Project, ResumeData, SkillGroup } from './types'

/**
 * Client-side, heuristic résumé importer — no AI, no network. Extraction produces
 * positioned `Line[]` (PDF via pdf.js with bold/font-size/column signals; text
 * files synthesized with neutral signals), and `parseResumeLines` maps them to
 * `ResumeData`. Best-effort by nature; the caller guards against wiping the form
 * when little was extracted. Techniques adapted from OpenResume (open-source).
 */

export interface ImportOutcome {
  data: Partial<ResumeData>
  /** True when we extracted enough to be worth applying to the form. */
  ok: boolean
}

// ── small helpers ────────────────────────────────────────────────────────────

const median = (nums: number[]): number => {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const isAllCaps = (t: string) => /[A-Z]/.test(t) && t === t.toUpperCase()

/** Body font size = most common size (0.5 buckets, char-weighted). 0 for text files. */
function bodyFontSize(lines: Line[]): number {
  const counts = new Map<number, number>()
  for (const l of lines) {
    if (!l.fontSize) continue
    const k = Math.round(l.fontSize * 2) / 2
    counts.set(k, (counts.get(k) || 0) + Math.max(1, l.text.length))
  }
  let best = 0
  let bestN = -1
  for (const [k, n] of counts) if (n > bestN) ((bestN = n), (best = k))
  return best
}

// ── Dates ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
  aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10',
  october: '10', nov: '11', november: '11', dec: '12', december: '12',
}

// Month name + year (real months only), or MM/YYYY, or YYYY-MM, or a bare year.
const DATE_TOKEN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}-\d{1,2}|\b\d{4}\b/gi
const PRESENT = /\b(present|current|now|ongoing|till\s*date|to\s*date)\b/i

/** Converts a single date token to `YYYY-MM-DD` (day/month padded to 01). */
function toISO(token: string): string | null {
  const t = token.trim().toLowerCase()
  let m: RegExpMatchArray | null
  if ((m = t.match(/^([a-z]{3,9})\.?\s+(\d{4})$/)) && MONTHS[m[1]]) return `${m[2]}-${MONTHS[m[1]]}-01`
  if ((m = t.match(/^(\d{1,2})\/(\d{4})$/))) return `${m[2]}-${String(+m[1]).padStart(2, '0')}-01`
  if ((m = t.match(/^(\d{4})-(\d{1,2})$/))) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-01`
  if ((m = t.match(/^(\d{4})$/))) return `${m[1]}-01-01`
  return null
}

export interface DateRange {
  start: string
  end: string
  present: boolean
}

/** Extracts a start/end date range from a line, or null if none is present. */
export function parseDateRange(line: string): DateRange | null {
  const present = PRESENT.test(line)
  const isos = (line.match(DATE_TOKEN) || []).map(toISO).filter((x): x is string => !!x)
  if (!isos.length) return present ? { start: '', end: '', present: true } : null
  const start = isos[0]
  const end = present ? '' : isos.length >= 2 ? isos[isos.length - 1] : ''
  return { start, end, present }
}

function stripDatePortion(line: string): string {
  return line
    .replace(DATE_TOKEN, ' ')
    .replace(PRESENT, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,\-–—|]+|[\s,\-–—|]+$/g, '')
    .trim()
}

// ── Section segmentation ─────────────────────────────────────────────────────

type SectionKey = '_header' | 'summary' | 'experience' | 'projects' | 'education' | 'skills'

const SECTION_PATTERNS: { key: SectionKey; re: RegExp }[] = [
  { key: 'summary', re: /^(summary|profile|objective|about(\s*me)?|professional\s+summary)\b/i },
  { key: 'experience', re: /^(experience|work\s+experience|employment(\s+history)?|professional\s+experience|work\s+history)\b/i },
  { key: 'projects', re: /^(projects|personal\s+projects|selected\s+projects|side\s+projects)\b/i },
  { key: 'education', re: /^(education|academic\s+background)\b/i },
  { key: 'skills', re: /^(skills|technical\s+skills|technologies|core\s+competencies|skills\s*(&|and)\s*interests)\b/i },
]

/**
 * Split lines into sections. A line is a header when it matches a section keyword
 * AND is header-shaped — short, or (style-aware) bold / ALL-CAPS / larger than
 * body. Style relaxes the length gate so styled keyword headers aren't missed.
 */
function splitSections(lines: Line[]): Record<SectionKey, Line[]> {
  const sections = { _header: [], summary: [], experience: [], projects: [], education: [], skills: [] } as Record<SectionKey, Line[]>
  const body = bodyFontSize(lines)
  let current: SectionKey = '_header'
  for (const line of lines) {
    const t = line.text.trim()
    if (!t) continue
    const words = t.split(/\s+/).length
    const styled = line.bold || isAllCaps(t) || (body > 0 && line.fontSize >= body * 1.12)
    const headerish = (t.length <= 34 && words <= 4) || (styled && words <= 6)
    const hdr = headerish ? SECTION_PATTERNS.find((p) => p.re.test(t)) : undefined
    if (hdr) {
      current = hdr.key
      continue
    }
    sections[current].push(line)
  }
  return sections
}

// ── Section parsers ──────────────────────────────────────────────────────────

const BULLET = /^\s*(?:[•▪◦·‣]\s*|[-*]\s+)/
const URL = /(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|[\w-]+\.[a-z]{2,})(?:\/[^\s|,)]*)?/i
const dedupe = (a: string[]) => [...new Set(a.map((s) => s.trim()).filter(Boolean))]

/** Append a soft-wrapped continuation line to the previous bullet, de-hyphenating a word
 *  broken across the wrap (mirrors `dehyphenate` in textNormalize.ts). */
function joinWrap(prev: string, next: string): string {
  if (/[A-Za-z]{2,}-$/.test(prev) && /^[a-z]{2,}/.test(next)) return prev.slice(0, -1) + next
  return `${prev} ${next}`
}

/** Feature-scored contact fields (OpenResume-style weights for the name). */
function parseContact(lines: Line[]): Partial<ResumeData> {
  const out: Partial<ResumeData> = {}
  const joined = lines.map((l) => l.text).join('\n')
  const segs = lines.flatMap((l) => l.text.split(/[|•·]/)).map((s) => s.trim()).filter(Boolean)

  const email = joined.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) // first email = the applicant's
  if (email) out.email = email[0]

  const linkedin = joined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,]+/i)
  if (linkedin) out.linkedin = linkedin[0].replace(/^https?:\/\//, '').replace(/^www\./, '')

  const phone = joined.match(/\+?\(?\d[\d\s().-]{7,}\d/)
  if (phone) {
    const digits = phone[0].replace(/\D/g, '')
    if (digits.length >= 7 && digits.length <= 15) out.phone = phone[0].trim()
  }

  // Name: score each short header line; highest wins (must clear a floor so junk loses).
  let bestName = ''
  let bestScore = 2
  for (const l of lines) {
    const t = l.text.trim()
    if (!t || t.split(/\s+/).length > 6) continue
    let sc = 0
    if (/^[A-Za-z][A-Za-z\s.]*$/.test(t)) sc += 3
    if (isAllCaps(t)) sc += 2
    if (l.bold) sc += 2
    if (/@/.test(t)) sc -= 4
    if (/\d/.test(t)) sc -= 4
    if (/,/.test(t)) sc -= 4
    if (/\//.test(t)) sc -= 4
    if (sc > bestScore) ((bestScore = sc), (bestName = t))
  }
  if (bestName) {
    const parts = bestName.split(/\s+/)
    out.firstName = parts[0]
    out.lastName = parts.slice(1).join(' ')
  }

  const loc = segs.find(
    (s) => /^[A-Za-z.\-' ]+,\s*[A-Za-z.\-' ]{2,}$/.test(s) && !/@|http|linkedin/i.test(s) && s.length <= 40,
  )
  if (loc) out.location = loc

  return out
}

function detectEmployment(text: string): string {
  if (/\bintern(ship)?\b/i.test(text)) return 'Internship'
  if (/\bfreelance\b/i.test(text)) return 'Freelance'
  if (/\bcontract(or)?\b/i.test(text)) return 'Contract'
  if (/\bpart[\s-]?time\b/i.test(text)) return 'Part-time'
  return 'Full-time'
}

function assignRoleCompany(e: Experience, text: string): void {
  const t = text.trim()
  if (!t) return
  let m: RegExpMatchArray | null
  if ((m = t.match(/^(.*?)\s+at\s+(.+)$/i))) {
    e.role ||= m[1].trim()
    e.company ||= m[2].trim()
    return
  }
  const sep = t.split(/\s*[|–—]\s*|\s+[-]\s+/).map((x) => x.trim()).filter(Boolean)
  if (sep.length >= 2) {
    // If the part after the separator starts with a Roman numeral/number level suffix
    // (e.g. "I Fetch Rewards Inc" from "Senior Engineer - I Fetch Rewards Inc"),
    // re-attach the suffix to the role and use the remainder as company.
    const levelPrefix = /^(I{1,3}|IV|V|VI{0,3}|IX|X|\d+)\s+(.+)$/i
    const levelOnly = /^(I{1,3}|IV|V|VI{0,3}|IX|X|\d+)$/i
    if (sep.length === 2) {
      const lm = sep[1].match(levelPrefix)
      if (lm) {
        e.role ||= sep[0] + ' - ' + lm[1]
        e.company ||= lm[2].trim()
        return
      }
    } else if (sep.length >= 3 && levelOnly.test(sep[1])) {
      e.role ||= sep[0] + ' - ' + sep[1]
      e.company ||= sep.slice(2).join(' ')
      return
    }
    e.role ||= sep[0]
    e.company ||= sep.slice(1).join(' ')
    return
  }
  if (!e.role) e.role = t
  else if (!e.company) e.company = t
}

/** Entries anchored on date-range lines; when a section has no dates, on big vertical gaps or bold titles. */
function parseExperience(lines: Line[]): Experience[] {
  const typicalGap = median(lines.map((l) => l.gapBefore).filter((g) => g > 0 && g < 900)) || 1
  const hasDates = lines.some((l) => {
    const d = parseDateRange(l.text.trim())
    return !!(d && d.start)
  })
  const entries: Experience[] = []
  let cur: Experience | null = null
  let bullets: string[] = []
  let pending: string[] = []
  const flushBullets = () => {
    if (cur) cur.bulletsText = bullets.join('\n')
    bullets = []
  }
  const startEntry = (headerText: string, dr: DateRange | null, boldTitle = false): Experience => {
    flushBullets()
    const e: Experience = {
      id: genId(), company: '', role: '', employment: detectEmployment(headerText),
      start: dr?.start ?? '', end: dr?.end ?? '', present: dr?.present ?? false, bulletsText: '',
    }
    entries.push(e)
    const rest = stripDatePortion(headerText)
    if (rest) {
      // A bold standalone title (no "at"/dash separator) is almost always the company.
      if (boldTitle && !/\s+at\s+|[|–—]/i.test(rest)) e.company = rest
      else assignRoleCompany(e, rest)
    }
    for (const p of pending) {
      if (e.role && e.company) break
      assignRoleCompany(e, p)
    }
    pending = []
    return e
  }
  for (const line of lines) {
    const t = line.text.trim()
    if (!t) continue
    const isBullet = BULLET.test(line.text)
    const dr = !isBullet ? parseDateRange(t) : null
    const bigGap = line.gapBefore > typicalGap * 1.4 && line.gapBefore < 900
    if (dr && dr.start) {
      cur = startEntry(t, dr)
      continue
    }
    // Secondary split (only once an entry is open) for date-less layouts; and a
    // first-entry fallback when the section has no dates at all.
    const styleStart = !isBullet && cur != null && (bigGap || line.bold) && (!!cur.role || !!cur.company || bullets.length > 0)
    const firstStart = !isBullet && !cur && !hasDates
    if (styleStart || firstStart) {
      cur = startEntry(t, null, line.bold)
      continue
    }
    if (isBullet) {
      const b = t.replace(BULLET, '').trim()
      if (b) {
        // A bulleted line whose text starts lowercase is almost always a wrapped
        // continuation of the previous bullet that got its own marker (e.g. a résumé
        // re-exported from already-fragmented bullets), not a new bullet — real résumé
        // bullets start with a capitalized action verb.
        if (bullets.length > 0 && /^[a-z]/.test(b) && !/[.!?]$/.test(bullets[bullets.length - 1])) {
          bullets[bullets.length - 1] = joinWrap(bullets[bullets.length - 1], b)
        } else {
          bullets.push(b)
        }
      }
      pending = []
      continue
    }
    if (cur && bullets.length > 0) {
      // A marker-less, normal-gap line after a bullet is a soft-wrap continuation, not a
      // new bullet — new entries were already split off above (date / bold / big-gap).
      // Mirrors parseProjects' description handling.
      bullets[bullets.length - 1] = joinWrap(bullets[bullets.length - 1], t)
    } else if (cur && (!cur.role || !cur.company)) {
      assignRoleCompany(cur, t)
    } else {
      pending.push(t)
      if (pending.length > 3) pending.shift()
    }
  }
  flushBullets()
  return entries.filter((e) => e.company || e.role || e.bulletsText)
}

function parseEducation(lines: Line[]): Education[] {
  const SCHOOL = /(university|college|institute|\bschool\b|polytechnic|academy)/i
  const DEGREE = /(bachelor|master|associate|ph\.?d|b\.?sc?|m\.?sc?|m\.?b\.?a|b\.?a\b|b\.?tech|m\.?tech|b\.?e\b|diploma|degree)/i
  const stripExtras = (l: string) =>
    l.replace(DATE_TOKEN, '').replace(/\bGPA.*$/i, '').replace(/\s{2,}/g, ' ').replace(/[|,–—]+\s*$/, '').trim()
  const typicalGap = median(lines.map((l) => l.gapBefore).filter((g) => g > 0 && g < 900)) || 1
  const entries: Education[] = []
  const newEntry = (): Education => {
    const e: Education = { id: genId(), school: '', degree: '', start: '', end: '', extraDetails: [] }
    entries.push(e)
    return e
  }
  let cur: Education | null = null
  for (const line of lines) {
    const t = line.text.trim()
    if (!t) continue
    const bigGap = line.gapBefore > typicalGap * 1.4 && line.gapBefore < 900
    // New entry on a second school OR a second degree line (résumés list either first),
    // as well as on a big vertical gap.
    if (!cur || (SCHOOL.test(t) && cur.school) || (DEGREE.test(t) && cur.degree) || (bigGap && (cur.school || cur.degree))) cur = newEntry()
    if (SCHOOL.test(t) && !cur.school) cur.school = stripExtras(t)
    else if (DEGREE.test(t) && !cur.degree) cur.degree = stripExtras(t)
    const dr = parseDateRange(t)
    if (dr && dr.start && !cur.start) {
      cur.start = dr.start
      cur.end = dr.end
    }
    const gpa = t.match(/\bGPA[:\s]*([0-4](?:\.\d{1,2})?)(?:\s*\/\s*([0-5](?:\.\d+)?))?/i)
    if (gpa && !cur.extraDetails.some((d) => d.label === 'GPA')) {
      cur.extraDetails.push({ label: 'GPA', value: gpa[2] ? `${gpa[1]}/${gpa[2]}` : gpa[1] })
    }
  }
  return entries.filter((e) => e.school || e.degree)
}

function parseProjects(lines: Line[]): Project[] {
  const gaps = lines.map((l) => l.gapBefore).filter((g) => g > 0 && g < 900)
  const typicalGap = Math.max(8, gaps.length ? median(gaps) : 12)
  // Comma-separated short items with no sentence structure → likely a tech stack line
  const looksLikeTechStack = (s: string): boolean => {
    const parts = s.replace(/[.!?]$/, '').split(/,\s*/)
    return parts.length >= 2 && parts.every((p) => p.trim().split(/\s+/).length <= 4 && p.trim().length > 0)
  }
  const projects: Project[] = []
  let cur: Project | null = null
  let lastLineEnded = false
  for (const line of lines) {
    const t = line.text.trim()
    if (!t) continue
    const isBullet = BULLET.test(line.text)
    if (!isBullet && (!cur || line.gapBefore > typicalGap * 1.1 || (line.bold && /^[A-Z\d"'(]/.test(t)))) {
      cur = { id: genId(), name: '', link: '', description: '', techStack: [], techStackDraft: '' }
      lastLineEnded = false
      const link = t.match(URL)
      const isLink = !!link && /\/|github|gitlab|\.(io|com|dev|app|org|net)\b/i.test(link[0])
      if (isLink) cur.link = link![0].replace(/^https?:\/\//, '')
      cur.name = (isLink ? t.replace(link![0], '') : t)
        .replace(/[|–—-]+\s*$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      projects.push(cur)
    } else if (cur) {
      const d = t.replace(BULLET, '').trim()
      if (d) {
        // First content line that looks like comma-separated tech items → tech stack
        if (!cur.description && !cur.techStack?.length && !isBullet && looksLikeTechStack(d)) {
          cur.techStack = splitItems(d.replace(/[.!?]$/, ''))
        } else {
          // Only start a new bullet at sentence boundaries; word-wraps join with space
          const isNewBullet = isBullet || (lastLineEnded && /^[A-Z]/.test(d))
          cur.description = cur.description
            ? (isNewBullet ? `${cur.description}\n${d}` : `${cur.description} ${d}`)
            : d
          lastLineEnded = /[.!?]$/.test(d)
        }
      }
    }
  }
  return projects.filter((p) => p.name)
}

function splitItems(s: string): string[] {
  return s
    .split(/[,;|•·]|\s{2,}/)
    .map((x) => x.trim())
    .filter((x) => x && x.length <= 40)
}

function parseSkills(lines: Line[]): SkillGroup[] {
  const groups: SkillGroup[] = []
  const loose: string[] = []
  for (const line of lines) {
    const t = line.text.trim().replace(BULLET, '')
    if (!t) continue
    const m = t.match(/^([A-Za-z][A-Za-z0-9 &/+#-]{1,30}):\s*(.+)$/)
    if (m) {
      const items = splitItems(m[2])
      if (items.length) groups.push({ id: genId(), label: m[1].trim(), items, draft: '' })
    } else {
      loose.push(...splitItems(t))
    }
  }
  if (loose.length) groups.push({ id: genId(), label: groups.length ? 'Other' : 'Skills', items: dedupe(loose), draft: '' })
  return groups.filter((g) => g.items.length)
}

// ── Extraction (file → Line[]) ───────────────────────────────────────────────

/** Best-effort de-macro of a LaTeX source into readable text. */
function deLatex(tex: string): string {
  return tex
    .replace(/(^|[^\\])%.*$/gm, '$1')
    .replace(/\\(?:section|subsection|textbf|textit|emph|underline|textsc|href)\*?\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:section|subsection|textbf|textit|emph|underline|textsc)\*?\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\item\s*/g, '\n• ')
    .replace(/\\\\/g, '\n')
    .replace(/\\(?:begin|end)\s*\{[^}]*\}/g, '')
    .replace(/\\([&%_#$])/g, '$1')
    .replace(/\\[a-zA-Z]+\*?/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Synthesize `Line[]` from plain text: neutral style, `gapBefore` from blank lines. */
function textToLines(text: string): Line[] {
  const lines: Line[] = []
  let prevBlank = true
  for (const row of text.split('\n')) {
    const t = row.trim()
    if (!t) {
      prevBlank = true
      continue
    }
    lines.push({ text: t, x: 0, y: -lines.length, fontSize: 0, bold: false, gapBefore: prevBlank ? 2 : 1 })
    prevBlank = false
  }
  return lines
}

async function extractLines(file: File): Promise<Line[]> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return extractPdfLines(file)
  let raw = await file.text()
  if (ext === 'tex') raw = deLatex(raw)
  return textToLines(dehyphenate(normalizeText(raw)))
}

// ── Assembly ─────────────────────────────────────────────────────────────────

export function parseResumeLines(lines: Line[]): Partial<ResumeData> {
  const sections = splitSections(lines)
  const data: Partial<ResumeData> = { ...parseContact(sections._header) }

  const summary = sections.summary.map((l) => l.text.trim()).filter(Boolean).join(' ').trim()
  if (summary) data.summary = summary

  const experience = parseExperience(sections.experience)
  if (experience.length) data.experience = experience

  const projects = parseProjects(sections.projects)
  if (projects.length) data.projects = projects

  const education = parseEducation(sections.education)
  if (education.length) data.education = education

  const skillGroups = parseSkills(sections.skills)
  if (skillGroups.length) data.skillGroups = skillGroups

  return data
}

/** Parse résumé text directly (text formats + tests). PDFs go through `importResume`. */
export function parseResumeText(text: string): Partial<ResumeData> {
  return parseResumeLines(textToLines(text))
}

export async function importResume(file: File): Promise<ImportOutcome> {
  const lines = await extractLines(file)
  const parsed = parseResumeLines(lines)
  const data = normalizeResumeData(parsed as Record<string, unknown>)
  const ok = Boolean(
    data.firstName ||
      data.email ||
      data.phone ||
      data.summary ||
      data.experience?.length ||
      data.education?.length ||
      data.skillGroups?.length,
  )
  return { data, ok }
}
