import type { PaperSize, ResumeData } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2019-08" / "2019-08-15" -> "Aug 2019". Passes other strings through. */
export function fmtMonth(s: string): string {
  if (/^\d{4}-\d{2}/.test(s)) {
    const p = s.split('-')
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0]
  }
  return s || ''
}

export function expDates(x: { start: string; end: string; present: boolean }): string {
  const s = fmtMonth(x.start)
  const e = x.present ? 'Present' : fmtMonth(x.end)
  return [s, e].filter(Boolean).join(' – ')
}

function esc(t: string): string {
  return (t || '').replace(/([&%#_])/g, '\\$1')
}

function nodeToTex(node: ChildNode): string {
  if (node.nodeType === 3) return esc((node as Text).data)
  const el = node as Element
  const kids = Array.from(el.childNodes).map(nodeToTex).join('')
  switch (el.tagName?.toLowerCase()) {
    case 'p':      return kids.trim() ? kids + '\n\n' : ''
    case 'strong':
    case 'b':      return `\\textbf{${kids}}`
    case 'em':
    case 'i':      return `\\textit{${kids}}`
    case 'ul':     return `\\begin{itemize}\n${kids}\\end{itemize}\n`
    case 'li':     return `\\item ${kids.trim()}\n`
    case 'br':     return '\\\\\n'
    default:       return kids
  }
}

function htmlToTex(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.childNodes).map(nodeToTex).join('').trim()
}

/** Generates the LaTeX source shown in the .tex tab and used for the simulated download. */
export function genTex(s: ResumeData, paperSize: PaperSize): string {
  const e = esc
  const L: string[] = []
  const full = [s.firstName, s.lastName].filter(Boolean).join(' ')
  L.push('\\documentclass[11pt,' + (paperSize === 'A4' ? 'a4paper' : 'letterpaper') + ']{article}')
  L.push('\\usepackage[margin=1in]{geometry}')
  L.push('\\usepackage{enumitem,titlesec,hyperref}')
  L.push('\\titleformat{\\section}{\\large\\scshape\\bfseries}{}{0pt}{}[\\titlerule]')
  L.push('\\titlespacing*{\\section}{0pt}{12pt}{6pt}')
  L.push('\\setlist[itemize]{leftmargin=1.3em,itemsep=1pt,topsep=2pt}')
  L.push('\\pagestyle{empty}')
  L.push('')
  L.push('\\begin{document}')
  L.push('\\begin{center}')
  L.push('  {\\LARGE \\textbf{' + e(full) + '}} \\\\[4pt]')
  const c = [e(s.email), e(s.location), e((s.linkedin || '').replace(/^https?:\/\/(www\.)?/, '')), e(s.phone)]
    .filter(Boolean)
    .join('  $|$  ')
  if (c) L.push('  ' + c)
  L.push('\\end{center}')
  L.push('')
  if (s.summary.replace(/<[^>]*>/g, '').trim()) {
    L.push('\\section*{Summary}')
    L.push(htmlToTex(s.summary))
    L.push('')
  }
  if (s.experience.length) {
    L.push('\\section*{Experience}')
    s.experience.forEach((x) => {
      L.push('\\noindent\\textbf{' + e(x.role) + '}, ' + e(x.company) + ' \\hfill \\textit{' + e(expDates(x)) + '}')
      const bulletsLatex = htmlToTex(x.bulletsText || '')
      if (bulletsLatex) L.push(bulletsLatex)
      L.push('')
    })
  }
  if (s.projects.length) {
    L.push('\\section*{Projects}')
    s.projects.forEach((x) => {
      L.push('\\noindent\\textbf{' + e(x.name) + '} \\hfill \\texttt{' + e(x.link) + '} \\\\')
      if (x.description) L.push(htmlToTex(x.description))
      L.push('')
    })
  }
  if (s.education.length) {
    L.push('\\section*{Education}')
    s.education.forEach((x) => {
      L.push(
        '\\noindent\\textbf{' +
          e(x.degree) +
          '} \\hfill \\textit{' +
          e([fmtMonth(x.start), fmtMonth(x.end)].filter(Boolean).join(' -- ')) +
          '} \\\\',
      )
      const detailStr = (x.extraDetails || []).filter((d: {label:string;value:string}) => d.value).map((d: {label:string;value:string}) => `${d.label}: ${d.value}`).join(' · ')
      L.push(e(x.school) + (detailStr ? ' \\hfill ' + e(detailStr) : ''))
      L.push('')
    })
  }
  const sg = s.skillGroups.filter((g) => (g.items || []).length)
  if (sg.length) {
    L.push('\\section*{Skills}')
    sg.forEach((g) => L.push('\\noindent\\textbf{' + e(g.label) + '}: ' + e((g.items || []).join(', ')) + ' \\\\'))
    L.push('')
  }
  L.push('\\end{document}')
  return L.join('\n')
}
