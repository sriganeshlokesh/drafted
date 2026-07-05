import { useLayoutEffect, useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { Hover } from './Hover'
import { EducationCard, ExperienceCard, ProjectCard, SkillCard, type DragBundle } from './cards'
import { expDates, fmtMonth, genTex } from './tex'
import { addBtn, addBtnHover, checkBadge, inputStyle, inputWithCheck, labelStyle, sectionHeading } from './styles'
import { RichTextEditor } from './RichTextEditor'
import type { Format, ListKey, PaperSize, ResumeData, SaveState } from './types'

interface Props {
  accent?: string
  accent2?: string
  paperSize?: PaperSize
}

interface State extends ResumeData {
  compiling: boolean
  toast: boolean
  menuOpen: boolean
  resetDialogOpen: boolean
  saveState: SaveState
  pages: number
  currentPage: number
  scale: number
  paperH: number
  mobilePane: 'edit' | 'preview'
}

const SAVE_KEY = 'latexResumeBuilder:v1'
const FORMATS: Record<Format, string> = { PDF: 'pdf', LaTeX: 'tex', Word: 'docx' }
const PERSIST_FIELDS: (keyof ResumeData)[] = [
  'firstName', 'lastName', 'email', 'linkedin', 'phone', 'location', 'targetCompany',
  'targetRole', 'docTitle', 'summary', 'experience', 'projects', 'education', 'skillGroups',
  'step', 'view', 'format',
]

const initialState: State = {
  step: 0,
  view: 'preview',
  compiling: false,
  toast: false,
  format: 'PDF',
  menuOpen: false,
  resetDialogOpen: false,
  saveState: 'saved',
  pages: 1,
  currentPage: 1,
  scale: 1,
  paperH: 1056,
  mobilePane: 'edit',
  firstName: '',
  lastName: '',
  email: '',
  linkedin: '',
  phone: '',
  location: '',
  targetCompany: '',
  targetRole: '',
  docTitle: 'My résumé',
  summary: '',
  experience: [],
  projects: [],
  education: [],
  skillGroups: [],
}

const slug = (t: string) => (t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const stripProto = (s: string) => (s || '').replace(/^https?:\/\/(www\.)?/, '')

export default function ResumeBuilder({ accent = '#5b50e0', accent2 = '#f5871f', paperSize = 'A4' }: Props) {
  const [state, setState] = useState<State>(initialState)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const scrollRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const pdfRenderRef = useRef<HTMLDivElement>(null)

  const pageH = paperSize === 'A4' ? 1123 : 1056
  const pageW = paperSize === 'A4' ? 794 : 816

  // ── State helpers ──────────────────────────────────────────────────────
  const patch = (u: Partial<State>) => setState((s) => ({ ...s, ...u }))
  const bind = (name: keyof ResumeData) => ({
    value: state[name] as string,
    onChange: (e: { target: { value: string } }) => patch({ [name]: e.target.value } as Partial<State>),
  })
  const setItemField = (list: ListKey, i: number, field: string, value: unknown) =>
    setState((s) => {
      const a = (s[list] as unknown as Record<string, unknown>[]).slice()
      a[i] = { ...a[i], [field]: value }
      return { ...s, [list]: a } as State
    })
  const removeItem = (list: ListKey, i: number) =>
    setState((s) => {
      const a = (s[list] as unknown[]).slice()
      a.splice(i, 1)
      return { ...s, [list]: a } as State
    })
  const addItem = (list: ListKey, tmpl: unknown) =>
    setState((s) => ({ ...s, [list]: [...(s[list] as unknown[]), tmpl] }) as State)
  const reorder = (list: ListKey, from: number, to: number) => {
    if (from == null || from === to) return
    setState((s) => {
      const a = (s[list] as unknown[]).slice()
      const [m] = a.splice(from, 1)
      a.splice(to, 0, m)
      return { ...s, [list]: a } as State
    })
  }

  // Skill tag operations
  const commitTag = (i: number) =>
    setState((s) => {
      const a = s.skillGroups.slice()
      const g = { ...a[i] }
      const parts = (g.draft || '').split(',').map((x) => x.trim()).filter(Boolean)
      if (parts.length) g.items = [...g.items, ...parts]
      g.draft = ''
      a[i] = g
      return { ...s, skillGroups: a }
    })
  const removeTag = (i: number, j: number) =>
    setState((s) => {
      const a = s.skillGroups.slice()
      const g = { ...a[i], items: a[i].items.slice() }
      g.items.splice(j, 1)
      a[i] = g
      return { ...s, skillGroups: a }
    })
  const backspaceTag = (i: number) =>
    setState((s) => {
      const a = s.skillGroups.slice()
      if (!a[i].items.length) return s
      a[i] = { ...a[i], items: a[i].items.slice(0, -1) }
      return { ...s, skillGroups: a }
    })

  // ── Drag & drop reorder ────────────────────────────────────────────────
  const dragRef = useRef<{ list: ListKey; i: number } | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const makeDrag = (list: ListKey, i: number): DragBundle => ({
    cardProps: {
      'data-drag-card': '',
      onDragEnter: (e: DragEvent) => {
        if (dragRef.current?.list === list) {
          e.preventDefault()
          const k = `${list}:${i}`
          if (overKey !== k) setOverKey(k)
        }
      },
      onDragOver: (e: DragEvent) => {
        if (dragRef.current?.list === list) {
          e.preventDefault()
          try { e.dataTransfer.dropEffect = 'move' } catch { /* ignore */ }
        }
      },
      onDrop: (e: DragEvent) => {
        if (dragRef.current?.list === list) {
          e.preventDefault()
          reorder(list, dragRef.current.i, i)
        }
        dragRef.current = null
        setDragKey(null)
        setOverKey(null)
      },
    },
    handleProps: {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        dragRef.current = { list, i }
        try {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', String(i))
          const c = (e.currentTarget as HTMLElement).closest('[data-drag-card]')
          if (c) e.dataTransfer.setDragImage(c, 18, 18)
        } catch { /* ignore */ }
        setDragKey(`${list}:${i}`)
      },
      onDragEnd: () => {
        dragRef.current = null
        setDragKey(null)
        setOverKey(null)
      },
    },
    isOver: dragKey !== null && dragRef.current?.list === list && overKey === `${list}:${i}` && dragRef.current?.i !== i,
  })

  // ── Download ───────────────────────────────────────────────────────────
  const t1 = useRef<ReturnType<typeof setTimeout>>()
  const t2 = useRef<ReturnType<typeof setTimeout>>()
  const runDownload = async (fmt: Format) => {
    if (state.compiling) return
    patch({ format: fmt, menuOpen: false, compiling: true, toast: false })
    clearTimeout(t1.current)
    clearTimeout(t2.current)
    try {
      const userSlug = slug(`${state.firstName} ${state.lastName}`) || 'resume'
      const fn = [userSlug, slug(state.targetCompany), slug(state.targetRole)].filter(Boolean).join('_')
      const name = `${fn}.${FORMATS[fmt]}`
      if (fmt === 'LaTeX') {
        const blob = new Blob([genTex(state, paperSize)], { type: 'text/plain' })
        triggerDownload(blob, name)
      } else if (fmt === 'Word') {
        const { genDocx } = await import('./docx')
        const blob = await genDocx(state, paperSize)
        triggerDownload(blob, name)
      } else {
        // PDF: render the live resume HTML to canvas then slice into pages
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ])
        await document.fonts.ready
        const canvas = await html2canvas(pdfRenderRef.current!, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: paperSize === 'A4' ? 'a4' : 'letter' })
        const pdfW = pdf.internal.pageSize.getWidth()
        const pdfH = pdf.internal.pageSize.getHeight()
        const scl = 2
        const ph = pageH * scl
        const pageCount = Math.max(1, Math.ceil(canvas.height / ph))
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = ph
        const ctx = slice.getContext('2d')!
        for (let i = 0; i < pageCount; i++) {
          if (i > 0) pdf.addPage()
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, slice.width, slice.height)
          ctx.drawImage(canvas, 0, -i * ph)
          pdf.addImage(slice.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pdfW, pdfH)
        }
        pdf.save(name)
      }
      patch({ compiling: false, toast: true })
      t2.current = setTimeout(() => patch({ toast: false }), 3000)
    } catch (err) {
      console.error('Download failed', err)
      patch({ compiling: false })
    }
  }
  const download = () => runDownload(state.format)

  // ── Persistence (auto-save) ────────────────────────────────────────────
  const lastSnap = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const stateRef = useRef(state)
  stateRef.current = state
  const snapshot = (s: State) => {
    const d: Record<string, unknown> = {}
    PERSIST_FIELDS.forEach((f) => { d[f] = s[f] })
    return JSON.stringify(d)
  }
  useEffect(() => {
    // Load once on mount, before the save effect can fire.
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d && typeof d === 'object') {
          if (d.summary && !d.summary.includes('<')) d.summary = `<p>${d.summary}</p>`
          if (Array.isArray(d.experience)) {
            d.experience = d.experience.map((x: Record<string, unknown>) => ({
              ...x,
              bulletsText: x.bulletsText && !(x.bulletsText as string).includes('<')
                ? `<ul>${(x.bulletsText as string).split('\n').filter((l: string) => l.trim()).map((l: string) => `<li>${l.trim()}</li>`).join('')}</ul>`
                : (x.bulletsText || ''),
            }))
          }
          if (Array.isArray(d.education)) {
            d.education = d.education.map((x: Record<string, unknown>) => {
              const start = typeof x.start === 'string' && /^\d{4}-\d{2}$/.test(x.start) ? x.start + '-01' : x.start
              const end = typeof x.end === 'string' && /^\d{4}-\d{2}$/.test(x.end) ? x.end + '-01' : x.end
              let extraDetails = Array.isArray(x.extraDetails) ? x.extraDetails : []
              // Migrate old gpa/detail fields into extraDetails
              const oldGpa = typeof x.gpa === 'string' && x.gpa ? x.gpa : (typeof x.detail === 'string' ? x.detail.replace(/^GPA:\s*/i, '').trim() : '')
              if (oldGpa && !extraDetails.some((e: {label:string}) => e.label === 'GPA')) {
                extraDetails = [{ label: 'GPA', value: oldGpa }, ...extraDetails]
              }
              return { ...x, start, end, extraDetails }
            })
          }
          if (Array.isArray(d.projects)) {
            d.projects = d.projects.map((x: Record<string, unknown>) => ({
              ...x,
              description: x.description && !(x.description as string).includes('<')
                ? `<p>${x.description}</p>`
                : (x.description || ''),
            }))
          }
          setState((s) => ({ ...s, ...d }))
          lastSnap.current = raw
          return
        }
      }
    } catch { /* ignore */ }
    lastSnap.current = snapshot(initialState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const snap = snapshot(state)
    if (lastSnap.current === null || snap === lastSnap.current) return
    if (state.saveState !== 'saving') patch({ saveState: 'saving' })
    clearTimeout(saveTimer.current)
    const pending = snap
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, pending) } catch { /* ignore */ }
      lastSnap.current = pending
      patch({ saveState: 'saved' })
    }, 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...PERSIST_FIELDS.map((f) => state[f])])

  // Flush full state on page unload so step (and any debounced changes) survive a refresh.
  useEffect(() => {
    const flush = () => {
      try { localStorage.setItem(SAVE_KEY, snapshot(stateRef.current)) } catch { /* ignore */ }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  useEffect(() => () => {
    clearTimeout(t1.current)
    clearTimeout(t2.current)
    clearTimeout(saveTimer.current)
  }, [])

  // ── Measure paper → page count + fit scale ─────────────────────────────
  const measure = () => {
    const el = paperRef.current
    const sc = scrollRef.current
    if (!el) return
    const h = el.offsetHeight
    const pages = Math.max(1, Math.ceil((h - 4) / pageH))
    let scale = state.scale
    if (sc) {
      const avail = sc.clientWidth - 60
      scale = Math.max(0.2, avail / pageW)
    }
    const upd: Partial<State> = {}
    if (pages !== state.pages) upd.pages = pages
    if (Math.abs(h - state.paperH) > 1) upd.paperH = h
    if (Math.abs(scale - state.scale) > 0.004) upd.scale = scale
    if (Object.keys(upd).length) patch(upd)
  }
  useLayoutEffect(measure)
  useEffect(() => {
    const onResize = () => {
      measure()
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', onResize)
    let ro: ResizeObserver | undefined
    if (window.ResizeObserver && scrollRef.current) {
      ro = new ResizeObserver(() => measure())
      ro.observe(scrollRef.current)
    }
    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const ph = (pageH + 22) * state.scale
    const top = e.currentTarget.scrollTop
    const cur = Math.min(state.pages, Math.max(1, Math.floor(top / ph) + 1))
    if (cur !== state.currentPage) patch({ currentPage: cur })
  }

  // ── Derived values ─────────────────────────────────────────────────────
  const s = state
  const stepMeta = [
    { label: 'Personal Info', sub: 'Header & summary', title: 'Personal Info', subtitle: 'Enter your personal info' },
    { label: 'Experience', sub: `${s.experience.length} role${s.experience.length === 1 ? '' : 's'}`, title: 'Experience', subtitle: 'Enter your work details here' },
    { label: 'Projects', sub: `${s.projects.length} project${s.projects.length === 1 ? '' : 's'}`, title: 'Projects', subtitle: 'Add the projects you have built' },
    { label: 'Education', sub: `${s.education.length} school${s.education.length === 1 ? '' : 's'}`, title: 'Education', subtitle: 'Enter your education details' },
    { label: 'Skills', sub: `${s.skillGroups.length} categories`, title: 'Skills', subtitle: 'Group your skills by category' },
  ]
  const sectionResets: Partial<State>[] = [
    { firstName: '', lastName: '', email: '', linkedin: '', phone: '', location: '', targetCompany: '', targetRole: '', summary: '' },
    { experience: [] },
    { projects: [] },
    { education: [] },
    { skillGroups: [] },
  ]

  const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ')
  const user = slug(`${s.firstName} ${s.lastName}`) || 'resume'
  const fileName = [user, slug(s.targetCompany), slug(s.targetRole)].filter(Boolean).join('_')
  const ext = FORMATS[s.format]

  const checks = [
    !!(s.firstName.trim() && s.lastName.trim() && s.email.trim()),
    s.experience.some((x) => x.company.trim() && x.role.trim()),
    s.projects.some((x) => x.name.trim()),
    s.education.some((x) => x.school.trim() && x.degree.trim()),
    s.skillGroups.some((g) => g.items.length),
  ]
  const completePct = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  const isEmpty = completePct === 0
  const complete = completePct === 100
  const completeColor = complete ? accent2 : accent
  const completeBg = complete ? 'rgba(245,135,31,.12)' : '#efeefb'
  const completeBorder = complete ? 'rgba(245,135,31,.38)' : 'rgba(91,80,224,.22)'
  const ringBg = `conic-gradient(${completeColor} ${completePct * 3.6}deg, #e4e3ee 0)`

  const contactRaw = [
    { text: s.email, link: true },
    { text: s.location, link: false },
    { text: stripProto(s.linkedin), link: true },
    { text: s.phone, link: false },
  ].filter((p) => p.text && p.text.trim())

  const skillLines = s.skillGroups.filter((g) => g.items.length).map((g) => ({ label: g.label, items: g.items.join(' · ') }))
  const hasSummary = !!s.summary.replace(/<[^>]*>/g, '').trim()

  const formatOptions: [Format, string, string][] = [
    ['PDF', 'PDF document', '.pdf'],
    ['LaTeX', 'LaTeX source', '.tex'],
    ['Word', 'Word document', '.docx'],
  ]

  const isLast = s.step === 4
  const rootStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#fff',
    color: '#2c2c34',
    '--accent': accent,
    '--accent2': accent2,
    '--page-w': `${pageW}px`,
    '--page-h': `${pageH}px`,
  } as CSSProperties

  const focus = 'dc-input'

  // Full résumé body — rendered inside every page sheet, offset per page.
  const resumeBody = (
    <>
      <div style={{ textAlign: 'center', margin: '0 0 3px' }}>
        <span style={{ fontSize: '29px', fontWeight: 700, color: '#0d0d0d', letterSpacing: '.01em' }}>{fullName}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', fontSize: '12.5px', color: '#222', margin: '0 0 2px' }}>
        {contactRaw.map((c, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span style={{ color: '#555', margin: '0 7px' }}>|</span>}
            <span style={{ color: c.link ? '#2b5fb3' : '#222' }}>{c.text}</span>
          </span>
        ))}
      </div>

      {hasSummary && (
        <div>
          <div style={sectionHeading}>Summary</div>
          <div className="resume-summary" dangerouslySetInnerHTML={{ __html: s.summary }} style={{ fontSize: '13px', lineHeight: 1.55, color: '#161616', textAlign: 'justify' }} />
        </div>
      )}

      {s.experience.length > 0 && (
        <div>
          <div style={sectionHeading}>Experience</div>
          {s.experience.map((it, i) => (
            <div key={i} style={{ margin: '0 0 7px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '13.5px', color: '#111' }}>
                  <span style={{ fontWeight: 700 }}>{it.role}</span>
                  {`, ${it.company || ''}`}
                </span>
                <span style={{ fontStyle: 'italic', fontSize: '12.5px', color: '#222', whiteSpace: 'nowrap' }}>{expDates(it)}</span>
              </div>
              <div className="resume-bullets" dangerouslySetInnerHTML={{ __html: it.bulletsText }} style={{ fontSize: '12.7px', lineHeight: 1.5, color: '#1a1a1a', textAlign: 'justify' }} />
            </div>
          ))}
        </div>
      )}

      {s.projects.length > 0 && (
        <div>
          <div style={sectionHeading}>Projects</div>
          {s.projects.map((it, i) => (
            <div key={i} style={{ margin: '0 0 6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#111' }}>{it.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', color: '#2b5fb3' }}>{it.link}</span>
              </div>
              <div className="resume-summary" dangerouslySetInnerHTML={{ __html: it.description }} style={{ fontSize: '12.7px', lineHeight: 1.5, color: '#1a1a1a', textAlign: 'justify', margin: '2px 0 0' }} />
            </div>
          ))}
        </div>
      )}

      {s.education.length > 0 && (
        <div>
          <div style={sectionHeading}>Education</div>
          {s.education.map((it, i) => (
            <div key={i} style={{ margin: '0 0 5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#111' }}>{it.degree}</span>
                <span style={{ fontStyle: 'italic', fontSize: '12.5px', color: '#222', whiteSpace: 'nowrap' }}>{[fmtMonth(it.start), fmtMonth(it.end)].filter(Boolean).join(' – ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#222' }}>{it.school}</span>
                <span style={{ fontSize: '12.5px', color: '#333', whiteSpace: 'nowrap' }}>
                  {it.extraDetails.filter(d => d.value).map(d => `${d.label}: ${d.value}`).join(' · ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {skillLines.length > 0 && (
        <div>
          <div style={sectionHeading}>Skills</div>
          {skillLines.map((g, i) => (
            <p key={i} style={{ fontSize: '12.7px', lineHeight: 1.55, color: '#161616', margin: '0 0 2px' }}>
              <span style={{ fontWeight: 700 }}>{g.label}</span>: {g.items}
            </p>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div style={rootStyle}>
      {/* TOP BAR */}
      <header style={{ flex: 'none', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #ededec', background: '#fff', zIndex: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#37352f' }}>
          <img src="/logo.svg" alt="Drafted" style={{ width: '34px', height: '34px', display: 'block' }} />
          <span title="Résumé completeness" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: completeBg, border: `1px solid ${completeBorder}`, borderRadius: '20px', padding: '3px 11px 3px 4px' }}>
            {complete ? (
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>✓</span>
            ) : (
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: ringBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fff', display: 'block' }} />
              </span>
            )}
            <span style={{ fontSize: '12px', fontWeight: 600, color: completeColor }}>{completePct}%</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
          <Hover as="button" onClick={() => patch({ resetDialogOpen: true })} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', fontSize: '13px', fontWeight: 500, color: '#6b6a72', background: '#f0eff2', border: '1px solid #d5d4d8', borderRadius: '8px', cursor: 'pointer' }} hoverStyle={{ background: '#e5e4e8', borderColor: '#bbb' }}>
            <span style={{ fontSize: '13px' }}>↺</span> Reset
          </Hover>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9b9a97' }}>
            {s.saveState === 'saving' ? (
              <>
                <span style={{ width: '11px', height: '11px', border: '2px solid #d8d6e8', borderTopColor: '#9b9a97', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Saving…
              </>
            ) : (
              <>
                <span style={{ color: accent2 }}>✓</span> Saved
              </>
            )}
          </span>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'stretch', background: 'var(--accent,#5b50e0)', borderRadius: '8px', overflow: 'hidden' }}>
              <Hover as="button" onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 10px 7px 14px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.08)' }}>
                <span style={{ fontSize: '13px' }}>↓</span> Download
              </Hover>
              <Hover as="button" onClick={() => patch({ menuOpen: !s.menuOpen })} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,.22)', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.08)' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.22)', borderRadius: '5px', padding: '2px 7px', letterSpacing: '.01em' }}>.{ext}</span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.8)' }}>▼</span>
              </Hover>
            </div>
            {s.menuOpen && (
              <>
                <div onClick={() => patch({ menuOpen: false })} style={{ position: 'fixed', inset: 0, zIndex: 18 }} />
                <div style={{ position: 'absolute', top: '42px', right: 0, width: '220px', background: '#fff', border: '1px solid #e6e5e1', borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,.15)', padding: '6px', zIndex: 20 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.06em', color: '#9b9a97', padding: '8px 10px 6px' }}>CHOOSE A FORMAT</div>
                  {formatOptions.map(([key, label, fext]) => {
                    const active = key === s.format
                    return (
                      <Hover key={key} onClick={() => runDownload(key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', background: active ? '#f3f2fc' : 'transparent' }} hoverStyle={{ background: '#f3f2fc' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: '#2c2c34' }}>{label}</span>
                          <span style={{ fontSize: '12px', fontFamily: "'IBM Plex Mono',ui-monospace,monospace", color: '#9b9a97' }}>{fext}</span>
                        </div>
                        {active && <span style={{ color: 'var(--accent,#5b50e0)', fontSize: '15px', fontWeight: 600 }}>✓</span>}
                      </Hover>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* STEPPER */}
      <nav style={{ flex: 'none', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0', borderBottom: '1px solid #ededec', background: '#fafaf9', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px' } as CSSProperties}>
        {stepMeta.map((m, i) => {
          const activeStep = s.step === i
          const isPast = i < s.step
          const sectionDone = checks[i]
          const showAlert = isPast && !sectionDone
          const badgeBg = activeStep ? accent : sectionDone ? 'rgba(245,135,31,.15)' : showAlert ? accent2 : '#fff'
          const badgeColor = activeStep ? '#fff' : sectionDone ? accent2 : showAlert ? '#fff' : '#b3b1ab'
          const badgeBorder = activeStep ? accent : sectionDone || showAlert ? accent2 : '#dcdbd6'
          const badgeLabel = activeStep ? String(i + 1) : sectionDone ? '✓' : showAlert ? '!' : String(i + 1)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: '36px', height: '1px', background: '#dcdbd6' }} />}
              <Hover
                onClick={() => patch({ step: i })}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: activeStep ? '5px 12px 5px 5px' : '5px 8px 5px 5px', borderRadius: '20px', cursor: 'pointer', background: activeStep ? '#eeeeec' : 'transparent', border: 'none', transition: 'background .1s' }}
                hoverStyle={{ background: '#eeeeec' }}
              >
                <span style={{ flex: 'none', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: badgeBg, color: badgeColor, border: `1.5px solid ${badgeBorder}` }}>
                  {badgeLabel}
                </span>
                <span style={{ fontSize: '13px', fontWeight: activeStep ? 600 : 400, color: activeStep ? '#37352f' : '#9b9a97', whiteSpace: 'nowrap' }}>{m.label}</span>
              </Hover>
            </div>
          )
        })}
      </nav>

      {isMobile && (
        <div style={{ flex: 'none', display: 'flex', padding: '8px 16px', gap: '10px', borderBottom: '1px solid #ededec', background: '#fff' }}>
          <MobileTabBtn active={s.mobilePane === 'edit'} onClick={() => patch({ mobilePane: 'edit' })}>✏️ Edit</MobileTabBtn>
          <MobileTabBtn active={s.mobilePane === 'preview'} onClick={() => patch({ mobilePane: 'preview' })}>📄 Preview</MobileTabBtn>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
        {/* FORM COLUMN */}
        <section style={{ width: isMobile ? '100%' : '560px', flex: 'none', display: isMobile && s.mobilePane === 'preview' ? 'none' : 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid #ededec', minWidth: 0, background: '#fff' }}>
          <div style={{ flex: 'none', padding: isMobile ? '14px 18px 10px' : '18px 20px 12px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-.01em', color: '#2c2c34', margin: '0 0 4px' }}>{stepMeta[s.step].title}</h1>
            <p style={{ fontSize: '14px', color: '#9b9a97', margin: 0 }}>{stepMeta[s.step].subtitle}</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '6px 18px 20px' : '6px 20px 24px' }}>
            {/* STEP 0 : PERSONAL INFO */}
            {s.step === 0 && (
              <div>
                <div style={{ margin: '0 0 16px', padding: '12px 14px 14px', background: '#f7f7fb', border: '1px solid #e8e7f3', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px' }}>
                    <span style={{ flex: 'none', width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(245,135,31,.14)', border: '1px solid rgba(245,135,31,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--accent2,#f5871f)' }}>◎</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#2c2c34' }}>Applying for</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px' }}>
                    <div>
                      <label style={{ ...labelStyle }}>Company</label>
                      <input className={focus} {...bind('targetCompany')} placeholder="Stripe" style={{ ...inputStyle, fontSize: '14.5px' }} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle }}>Department</label>
                      <input className={focus} {...bind('targetRole')} placeholder="Banking & Finance" style={{ ...inputStyle, fontSize: '14.5px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', margin: '13px 0 0', fontSize: '12.5px', color: '#9b9a97' }}>
                    <span style={{ color: 'var(--accent2,#f5871f)' }}>↓</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',ui-monospace,monospace", color: '#6b6a72' }}>{fileName}.{ext}</span>
                  </div>
                </div>

                <PersonalField label="First Name" required check={!!s.firstName.trim()} input={<input className={focus} {...bind('firstName')} placeholder="First name" style={inputWithCheck} />} />
                <PersonalField label="Last Name" required check={!!s.lastName.trim()} input={<input className={focus} {...bind('lastName')} placeholder="Last name" style={inputWithCheck} />} />
                <PersonalField label="Email" required check={!!s.email.trim()} input={<input className={focus} {...bind('email')} placeholder="you@mail.com" style={inputWithCheck} />} />
                <PersonalField label="LinkedIn" check={!!s.linkedin.trim()} input={<input className={focus} {...bind('linkedin')} placeholder="https://www.linkedin.com/in/you" style={inputWithCheck} />} />
                <PersonalField label="Phone" check={!!s.phone.trim()} input={<input className={focus} {...bind('phone')} placeholder="Add your phone here" style={inputWithCheck} />} />
                <div style={{ margin: '0 0 14px' }}>
                  <label style={labelStyle}>Location</label>
                  <input className={focus} {...bind('location')} placeholder="City, State" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>About</label>
                  <RichTextEditor value={s.summary} onChange={v => patch({ summary: v })} />
                </div>
              </div>
            )}

            {/* STEP 1 : EXPERIENCE */}
            {s.step === 1 && (
              <div>
                {s.experience.map((it, i) => (
                  <ExperienceCard key={i} item={it} drag={makeDrag('experience', i)} remove={() => removeItem('experience', i)} update={(f, v) => setItemField('experience', i, f as string, v)} />
                ))}
                <Hover as="button" onClick={() => addItem('experience', { company: '', role: '', employment: 'Full-time', start: '', end: '', present: false, bulletsText: '' })} style={addBtn} hoverStyle={addBtnHover}>+ Add experience</Hover>
              </div>
            )}

            {/* STEP 2 : PROJECTS */}
            {s.step === 2 && (
              <div>
                {s.projects.map((it, i) => (
                  <ProjectCard key={i} item={it} drag={makeDrag('projects', i)} remove={() => removeItem('projects', i)} update={(f, v) => setItemField('projects', i, f as string, v)} />
                ))}
                <Hover as="button" onClick={() => addItem('projects', { name: '', link: '', description: '' })} style={addBtn} hoverStyle={addBtnHover}>+ Add project</Hover>
              </div>
            )}

            {/* STEP 3 : EDUCATION */}
            {s.step === 3 && (
              <div>
                {s.education.map((it, i) => (
                  <EducationCard key={i} item={it} drag={makeDrag('education', i)} remove={() => removeItem('education', i)} update={(f, v) => setItemField('education', i, f as string, v)} />
                ))}
                <Hover as="button" onClick={() => addItem('education', { school: '', degree: '', start: '', end: '', extraDetails: [] })} style={addBtn} hoverStyle={addBtnHover}>+ Add education</Hover>
              </div>
            )}

            {/* STEP 4 : SKILLS */}
            {s.step === 4 && (
              <div>
                {s.skillGroups.map((it, i) => (
                  <SkillCard key={i} item={it} drag={makeDrag('skillGroups', i)} remove={() => removeItem('skillGroups', i)} update={(f, v) => setItemField('skillGroups', i, f as string, v)} onCommit={() => commitTag(i)} onRemoveTag={(j) => removeTag(i, j)} onBackspace={() => backspaceTag(i)} />
                ))}
                <Hover as="button" onClick={() => addItem('skillGroups', { label: '', items: [], draft: '' })} style={{ ...addBtn, marginTop: '6px' }} hoverStyle={addBtnHover}>+ Add category</Hover>
              </div>
            )}
          </div>

          {/* FOOTER NAV */}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '18px', padding: '13px 24px', borderTop: '1px solid #ededec', background: '#fff' }}>
            <Hover as="button" onClick={() => patch({ step: Math.max(0, s.step - 1) })} disabled={s.step === 0} style={{ flex: 'none', fontSize: '13.5px', fontWeight: 500, color: s.step === 0 ? '#cfcdc7' : '#37352f', background: '#fff', border: '1px solid #e6e5e1', borderRadius: '7px', padding: '9px 18px', cursor: s.step === 0 ? 'default' : 'pointer' }} hoverStyle={{ background: '#f7f6f4' }}>Prev</Hover>
            <div style={{ flex: 1, height: '7px', borderRadius: '5px', background: '#ebebf0', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent,#5b50e0)', width: `${((s.step + 1) / 5) * 100}%`, borderRadius: '5px', transition: 'width .25s ease' }} />
            </div>
            <Hover as="button" onClick={isLast ? download : () => patch({ step: Math.min(4, s.step + 1) })} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13.5px', fontWeight: 600, color: '#fff', background: 'var(--accent,#5b50e0)', border: 'none', borderRadius: '7px', padding: '9px 20px', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.08)' }}>{isLast ? '↓ Download' : 'Next'}</Hover>
          </div>
        </section>

        {/* PREVIEW PANE */}
        <section style={{ flex: 1, display: isMobile && s.mobilePane === 'edit' ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, background: '#f0eff2', position: 'relative' }}>
          <div style={{ flex: 'none', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', borderBottom: '1px solid #e2e1e4', background: '#faf9fb' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b6a72', background: '#e8e7ec', borderRadius: '20px', padding: '3px 10px' }}>Page {s.currentPage} of {s.pages}</span>
            <div style={{ display: 'flex', gap: '2px', background: '#e4e3e8', borderRadius: '7px', padding: '2px' }}>
              <TabButton active={s.view === 'preview'} onClick={() => patch({ view: 'preview' })}>Typeset</TabButton>
              <TabButton active={s.view === 'source'} onClick={() => patch({ view: 'source' })}>.tex</TabButton>
            </div>
          </div>

          <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', padding: '34px 30px 70px', display: 'flex', justifyContent: 'center', alignItems: s.view === 'preview' && isEmpty ? 'center' : 'flex-start' }}>
            {s.view === 'preview' && isEmpty ? (
              <div style={{ width: '100%', maxWidth: 560, padding: '80px 40px', background: '#fff', border: '2px dashed #d0cfe8', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <div style={{ position: 'relative', width: 90, height: 110 }}>
                  <svg width="90" height="110" viewBox="0 0 90 110" fill="none">
                    <rect x="4" y="4" width="68" height="88" rx="8" fill="#eeedf5"/>
                    <rect x="18" y="32" width="42" height="7" rx="3" fill="#c5c3d8"/>
                    <rect x="18" y="48" width="30" height="7" rx="3" fill="#c5c3d8"/>
                  </svg>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, lineHeight: '1' }}>+</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 700, color: '#2a2a2a', fontFamily: 'ui-sans-serif,sans-serif' }}>Your résumé starts here</p>
                  <p style={{ margin: 0, fontSize: 15, color: '#888', lineHeight: 1.6, maxWidth: 340, fontFamily: 'ui-sans-serif,sans-serif' }}>Fill in the form on the left and your typeset résumé will appear on this page as you go.</p>
                </div>
              </div>
            ) : s.view === 'preview' ? (
              <div style={{ width: `${pageW * s.scale}px`, height: `${(s.pages * pageH + (s.pages - 1) * 22) * s.scale}px`, flex: 'none' }}>
                <div style={{ transform: `scale(${s.scale})`, transformOrigin: 'top left', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  {Array.from({ length: s.pages }, (_, i) => (
                    <div key={i} style={{ width: 'var(--page-w,816px)', height: 'var(--page-h,1056px)', flex: 'none', overflow: 'hidden', position: 'relative', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.07),0 10px 34px rgba(0,0,0,.10)', borderRadius: '2px' }}>
                      <span style={{ position: 'absolute', top: '13px', right: '16px', zIndex: 2, fontFamily: 'ui-sans-serif,sans-serif', fontSize: '9.5px', letterSpacing: '.06em', color: '#c2c2c8' }}>PAGE {i + 1}</span>
                      <div ref={i === 0 ? paperRef : undefined} style={{ position: 'absolute', left: 0, right: 0, top: `${-(i * pageH)}px`, padding: '48px 62px 48px', boxSizing: 'border-box', fontFamily: "'Computer Modern Serif',Georgia,serif" }}>
                        {resumeBody}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ width: 'var(--page-w,816px)', maxWidth: '100%', flex: 'none', background: '#1f1e1b', boxShadow: '0 8px 30px rgba(0,0,0,.18)', borderRadius: '8px', padding: '22px 24px', minHeight: '600px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', margin: '0 0 14px' }}>
                  <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ec6a5e', display: 'inline-block' }} />
                  <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f4bf4f', display: 'inline-block' }} />
                  <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#61c554', display: 'inline-block' }} />
                  <span style={{ marginLeft: '8px', fontSize: '11.5px', fontFamily: "'IBM Plex Mono',monospace", color: '#8a877f' }}>{fileName}.tex</span>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'IBM Plex Mono',ui-monospace,monospace", fontSize: '12px', lineHeight: 1.6, color: '#d7d3c8', margin: 0 }}>{genTex(s, paperSize)}</pre>
              </div>
            )}
          </div>

          {/* FILENAME STATUS BAR */}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '34px', borderTop: '1px solid #e2e1e4', background: '#faf9fb' }}>
            <span style={{ color: 'var(--accent2,#f5871f)', fontSize: '12px' }}>↓</span>
            <span style={{ fontSize: '12.5px', fontFamily: "'IBM Plex Mono',ui-monospace,monospace", color: '#6b6a72' }}>{fileName}.{ext}</span>
          </div>

          {/* COMPILING OVERLAY */}
          {s.compiling && (
            <div style={{ position: 'absolute', inset: '42px 0 34px 0', background: 'rgba(240,239,242,.78)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', zIndex: 8 }}>
              <div style={{ width: '34px', height: '34px', border: '3px solid #dcdbe2', borderTopColor: 'var(--accent,#5b50e0)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              <div style={{ fontSize: '13.5px', color: '#6b6a72', fontWeight: 500 }}>Generating {s.format} file…</div>
            </div>
          )}
        </section>
      </div>

      {/* TOAST */}
      {s.toast && (
        <div style={{ position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)', background: '#2c2c34', color: '#fff', fontSize: '13.5px', fontWeight: 500, padding: '11px 18px', borderRadius: '9px', boxShadow: '0 8px 30px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: '9px', animation: 'pop .2s ease', zIndex: 20 }}>
          <span style={{ color: 'var(--accent2,#f5871f)', fontSize: '15px' }}>✓</span> {fileName}.{ext} downloaded
        </div>
      )}

      {/* RESET CONFIRMATION DIALOG */}
      {s.resetDialogOpen && (
        <>
          <div onClick={() => patch({ resetDialogOpen: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 420, background: '#fff', borderRadius: '16px', padding: '28px 28px 22px', boxShadow: '0 20px 60px rgba(0,0,0,.22)', zIndex: 41 }}>
            <p style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>Reset your résumé?</p>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#888', lineHeight: 1.6 }}>Choose what to clear — this can't be undone.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Hover as="button" onClick={() => patch({ resetDialogOpen: false })} style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#555', background: '#f0eff2', border: 'none', borderRadius: '8px', cursor: 'pointer' }} hoverStyle={{ background: '#e5e4e8' }}>
                Cancel
              </Hover>
              <Hover as="button" onClick={() => patch({ ...sectionResets[s.step], resetDialogOpen: false })} style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#c0392b', background: 'rgba(192,57,43,.08)', border: '1px solid rgba(192,57,43,.25)', borderRadius: '8px', cursor: 'pointer' }} hoverStyle={{ background: 'rgba(192,57,43,.14)' }}>
                Reset "{stepMeta[s.step].label}"
              </Hover>
              <Hover as="button" onClick={() => { localStorage.removeItem(SAVE_KEY); setState(initialState) }} style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 600, color: '#fff', background: '#c0392b', border: 'none', borderRadius: '8px', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.1)' }}>
                Reset all
              </Hover>
            </div>
          </div>
        </>
      )}

      {/* HIDDEN PDF RENDER TARGET — natural size, no CSS transform, used by html2canvas */}
      <div
        ref={pdfRenderRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: `${pageW}px`,
          background: '#fff',
          fontFamily: "'Computer Modern Serif',Georgia,serif",
          padding: '48px 62px',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        {resumeBody}
      </div>
    </div>
  )
}

/* A labelled Personal-Info field with an optional required asterisk + validation check. */
function PersonalField({ label, required, check, input }: { label: string; required?: boolean; check?: boolean; input: React.ReactNode }) {
  return (
    <div style={{ margin: '0 0 14px' }}>
      <label style={labelStyle}>
        {required && <span style={{ color: 'var(--accent2,#f5871f)' }}>*</span>}
        {required ? ' ' : ''}
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {input}
        {check && <span style={checkBadge}>✓</span>}
      </div>
    </div>
  )
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ fontSize: '12.5px', fontWeight: 500, color: active ? '#37352f' : '#9b9a97', background: active ? '#fff' : 'transparent', border: 'none', borderRadius: '5px', padding: '5px 13px', cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function MobileTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        fontSize: '14px',
        fontWeight: 600,
        color: active ? '#37352f' : '#9b9a97',
        background: active ? '#fff' : '#f5f5f5',
        border: `1.5px solid ${active ? '#d8d6e8' : '#e8e8ec'}`,
        borderRadius: '8px',
        padding: '9px 0',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
