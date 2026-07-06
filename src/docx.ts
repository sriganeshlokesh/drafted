import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from 'docx'
import type { PaperSize, ResumeData } from './types'
import { expDates, fmtMonth } from './tex'
import { clampFontScale } from './fontScale'

const FONT   = 'Georgia'   // matches PDF's serif (Computer Modern / Georgia)
// Base half-point sizes (10 pt body / 9 pt contact / 26 pt name). Reassigned per
// call from the résumé's fontScale so Word exports track the A− / A+ setting.
let SZ       = 20          // half-points = 10 pt body
let SZ_SM    = 18          // 9 pt — contact line
let NAME_SZ  = 52          // 26 pt — name/header

// ── Rich-text helpers ─────────────────────────────────────────────────────────

function nodeToRuns(node: ChildNode, bold = false, italic = false): TextRun[] {
  if (node.nodeType === 3) {
    const text = (node as Text).data
    return text ? [new TextRun({ text, bold, italics: italic, font: FONT, size: SZ })] : []
  }
  const el = node as Element
  const tag = el.tagName?.toLowerCase()
  const b = bold || tag === 'strong' || tag === 'b'
  const i = italic || tag === 'em' || tag === 'i'
  return Array.from(el.childNodes).flatMap((c) => nodeToRuns(c, b, i))
}

function htmlToBodyParagraphs(html: string): Paragraph[] {
  if (!html) return []
  const dom = new DOMParser().parseFromString(html, 'text/html')
  const out: Paragraph[] = []

  function process(node: ChildNode) {
    if (node.nodeType === 3) {
      const text = (node as Text).data.trim()
      if (text) out.push(body(text))
      return
    }
    const el = node as Element
    const tag = el.tagName?.toLowerCase()
    if (tag === 'p') {
      const runs = Array.from(el.childNodes).flatMap((c) => nodeToRuns(c))
      if (runs.length) out.push(new Paragraph({ children: runs, alignment: AlignmentType.BOTH, spacing: { after: 60 } }))
    } else if (tag === 'ul') {
      for (const li of Array.from(el.querySelectorAll('li'))) {
        const runs = Array.from(li.childNodes).flatMap((c) => nodeToRuns(c))
        if (runs.length) {
          out.push(new Paragraph({
            children: runs,
            numbering: { reference: 'resume-bullets', level: 0 },
            alignment: AlignmentType.BOTH,
            spacing: { after: 40 },
          }))
        }
      }
    } else {
      Array.from(el.childNodes).forEach(process)
    }
  }

  Array.from(dom.body.childNodes).forEach(process)
  return out
}

// ── Layout primitives ────────────────────────────────────────────────────────

function body(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, font: FONT, size: SZ })], alignment: AlignmentType.BOTH, spacing: { after: 60 } })
}

function sectionHead(title: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: title.toUpperCase(), bold: true, font: FONT, size: SZ })],
    border: { bottom: { color: '000000', size: 6, style: BorderStyle.SINGLE, space: 3 } },
    spacing: { before: 200, after: 80 },
  })
}

function headerLine(left: TextRun[], rightText: string): Paragraph {
  return new Paragraph({
    children: [
      ...left,
      new TextRun({ text: '\t', font: FONT, size: SZ }),
      new TextRun({ text: rightText, font: FONT, size: SZ, italics: true }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 140, after: 20 },
  })
}

function subLine(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: SZ - 2, italics: true })],
    spacing: { after: 60 },
  })
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function genDocx(s: ResumeData, _paperSize: PaperSize): Promise<Blob> {
  // Scale the shared half-point sizes for this export (Word requires integers).
  // Read synchronously below before the single trailing await — same
  // reset-at-entry pattern as keyCtr in resumePdf.tsx.
  const scale = clampFontScale(s.fontScale ?? 1)
  SZ = Math.round(20 * scale)
  SZ_SM = Math.round(18 * scale)
  NAME_SZ = Math.round(52 * scale)

  const children: Paragraph[] = []

  // ── Name ──────────────────────────────────────────────────────────────────
  const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ')
  if (fullName) {
    children.push(new Paragraph({
      // style carries centering into Pages; alignment is the Word fallback
      style: 'ResumeTitle',
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: fullName, bold: true, font: FONT, size: NAME_SZ })],
    }))
  }

  // ── Contact line ──────────────────────────────────────────────────────────
  const contact = [
    s.email,
    s.phone,
    s.location,
    (s.linkedin || '').replace(/^https?:\/\/(www\.)?/, ''),
  ].filter(Boolean).join('  |  ')
  if (contact) {
    children.push(new Paragraph({
      style: 'ResumeContact',
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contact, font: FONT, size: SZ_SM })],
    }))
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (s.summary.replace(/<[^>]*>/g, '').trim()) {
    children.push(sectionHead('Summary'))
    children.push(...htmlToBodyParagraphs(s.summary))
  }

  // ── Experience ────────────────────────────────────────────────────────────
  const exp = s.experience.filter((x) => x.company || x.role)
  if (exp.length) {
    children.push(sectionHead('Experience'))
    for (const x of exp) {
      const dateStr = expDates(x)
      const leftRuns: TextRun[] = [
        new TextRun({ text: x.role, bold: true, font: FONT, size: SZ }),
        ...(x.company ? [new TextRun({ text: ` | ${x.company}`, font: FONT, size: SZ })] : []),
      ]
      children.push(headerLine(leftRuns, dateStr))
      children.push(...htmlToBodyParagraphs(x.bulletsText || ''))
    }
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  const projects = s.projects.filter((x) => x.name)
  if (projects.length) {
    children.push(sectionHead('Projects'))
    for (const x of projects) {
      children.push(headerLine(
        [new TextRun({ text: x.name, bold: true, font: FONT, size: SZ })],
        x.link || '',
      ))
      if (x.techStack?.length) children.push(new Paragraph({ children: [new TextRun({ text: x.techStack.join(', '), font: FONT, size: SZ, italics: true })], spacing: { after: 60 } }))
      if (x.description) children.push(...htmlToBodyParagraphs(x.description))
    }
  }

  // ── Education ─────────────────────────────────────────────────────────────
  const edu = s.education.filter((x) => x.school || x.degree)
  if (edu.length) {
    children.push(sectionHead('Education'))
    for (const x of edu) {
      const dates = [fmtMonth(x.start), fmtMonth(x.end)].filter(Boolean).join(' – ')
      children.push(headerLine(
        [new TextRun({ text: x.degree, bold: true, font: FONT, size: SZ })],
        dates,
      ))
      if (x.school) {
        const details = (x.extraDetails || [])
          .filter((d) => d.value)
          .map((d) => `${d.label}: ${d.value}`)
          .join('  ·  ')
        children.push(subLine(details ? `${x.school}  ·  ${details}` : x.school))
      }
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  const skills = s.skillGroups.filter((g) => g.items.length)
  if (skills.length) {
    children.push(sectionHead('Skills'))
    for (const g of skills) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${g.label}: `, bold: true, font: FONT, size: SZ }),
          new TextRun({ text: g.items.join(', '), font: FONT, size: SZ }),
        ],
        spacing: { after: 60 },
      }))
    }
  }

  const doc = new Document({
    // Define centered styles so Pages (which ignores direct <w:jc>) uses style-level alignment.
    // Word uses direct alignment (also set on the Paragraph); both renderers see centering.
    styles: {
      paragraphStyles: [
        {
          id: 'ResumeTitle',
          name: 'Resume Title',
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          },
          run: {
            bold: true,
            font: FONT,
            size: NAME_SZ,
          },
        },
        {
          id: 'ResumeContact',
          name: 'Resume Contact',
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
          },
          run: {
            font: FONT,
            size: SZ_SM,
          },
        },
      ],
    },
    numbering: {
      config: [{
        reference: 'resume-bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 360, hanging: 180 } },
          },
        }],
      }],
    },
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
      },
      children,
    }],
  })

  const buf = await Packer.toArrayBuffer(doc)
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
