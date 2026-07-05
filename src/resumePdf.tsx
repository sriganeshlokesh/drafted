import { Document, Page, View, Text, Link, Font, pdf } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type { Education, Experience, PaperSize, Project, ResumeData } from './types'
import { expDates, fmtMonth } from './tex'
import { clampFontScale } from './fontScale'

/**
 * Vector-text PDF export via @react-pdf/renderer. Emits real, selectable text with
 * embedded Computer Modern (the same TTFs the on-screen preview renders with), so
 * the export is crisp at any zoom, tiny, and natively re-importable — replacing the
 * old html2canvas raster. Layout mirrors `resumeBody` in ResumeBuilder / `genTex`.
 */

// The Computer Modern Serif family the preview already uses (public/fonts).
Font.register({
  family: 'CMU Serif',
  fonts: [
    { src: '/fonts/cmunrm.ttf' },
    { src: '/fonts/cmunbx.ttf', fontWeight: 'bold' },
    { src: '/fonts/cmunti.ttf', fontStyle: 'italic' },
    { src: '/fonts/cmunbi.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  ],
})
Font.register({ family: 'CMU Typewriter', fonts: [{ src: '/fonts/cmuntt.ttf' }] })
// Keep words whole (no mid-word hyphenation) — cleaner justified text.
Font.registerHyphenationCallback((word) => [word])

const LINK = '#2b5fb3'

// ── Rich text (Tiptap HTML) → react-pdf nodes, mirroring nodeToTex in tex.ts ──
let keyCtr = 0
const k = () => `n${keyCtr++}`

function inline(node: ChildNode): ReactNode {
  if (node.nodeType === 3) return (node as CharacterData).data
  const el = node as Element
  const kids = Array.from(el.childNodes).map(inline)
  switch (el.tagName?.toLowerCase()) {
    case 'strong':
    case 'b':
      return <Text key={k()} style={{ fontWeight: 'bold' }}>{kids}</Text>
    case 'em':
    case 'i':
      return <Text key={k()} style={{ fontStyle: 'italic' }}>{kids}</Text>
    default:
      return <Text key={k()}>{kids}</Text>
  }
}

/** Parse a rich-text HTML string into paragraph / bullet-list react-pdf blocks. */
function richBlocks(html: string): ReactNode[] {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const out: ReactNode[] = []
  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === 3) {
      const t = (node as CharacterData).data.trim()
      if (t) out.push(<Text key={k()} style={{ marginBottom: 3, textAlign: 'justify' }}>{t}</Text>)
      continue
    }
    const el = node as Element
    const tag = el.tagName?.toLowerCase()
    if (tag === 'ul') {
      for (const li of Array.from(el.children)) {
        if (li.tagName?.toLowerCase() !== 'li') continue
        out.push(
          <View key={k()} style={{ flexDirection: 'row', marginBottom: 1 }}>
            <Text style={{ width: 13 }}>•</Text>
            <Text style={{ flex: 1, textAlign: 'justify' }}>{Array.from(li.childNodes).map(inline)}</Text>
          </View>,
        )
      }
    } else if (el.textContent?.trim()) {
      out.push(<Text key={k()} style={{ marginBottom: 3, textAlign: 'justify' }}>{Array.from(el.childNodes).map(inline)}</Text>)
    }
  }
  return out
}

const stripTags = (html: string) => (html || '').replace(/<[^>]*>/g, '').trim()
const stripProto = (s: string) => (s || '').replace(/^https?:\/\/(www\.)?/, '')

// ── Building blocks ──────────────────────────────────────────────────────────

function SectionHeading({ children, fz }: { children: string; fz: number }) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', marginTop: 11, marginBottom: 5, paddingBottom: 2 }} wrap={false}>
      <Text style={{ fontSize: 12 * fz, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</Text>
    </View>
  )
}

function ContactLine({ data, fz }: { data: ResumeData; fz: number }) {
  const parts: ReactNode[] = []
  if (data.email) parts.push(<Link key="e" src={`mailto:${data.email}`} style={{ color: LINK, textDecoration: 'none' }}>{data.email}</Link>)
  if (data.location) parts.push(data.location)
  if (data.linkedin) {
    const href = data.linkedin.startsWith('http') ? data.linkedin : `https://${data.linkedin}`
    parts.push(<Link key="l" src={href} style={{ color: LINK, textDecoration: 'none' }}>{stripProto(data.linkedin)}</Link>)
  }
  if (data.phone) parts.push(data.phone)
  const woven: ReactNode[] = []
  parts.forEach((p, i) => {
    // Non-breaking spaces so react-pdf doesn't collapse the separator padding.
    if (i > 0) woven.push(<Text key={`sep${i}`} style={{ color: '#555' }}>{'  |  '}</Text>)
    woven.push(<Text key={`p${i}`}>{p}</Text>)
  })
  if (!woven.length) return null
  return <Text style={{ textAlign: 'center', fontSize: 11 * fz, color: '#222', marginTop: 4 }}>{woven}</Text>
}

function DatedHeader({ left, right, fz }: { left: ReactNode; right: string; fz: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
      <Text style={{ flex: 1, paddingRight: 8, fontSize: 12 * fz }}>{left}</Text>
      {right ? <Text style={{ fontStyle: 'italic', fontSize: 11 * fz, color: '#222' }}>{right}</Text> : null}
    </View>
  )
}

// ── Document ─────────────────────────────────────────────────────────────────

function ResumePdfDocument({ data, paperSize }: { data: ResumeData; paperSize: PaperSize }) {
  const fz = clampFontScale(data.fontScale ?? 1)
  const full = [data.firstName, data.lastName].filter(Boolean).join(' ')
  const skillLines = data.skillGroups.filter((g) => (g.items || []).length)

  return (
    <Document>
      <Page
        size={paperSize === 'A4' ? 'A4' : 'LETTER'}
        style={{ paddingTop: 30, paddingBottom: 36, paddingHorizontal: 34, fontFamily: 'CMU Serif', fontSize: 11.5 * fz, color: '#161616', lineHeight: 1.25 }}
        wrap
      >
        {/* Header */}
        <Text style={{ textAlign: 'center', fontSize: 17.5 * fz, fontWeight: 'bold', color: '#0d0d0d', textTransform: 'uppercase', letterSpacing: 1 }}>{full}</Text>
        <ContactLine data={data} fz={fz} />

        {/* Summary */}
        {stripTags(data.summary) !== '' && (
          <View>
            <SectionHeading fz={fz}>Summary</SectionHeading>
            {richBlocks(data.summary)}
          </View>
        )}

        {/* Experience */}
        {data.experience.length > 0 && (
          <View>
            <SectionHeading fz={fz}>Experience</SectionHeading>
            {data.experience.map((x: Experience, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <DatedHeader fz={fz}
                  left={<><Text style={{ fontWeight: 'bold' }}>{x.role}</Text>{x.company ? `, ${x.company}` : ''}</>}
                  right={expDates(x)}
                />
                {richBlocks(x.bulletsText)}
              </View>
            ))}
          </View>
        )}

        {/* Projects */}
        {data.projects.length > 0 && (
          <View>
            <SectionHeading fz={fz}>Projects</SectionHeading>
            {data.projects.map((x: Project, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                  <Text style={{ flex: 1, paddingRight: 8, fontSize: 12 * fz, fontWeight: 'bold' }}>{x.name}</Text>
                  {x.link ? <Text style={{ fontFamily: 'CMU Typewriter', fontSize: 10.5 * fz, color: LINK }}>{x.link}</Text> : null}
                </View>
                {richBlocks(x.description)}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {data.education.length > 0 && (
          <View>
            <SectionHeading fz={fz}>Education</SectionHeading>
            {data.education.map((x: Education, i) => {
              const detail = x.extraDetails.filter((d) => d.value).map((d) => `${d.label}: ${d.value}`).join(' · ')
              return (
                <View key={i} style={{ marginBottom: 4 }}>
                  <DatedHeader fz={fz}
                    left={<Text style={{ fontWeight: 'bold' }}>{x.degree}</Text>}
                    right={[fmtMonth(x.start), fmtMonth(x.end)].filter(Boolean).join(' – ')}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ flex: 1, paddingRight: 8, fontSize: 11.5 * fz, color: '#222' }}>{x.school}</Text>
                    {detail ? <Text style={{ fontSize: 11 * fz, color: '#333' }}>{detail}</Text> : null}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Skills */}
        {skillLines.length > 0 && (
          <View>
            <SectionHeading fz={fz}>Skills</SectionHeading>
            {skillLines.map((g, i) => (
              <Text key={i} style={{ marginBottom: 1 }}>
                <Text style={{ fontWeight: 'bold' }}>{g.label}</Text>: {g.items.join(', ')}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}

export async function generateResumePdfBlob(data: ResumeData, paperSize: PaperSize): Promise<Blob> {
  keyCtr = 0
  return pdf(<ResumePdfDocument data={data} paperSize={paperSize} />).toBlob()
}
