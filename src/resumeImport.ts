import type { StructuredTextItem } from 'unpdf'
import { normalizeResumeData } from './normalize'
import type { Education, Experience, Project, ResumeData, SkillGroup } from './types'

/**
 * Client-side, heuristic résumé importer. Extracts text from a file (unpdf for
 * PDFs; plain read for text formats) and maps it to `ResumeData` with regex /
 * keyword heuristics — no AI, no network. Best-effort by nature: varied and
 * multi-column layouts will miss or mis-assign fields, and scanned/image PDFs
 * yield little text (the caller guards against wiping the form on empty results).
 */

export interface ImportOutcome {
  data: Partial<ResumeData>
  /** True when we extracted enough to be worth applying to the form. */
  ok: boolean
}

// ── File → raw text ────────────────────────────────────────────────────────

export async function extractText(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return extractPdfText(file)
  const raw = await file.text()
  return ext === 'tex' ? deLatex(raw) : raw
}

async function extractPdfText(file: File): Promise<string> {
  // Lazy-loaded so unpdf (which bundles pdf.js) stays out of the main bundle and
  // only downloads when a user actually imports a PDF. unpdf inlines its worker,
  // so no Vite workerSrc setup is needed.
  const { extractTextItems } = await import('unpdf')
  const buf = new Uint8Array(await file.arrayBuffer())
  const { items } = await extractTextItems(buf)
  return itemsToText(items)
}

/**
 * Reconstruct reading-order lines from positioned PDF text items. Grouping items
 * by their y-coordinate (then sorting left-to-right by x) recovers line structure
 * that naive concatenation scrambles — the main mitigation for messy PDFs.
 * y-origin is bottom-left, so higher y = higher on the page.
 */
function itemsToText(pages: StructuredTextItem[][]): string {
  const out: string[] = []
  for (const page of pages) {
    const its = page.filter((i) => i.str && i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
    let line: StructuredTextItem[] = []
    let lineY: number | null = null
    const flush = () => {
      if (!line.length) return
      const text = line
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) out.push(text)
      line = []
    }
    for (const it of its) {
      const tol = Math.max(2, (it.height || it.fontSize || 8) * 0.5)
      if (lineY === null || Math.abs(it.y - lineY) <= tol) {
        line.push(it)
        if (lineY === null) lineY = it.y
      } else {
        flush()
        line = [it]
        lineY = it.y
      }
    }
    flush()
    out.push('') // blank line between pages
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Best-effort de-macro of a LaTeX source into readable text. */
function deLatex(tex: string): string {
  return tex
    .replace(/(^|[^\\])%.*$/gm, '$1') // strip comments (keep \%)
    .replace(/\\(?:section|subsection|textbf|textit|emph|underline|textsc|href)\*?\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:section|subsection|textbf|textit|emph|underline|textsc)\*?\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\item\s*/g, '\n• ')
    .replace(/\\\\/g, '\n')
    .replace(/\\(?:begin|end)\s*\{[^}]*\}/g, '')
    .replace(/\\([&%_#$])/g, '$1') // unescape
    .replace(/\\[a-zA-Z]+\*?/g, ' ') // drop remaining commands
    .replace(/[{}]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Dates ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
  aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10',
  october: '10', nov: '11', november: '11', dec: '12', december: '12',
}

// Month name + year (real months only — a broad `[A-Za-z]{3,9}` would swallow any
// word before a year, e.g. "Technolog(y) 2014"), or MM/YYYY, or YYYY-MM, or a bare year.
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
  // Note: don't strip –/—/| here — those separate role from company; only the
  // leading/trailing cleanup below removes any left orphaned by the removed dates.
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

function splitSections(text: string): Record<SectionKey, string[]> {
  const sections = { _header: [], summary: [], experience: [], projects: [], education: [], skills: [] } as Record<SectionKey, string[]>
  let current: SectionKey = '_header'
  for (const line of text.split('\n')) {
    const t = line.trim()
    const isHeaderCandidate = t.length > 0 && t.length <= 34 && t.split(/\s+/).length <= 4
    const hdr = isHeaderCandidate ? SECTION_PATTERNS.find((p) => p.re.test(t)) : undefined
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

function parseContact(lines: string[]): Partial<ResumeData> {
  const out: Partial<ResumeData> = {}
  const text = lines.join('\n')
  const segs = lines.flatMap((l) => l.split(/[|•·]/)).map((s) => s.trim()).filter(Boolean)

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  if (email) out.email = email[0]

  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,]+/i)
  if (linkedin) out.linkedin = linkedin[0].replace(/^https?:\/\//, '').replace(/^www\./, '')

  const phone = text.match(/\+?\(?\d[\d\s().-]{7,}\d/)
  if (phone) {
    const digits = phone[0].replace(/\D/g, '')
    if (digits.length >= 7 && digits.length <= 15) out.phone = phone[0].trim()
  }

  const name = lines
    .map((l) => l.trim())
    .find((l) => l && !/@|\d|linkedin|http|\bresume\b|curriculum|\bcv\b/i.test(l) && l.split(/\s+/).length <= 5)
  if (name) {
    const parts = name.split(/\s+/)
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
    e.role ||= sep[0]
    e.company ||= sep.slice(1).join(' ')
    return
  }
  if (!e.role) e.role = t
  else if (!e.company) e.company = t
}

function parseExperience(lines: string[]): Experience[] {
  const entries: Experience[] = []
  let cur: Experience | null = null
  let bullets: string[] = []
  let pending: string[] = []
  const flushBullets = () => {
    if (cur) cur.bulletsText = bullets.join('\n')
    bullets = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const isBullet = BULLET.test(raw)
    const dr = !isBullet ? parseDateRange(line) : null
    if (dr && dr.start) {
      flushBullets()
      cur = { company: '', role: '', employment: detectEmployment(line), start: dr.start, end: dr.end, present: dr.present, bulletsText: '' }
      entries.push(cur)
      const rest = stripDatePortion(line)
      if (rest) assignRoleCompany(cur, rest)
      for (const p of pending) {
        if (cur.role && cur.company) break
        assignRoleCompany(cur, p)
      }
      pending = []
      continue
    }
    if (isBullet) {
      const b = line.replace(BULLET, '').trim()
      if (b) bullets.push(b)
      pending = []
      continue
    }
    if (cur && bullets.length > 0) {
      bullets.push(line)
    } else if (cur && (!cur.role || !cur.company)) {
      assignRoleCompany(cur, line)
    } else {
      pending.push(line)
      if (pending.length > 3) pending.shift()
    }
  }
  flushBullets()
  return entries.filter((e) => e.company || e.role || e.bulletsText)
}

function parseEducation(lines: string[]): Education[] {
  const SCHOOL = /(university|college|institute|\bschool\b|polytechnic|academy)/i
  const DEGREE = /(bachelor|master|associate|ph\.?d|b\.?sc?|m\.?sc?|m\.?b\.?a|b\.?a\b|b\.?tech|m\.?tech|b\.?e\b|diploma|degree)/i
  const stripExtras = (l: string) =>
    l.replace(DATE_TOKEN, '').replace(/\bGPA.*$/i, '').replace(/\s{2,}/g, ' ').replace(/[|,–—]+\s*$/, '').trim()
  const entries: Education[] = []
  const newEntry = (): Education => {
    const e: Education = { school: '', degree: '', start: '', end: '', extraDetails: [] }
    entries.push(e)
    return e
  }
  let cur: Education | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (!cur || (SCHOOL.test(line) && cur.school)) cur = newEntry()
    if (SCHOOL.test(line) && !cur.school) cur.school = stripExtras(line)
    else if (DEGREE.test(line) && !cur.degree) cur.degree = stripExtras(line)
    const dr = parseDateRange(line)
    if (dr && dr.start && !cur.start) {
      cur.start = dr.start
      cur.end = dr.end
    }
    const gpa = line.match(/\bGPA[:\s]*([0-4](?:\.\d{1,2})?)(?:\s*\/\s*([0-5](?:\.\d+)?))?/i)
    if (gpa && !cur.extraDetails.some((d) => d.label === 'GPA')) {
      cur.extraDetails.push({ label: 'GPA', value: gpa[2] ? `${gpa[1]}/${gpa[2]}` : gpa[1] })
    }
  }
  return entries.filter((e) => e.school || e.degree)
}

function parseProjects(lines: string[]): Project[] {
  const projects: Project[] = []
  let cur: Project | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      cur = null
      continue
    }
    const isBullet = BULLET.test(raw)
    if (!cur && !isBullet) {
      cur = { name: '', link: '', description: '' }
      const link = line.match(URL)
      const isLink = !!link && /\/|github|gitlab|\.(io|com|dev|app|org|net)\b/i.test(link[0])
      if (isLink) cur.link = link![0].replace(/^https?:\/\//, '')
      cur.name = (isLink ? line.replace(link![0], '') : line)
        .replace(/[|–—-]+\s*$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      projects.push(cur)
    } else if (cur) {
      const d = line.replace(BULLET, '').trim()
      if (d) cur.description = cur.description ? `${cur.description} ${d}` : d
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

function parseSkills(lines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = []
  const loose: string[] = []
  for (const raw of lines) {
    const line = raw.trim().replace(BULLET, '')
    if (!line) continue
    const m = line.match(/^([A-Za-z][A-Za-z0-9 &/+#-]{1,30}):\s*(.+)$/)
    if (m) {
      const items = splitItems(m[2])
      if (items.length) groups.push({ label: m[1].trim(), items, draft: '' })
    } else {
      loose.push(...splitItems(line))
    }
  }
  if (loose.length) groups.push({ label: groups.length ? 'Other' : 'Skills', items: dedupe(loose), draft: '' })
  return groups.filter((g) => g.items.length)
}

// ── Assembly ─────────────────────────────────────────────────────────────────

export function parseResumeText(text: string): Partial<ResumeData> {
  const sections = splitSections(text)
  const data: Partial<ResumeData> = { ...parseContact(sections._header) }

  const summary = sections.summary.map((l) => l.trim()).filter(Boolean).join(' ').trim()
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

export async function importResume(file: File): Promise<ImportOutcome> {
  const text = await extractText(file)
  const parsed = parseResumeText(text)
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
