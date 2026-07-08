import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { usePDF } from '@react-pdf/renderer'
import { Hover } from './Hover'
import { EducationCard, ExperienceCard, ProjectCard, SkillCard, type DragBundle } from './cards'
import { genTex } from './tex'
import { addBtn, addBtnHover, checkBadge, inputStyle, inputWithCheck, labelStyle } from './styles'
import { RichTextEditor } from './RichTextEditor'
import { normalizeResumeData } from './normalize'
import { genId } from './idFactory'
import { ImportModal, UploadIcon } from './ImportModal'
import { importResume } from './resumeImport'
import { hasResumeContent } from './resumeContent'
import { evaluateResume, EvaluationError, type EvaluationResponse } from './evaluation'
import { JobMatchMode } from './JobMatch'
import { ResumePdfDocument } from './resumePdf'
import type { Format, ListKey, PaperSize, ResumeData, SaveState } from './types'
import { FONT_SCALE_MIN, FONT_SCALE_MAX, FONT_SCALE_STEP, clampFontScale } from './fontScale'

interface Props {
  paperSize?: PaperSize
}

interface State extends ResumeData {
  compiling: boolean
  toast: boolean
  menuOpen: boolean
  resetDialogOpen: boolean
  overflowOpen: boolean
  saveState: SaveState
  mobilePane: 'edit' | 'preview'
  importOpen: boolean
  importing: boolean
  importError: string | null
  mode: 'editor' | 'match'
  jobDescription: string
  jdInputMode: 'link' | 'paste'
  evalResult: EvaluationResponse | null
  evalPrevScore: number | null
  evalAt: number | null
  evalLoading: boolean
  evalError: string | null
  evalDimKey: string | null
}

const SAVE_KEY = 'latexResumeBuilder:v1'
const FONT_SCALE_KEY = 'drafted:fontScale'
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
  fontScale: 1,
  menuOpen: false,
  resetDialogOpen: false,
  overflowOpen: false,
  saveState: 'saved',
  mobilePane: 'edit',
  importOpen: false,
  importing: false,
  importError: null,
  mode: 'editor',
  jobDescription: '',
  jdInputMode: 'paste',
  evalResult: null,
  evalPrevScore: null,
  evalAt: null,
  evalLoading: false,
  evalError: null,
  evalDimKey: null,
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

const DARK_KEY = 'drafted:darkMode'
const MATCH_KEY = 'drafted:match:v1'

export default function ResumeBuilder({ paperSize = 'A4' }: Props) {
  const [state, setState] = useState<State>(initialState)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [dropActive, setDropActive] = useState(false)
  const [fontScaleState, setFontScaleState] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem(FONT_SCALE_KEY) ?? '')
      return isNaN(v) ? 1 : clampFontScale(v)
    } catch { return 1 }
  })
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem(DARK_KEY) === 'true' } catch { return false }
  })
  const toggleDark = () => setDarkMode(prev => {
    const next = !prev
    try { localStorage.setItem(DARK_KEY, String(next)) } catch {}
    return next
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const evalAbort = useRef<AbortController | null>(null)
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

  // Project tech stack operations
  const commitProjectTech = (i: number) =>
    setState((s) => {
      const a = s.projects.slice()
      const p = { ...a[i] }
      const parts = (p.techStackDraft || '').split(',').map((x) => x.trim()).filter(Boolean)
      if (parts.length) p.techStack = [...(p.techStack || []), ...parts]
      p.techStackDraft = ''
      a[i] = p
      return { ...s, projects: a }
    })
  const removeProjectTech = (i: number, j: number) =>
    setState((s) => {
      const a = s.projects.slice()
      const p = { ...a[i], techStack: (a[i].techStack || []).slice() }
      p.techStack.splice(j, 1)
      a[i] = p
      return { ...s, projects: a }
    })
  const backspaceProjectTech = (i: number) =>
    setState((s) => {
      const a = s.projects.slice()
      if (!(a[i].techStack || []).length) return s
      a[i] = { ...a[i], techStack: a[i].techStack.slice(0, -1) }
      return { ...s, projects: a }
    })

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
        const blob = new Blob([genTex({ ...state, fontScale: fontScaleState }, paperSize)], { type: 'text/plain' })
        triggerDownload(blob, name)
      } else if (fmt === 'Word') {
        const { genDocx } = await import('./docx')
        const blob = await genDocx({ ...state, fontScale: fontScaleState }, paperSize)
        triggerDownload(blob, name)
      } else {
        // PDF: real vector text via @react-pdf/renderer (crisp + re-importable)
        const { generateResumePdfBlob } = await import('./resumePdf')
        const blob = await generateResumePdfBlob({ ...state, fontScale: fontScaleState }, paperSize)
        triggerDownload(blob, name)
      }
      patch({ compiling: false, toast: true })
      t2.current = setTimeout(() => patch({ toast: false }), 3000)
    } catch (err) {
      console.error('Download failed', err)
      patch({ compiling: false })
    }
  }
  const download = () => runDownload(state.format)

  // ── Job match ──────────────────────────────────────────────────────────
  const runMatch = async () => {
    if (state.evalLoading) return
    evalAbort.current?.abort()
    const ctrl = new AbortController()
    evalAbort.current = ctrl
    patch({ evalLoading: true, evalError: null })
    try {
      const res = await evaluateResume(state, state.jobDescription, ctrl.signal)
      if (ctrl.signal.aborted) return
      patch({
        evalLoading: false,
        evalResult: res,
        evalPrevScore: state.evalResult?.score ?? null,
        evalAt: Date.now(),
        evalDimKey: res.dimensions[0]?.key ?? null,
      })
    } catch (err) {
      if (ctrl.signal.aborted) return
      patch({ evalLoading: false, evalError: err instanceof EvaluationError ? err.message : 'Evaluation failed.' })
    }
  }

  const runImport = async (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!['pdf', 'txt', 'tex', 'md', 'markdown'].includes(ext)) {
      patch({ importError: 'Unsupported file — use a PDF, .txt, .tex, or .md file.' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      patch({ importError: 'That file is too large (max 10 MB).' })
      return
    }
    patch({ importing: true, importError: null })
    try {
      const { data, ok } = await importResume(file)
      if (!ok) {
        patch({
          importing: false,
          importError: "We couldn't read enough from this file. If it's a scanned PDF, try a text-based PDF or a .txt file.",
        })
        return
      }
      // Replace résumé content with the parsed data (job-target fields + UI kept).
      setState((s) => ({
        ...s,
        firstName: '', lastName: '', email: '', linkedin: '', phone: '', location: '',
        docTitle: initialState.docTitle, summary: '',
        experience: [], projects: [], education: [],
        ...data,
        skillGroups: (data.skillGroups ?? []).map((g) => ({ ...g, draft: '' })),
        step: 0,
        importOpen: false,
        importing: false,
        importError: null,
      }) as State)
    } catch {
      patch({ importing: false, importError: 'Something went wrong reading that file. Please try another.' })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropActive(false)
    const file = e.dataTransfer.files[0]
    if (file) runImport(file)
  }

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
          const norm = normalizeResumeData(d)
          setState((s) => ({ ...s, ...norm }) as State)
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

  // ── Match report persistence (separate key; kept out of the résumé snapshot) ──
  const matchLoaded = useRef(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MATCH_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d && typeof d === 'object') {
          patch({
            jobDescription: typeof d.jobDescription === 'string' ? d.jobDescription : '',
            evalResult: d.evalResult ?? null,
            evalAt: typeof d.evalAt === 'number' ? d.evalAt : null,
            evalPrevScore: typeof d.evalPrevScore === 'number' ? d.evalPrevScore : null,
            evalDimKey: d.evalResult?.dimensions?.[0]?.key ?? null,
          })
        }
      }
    } catch { /* ignore */ }
    matchLoaded.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!matchLoaded.current) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(MATCH_KEY, JSON.stringify({
          jobDescription: state.jobDescription,
          evalResult: state.evalResult,
          evalAt: state.evalAt,
          evalPrevScore: state.evalPrevScore,
        }))
      } catch { /* ignore */ }
    }, 500)
    return () => clearTimeout(t)
  }, [state.jobDescription, state.evalResult, state.evalAt, state.evalPrevScore])

  useEffect(() => () => {
    clearTimeout(t1.current)
    clearTimeout(t2.current)
    clearTimeout(saveTimer.current)
    evalAbort.current?.abort()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── PDF preview via usePDF — debounced 300ms to avoid regenerating every keystroke ──
  const [pdfState, updatePdf] = usePDF({
    document: <ResumePdfDocument data={{ ...state, fontScale: fontScaleState }} paperSize={paperSize} />,
  })
  useEffect(() => {
    const t = setTimeout(() => {
      updatePdf(<ResumePdfDocument data={{ ...state, fontScale: fontScaleState }} paperSize={paperSize} />)
    }, 300)
    return () => clearTimeout(t)
  }, [state, paperSize, fontScaleState])

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
  const hasContent = hasResumeContent(s)
  const completeColor = complete ? 'var(--accent2)' : 'var(--accent)'
  const completeBg = complete ? 'rgba(137,49,114,.12)' : 'var(--c-accent-tint, #efeaf3)'
  const completeBorder = complete ? 'rgba(137,49,114,.38)' : 'var(--c-accent-tint-border, rgba(33,56,133,.22))'
  const ringBg = `conic-gradient(${completeColor} ${completePct * 3.6}deg, var(--c-ring-track, #e4e3ee) 0)`

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
    background: 'var(--c-bg, #fff)',
    color: 'var(--c-text, #1a1a2e)',
    '--page-w': `${pageW}px`,
    '--page-h': `${pageH}px`,
  } as CSSProperties

  const focus = 'dc-input'

  const fz = fontScaleState
  const setFontScale = (next: number) => {
    const clamped = clampFontScale(+next.toFixed(2))
    setFontScaleState(clamped)
    try { localStorage.setItem(FONT_SCALE_KEY, String(clamped)) } catch {}
  }

  return (
    <div style={rootStyle} data-theme={darkMode ? 'dark' : undefined}>
      {/* TOP BAR */}
      <header style={{ flex: 'none', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid var(--c-border-subtle, #ededec)', background: 'var(--c-bg, #fff)', zIndex: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--c-text-dim, #37352f)' }}>
          <img src="/logo.svg" alt="Drafted" style={{ width: '34px', height: '34px', display: 'block' }} />
          <span title="Résumé completeness" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: completeBg, border: `1px solid ${completeBorder}`, borderRadius: '20px', padding: '3px 11px 3px 4px' }}>
            {complete ? (
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>✓</span>
            ) : (
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: ringBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--c-accent-tint, #efeefb)', display: 'block' }} />
              </span>
            )}
            <span style={{ fontSize: '12px', fontWeight: 600, color: completeColor }}>{completePct}%</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '13px' }}>
          {isMobile && (
            <span title={s.saveState === 'saving' ? 'Saving…' : 'All changes saved'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', flex: 'none' }}>
              {s.saveState === 'saving' ? (
                <span style={{ width: '13px', height: '13px', border: '2px solid var(--c-border, #d8d6e8)', borderTopColor: 'var(--c-text-muted, #9b9a97)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
              ) : (
                <span style={{ color: 'var(--accent2)', fontSize: '14px' }}>✓</span>
              )}
            </span>
          )}
          <Hover as="button" onClick={() => patch({ mode: s.mode === 'match' ? 'editor' : 'match' })} onMouseDown={(e) => e.preventDefault()} title="Match your résumé to a job description" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: isMobile ? '7px 9px' : '7px 12px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'var(--accent, #213885)', border: 'none', borderRadius: '8px', cursor: 'pointer', outline: 'none', boxShadow: s.mode === 'match' ? '0 0 0 2px var(--c-accent-tint-border, #d9cbe4)' : 'none' }} hoverStyle={{ filter: 'brightness(1.1)' }}>
            <span style={{ fontSize: '14px' }}>◎</span>{!isMobile && ' Match'}
            {s.evalResult && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.22)', borderRadius: '6px', padding: '1px 7px', letterSpacing: '.01em' }}>{s.evalResult.score}</span>
            )}
          </Hover>
          {!isMobile && (
          <Hover as="button" onClick={() => patch({ importOpen: true, importError: null })} onMouseDown={(e) => e.preventDefault()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '5px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--accent,#213885)', background: 'var(--c-import-bg, #efedfb)', border: '1px solid var(--c-import-border, #ddd8f7)', borderRadius: '8px', cursor: 'pointer', outline: 'none' }} hoverStyle={{ background: 'var(--c-import-hover-bg, #e6e2fb)', borderColor: 'var(--c-import-border, #c9c1f2)' }}>
            <UploadIcon /> Import
          </Hover>
          )}
          <div style={isMobile ? { display: 'contents' } : { position: 'relative' }}>
            {!isMobile && (
            <Hover as="button" onClick={() => patch({ resetDialogOpen: !s.resetDialogOpen })} onMouseDown={(e) => e.preventDefault()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '5px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--c-text-subtle, #6b6a72)', background: 'var(--c-reset-bg, #f0eff2)', border: '1px solid var(--c-reset-border, #d5d4d8)', borderRadius: '8px', cursor: 'pointer', outline: 'none' }} hoverStyle={{ background: 'var(--c-reset-hover-bg, #e5e4e8)', borderColor: 'var(--c-reset-border, #bbb)' }}>
              <span>↺</span> Reset
            </Hover>
            )}
            {s.resetDialogOpen && (
              <>
                <div onClick={() => patch({ resetDialogOpen: false })} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ ...(isMobile ? { position: 'fixed', top: '52px', right: '12px' } : { position: 'absolute', top: 'calc(100% + 8px)', left: 0 }), background: 'var(--c-bg-elevated, #fff)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.16)', border: '1px solid var(--c-border, #e5e4e8)', padding: '8px', zIndex: 41, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', whiteSpace: 'nowrap' }}>
                  <div style={{ padding: '4px 6px 8px', borderBottom: '1px solid var(--c-border-subtle, #f0eff2)', marginBottom: '4px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: 'var(--c-text, #1a1a1a)' }}>Reset?</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-muted, #999)', lineHeight: 1.4 }}>This can't be undone.</p>
                  </div>
                  <Hover as="button" onClick={() => { localStorage.removeItem(SAVE_KEY); setState(initialState) }} style={{ width: '100%', padding: '8px 14px', fontSize: '13px', fontWeight: 600, textAlign: 'left', borderRadius: '8px', cursor: 'pointer', border: 'none', color: '#fff', background: '#c0392b' }} hoverStyle={{ filter: 'brightness(1.1)' }}>
                    Reset All
                  </Hover>
                  <Hover as="button" onClick={() => patch({ ...sectionResets[s.step], resetDialogOpen: false })} style={{ width: '100%', padding: '8px 14px', fontSize: '13px', fontWeight: 500, textAlign: 'left', borderRadius: '8px', cursor: 'pointer', color: '#c0392b', background: 'rgba(192,57,43,.08)', border: '1px solid rgba(192,57,43,.2)' }} hoverStyle={{ background: 'rgba(192,57,43,.14)' }}>
                    Reset "{stepMeta[s.step].label}"
                  </Hover>
                  <Hover as="button" onClick={() => patch({ resetDialogOpen: false })} style={{ width: '100%', padding: '8px 14px', fontSize: '13px', fontWeight: 500, textAlign: 'left', borderRadius: '8px', cursor: 'pointer', border: 'none', color: 'var(--c-text-subtle, #555)', background: 'var(--c-reset-bg, #f0eff2)' }} hoverStyle={{ background: 'var(--c-reset-hover-bg, #e5e4e8)' }}>
                    Cancel
                  </Hover>
                </div>
              </>
            )}
          </div>
          {!isMobile && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--c-text-muted, #9b9a97)' }}>
            {s.saveState === 'saving' ? (
              <span style={{ width: '11px', height: '11px', border: '2px solid var(--c-border, #d8d6e8)', borderTopColor: 'var(--c-text-muted, #9b9a97)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
            ) : (
              <><span style={{ color: 'var(--accent2)' }}>✓</span> Saved</>
            )}
          </span>
          )}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'stretch', background: 'var(--accent)', borderRadius: '8px', overflow: 'hidden' }}>
              <Hover as="button" onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 10px 7px 14px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'transparent', border: 'none', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.12)' }}>
                <span style={{ fontSize: '13px' }}>↓</span> Download
              </Hover>
              <Hover as="button" onClick={() => patch({ menuOpen: !s.menuOpen })} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,.22)', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.12)' }}>
                {!isMobile && <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.22)', borderRadius: '5px', padding: '2px 7px', letterSpacing: '.01em' }}>.{ext}</span>}
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.8)' }}>▼</span>
              </Hover>
            </div>
            {s.menuOpen && (
              <>
                <div onClick={() => patch({ menuOpen: false })} style={{ position: 'fixed', inset: 0, zIndex: 18 }} />
                <div style={{ position: 'absolute', top: '42px', right: 0, width: '220px', background: 'var(--c-bg-elevated, #fff)', border: '1px solid var(--c-border-subtle, #e6e5e1)', borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,.15)', padding: '6px', zIndex: 20 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.06em', color: 'var(--c-text-muted, #9b9a97)', padding: '8px 10px 6px' }}>CHOOSE A FORMAT</div>
                  {formatOptions.map(([key, label, fext]) => {
                    const active = key === s.format
                    return (
                      <Hover key={key} onClick={() => runDownload(key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', background: active ? 'var(--c-accent-tint, #f3f2fc)' : 'transparent' }} hoverStyle={{ background: 'var(--c-accent-tint, #f3f2fc)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--c-text, #2c2c34)' }}>{label}</span>
                          <span style={{ fontSize: '12px', color: 'var(--c-text-muted, #9b9a97)' }}>{fext}</span>
                        </div>
                        {active && <span style={{ color: 'var(--accent,#213885)', fontSize: '15px', fontWeight: 600 }}>✓</span>}
                      </Hover>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          {isMobile && (
            <div style={{ position: 'relative' }}>
              <Hover as="button" onClick={() => patch({ overflowOpen: !s.overflowOpen })} onMouseDown={(e) => e.preventDefault()} title="More actions" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', fontSize: '18px', fontWeight: 700, lineHeight: 1, color: 'var(--c-text-subtle, #6b6a72)', background: 'var(--c-reset-bg, #f0eff2)', border: '1px solid var(--c-reset-border, #d5d4d8)', borderRadius: '8px', cursor: 'pointer', outline: 'none' }} hoverStyle={{ background: 'var(--c-reset-hover-bg, #e5e4e8)', borderColor: 'var(--c-reset-border, #bbb)' }}>
                ⋯
              </Hover>
              {s.overflowOpen && (
                <>
                  <div onClick={() => patch({ overflowOpen: false })} style={{ position: 'fixed', inset: 0, zIndex: 18 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: 'var(--c-bg-elevated, #fff)', border: '1px solid var(--c-border-subtle, #e6e5e1)', borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,.15)', padding: '6px', zIndex: 20 }}>
                    <Hover onClick={() => patch({ importOpen: true, importError: null, overflowOpen: false })} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--c-text, #2c2c34)' }} hoverStyle={{ background: 'var(--c-accent-tint, #f3f2fc)' }}>
                      <UploadIcon /> Import
                    </Hover>
                    <Hover onClick={() => patch({ resetDialogOpen: true, overflowOpen: false })} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--c-text, #2c2c34)' }} hoverStyle={{ background: 'var(--c-accent-tint, #f3f2fc)' }}>
                      <span style={{ width: '16px', textAlign: 'center' }}>↺</span> Reset…
                    </Hover>
                    <Hover onClick={() => { toggleDark(); patch({ overflowOpen: false }) }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: 'var(--c-text, #2c2c34)' }} hoverStyle={{ background: 'var(--c-accent-tint, #f3f2fc)' }}>
                      <span style={{ width: '16px', textAlign: 'center' }}>{darkMode ? '☀️' : '🌙'}</span> {darkMode ? 'Light mode' : 'Dark mode'}
                    </Hover>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* STEPPER */}
      <nav style={{ flex: 'none', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0', borderBottom: '1px solid var(--c-border-subtle, #ededec)', background: 'var(--c-bg-subtle, #fafaf9)', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px' } as CSSProperties}>
        {stepMeta.map((m, i) => {
          const activeStep = s.step === i
          const isPast = i < s.step
          const sectionDone = checks[i]
          const showAlert = isPast && !sectionDone
          const badgeBg = activeStep ? 'var(--accent)' : sectionDone ? 'rgba(137,49,114,.15)' : showAlert ? 'var(--accent2)' : 'var(--c-bg, #fff)'
          const badgeColor = activeStep ? '#fff' : sectionDone ? 'var(--accent2)' : showAlert ? '#fff' : 'var(--c-text-muted, #b3b1ab)'
          const badgeBorder = activeStep ? 'var(--accent)' : sectionDone || showAlert ? 'var(--accent2)' : 'var(--c-border, #dcdbd6)'
          const badgeLabel = activeStep ? String(i + 1) : sectionDone ? '✓' : showAlert ? '!' : String(i + 1)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: '36px', height: '1px', background: 'var(--c-border, #dcdbd6)' }} />}
              <Hover
                onClick={() => patch({ step: i, mode: 'editor' })}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: activeStep ? '5px 12px 5px 5px' : '5px 8px 5px 5px', borderRadius: '20px', cursor: 'pointer', background: activeStep ? 'var(--c-bg-muted, #eeeeec)' : 'transparent', border: 'none', transition: 'background .1s' }}
                hoverStyle={{ background: 'var(--c-bg-muted, #eeeeec)' }}
              >
                <span style={{ flex: 'none', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: badgeBg, color: badgeColor, border: `1.5px solid ${badgeBorder}` }}>
                  {badgeLabel}
                </span>
                <span style={{ fontSize: '13px', fontWeight: activeStep ? 600 : 400, color: activeStep ? 'var(--c-text-dim, #37352f)' : 'var(--c-text-muted, #9b9a97)', whiteSpace: 'nowrap' }}>{m.label}</span>
              </Hover>
            </div>
          )
        })}
      </nav>

      {isMobile && (
        <div style={{ flex: 'none', display: 'flex', padding: '8px 16px', gap: '10px', borderBottom: '1px solid var(--c-border-subtle, #ededec)', background: 'var(--c-bg, #fff)' }}>
          <MobileTabBtn active={s.mobilePane === 'edit'} onClick={() => patch({ mobilePane: 'edit' })}>✏️ Edit</MobileTabBtn>
          <MobileTabBtn active={s.mobilePane === 'preview'} onClick={() => patch({ mobilePane: 'preview' })}>📄 Preview</MobileTabBtn>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
        {s.mode === 'match' ? (
          <JobMatchMode
            jobDescription={s.jobDescription}
            jdInputMode={s.jdInputMode}
            result={s.evalResult}
            previousScore={s.evalPrevScore}
            evaluatedAt={s.evalAt}
            loading={s.evalLoading}
            error={s.evalError}
            selectedDimKey={s.evalDimKey}
            hasContent={hasContent}
            isMobile={isMobile}
            mobilePane={s.mobilePane}
            onJdChange={(v) => patch({ jobDescription: v })}
            onJdModeChange={(m) => patch({ jdInputMode: m })}
            onRun={runMatch}
            onSelectDim={(k) => patch({ evalDimKey: k })}
            onJumpToSection={(step) => patch({ step, mode: 'editor' })}
            onBack={() => patch({ mode: 'editor' })}
          />
        ) : (
          <>
        {/* FORM COLUMN */}
        <section style={{ width: isMobile ? '100%' : '560px', flex: 'none', display: isMobile && s.mobilePane === 'preview' ? 'none' : 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid var(--c-border-subtle, #ededec)', minWidth: 0, background: 'var(--c-bg, #fff)' }}>
          <div style={{ flex: 'none', padding: isMobile ? '14px 18px 10px' : '18px 20px 12px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--c-text, #2c2c34)', margin: '0 0 4px' }}>{stepMeta[s.step].title}</h1>
            <p style={{ fontSize: '14px', color: 'var(--c-text-muted, #9b9a97)', margin: 0 }}>{stepMeta[s.step].subtitle}</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '6px 18px 20px' : '6px 20px 24px' }}>
            {/* STEP 0 : PERSONAL INFO */}
            {s.step === 0 && (
              <div>
                <div style={{ margin: '0 0 16px', padding: '12px 14px 14px', background: 'var(--c-accent-tint, #efeaf3)', border: '1px solid var(--c-accent-tint-border, #d9cbe4)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px' }}>
                    <span style={{ flex: 'none', width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(137,49,114,.14)', border: '1px solid rgba(137,49,114,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--accent2,#893172)' }}>◎</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text, #2c2c34)' }}>Applying for</span>
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
                    <span style={{ color: 'var(--accent2,#893172)' }}>↓</span>
                    <span style={{ color: 'var(--c-text-subtle, #6b6a72)' }}>{fileName}.{ext}</span>
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
                  <ExperienceCard key={it.id} item={it} drag={makeDrag('experience', i)} remove={() => removeItem('experience', i)} update={(f, v) => setItemField('experience', i, f as string, v)} />
                ))}
                <Hover as="button" onClick={() => addItem('experience', { id: genId(), company: '', role: '', employment: 'Full-time', start: '', end: '', present: false, bulletsText: '' })} style={addBtn} hoverStyle={addBtnHover}>+ Add experience</Hover>
              </div>
            )}

            {/* STEP 2 : PROJECTS */}
            {s.step === 2 && (
              <div>
                {s.projects.map((it, i) => (
                  <ProjectCard key={it.id} item={it} drag={makeDrag('projects', i)} remove={() => removeItem('projects', i)} update={(f, v) => setItemField('projects', i, f as string, v)} onCommitTech={() => commitProjectTech(i)} onRemoveTech={(j) => removeProjectTech(i, j)} onBackspaceTech={() => backspaceProjectTech(i)} />
                ))}
                <Hover as="button" onClick={() => addItem('projects', { id: genId(), name: '', link: '', description: '', techStack: [], techStackDraft: '' })} style={addBtn} hoverStyle={addBtnHover}>+ Add project</Hover>
              </div>
            )}

            {/* STEP 3 : EDUCATION */}
            {s.step === 3 && (
              <div>
                {s.education.map((it, i) => (
                  <EducationCard key={it.id} item={it} drag={makeDrag('education', i)} remove={() => removeItem('education', i)} update={(f, v) => setItemField('education', i, f as string, v)} />
                ))}
                <Hover as="button" onClick={() => addItem('education', { id: genId(), school: '', degree: '', start: '', end: '', extraDetails: [] })} style={addBtn} hoverStyle={addBtnHover}>+ Add education</Hover>
              </div>
            )}

            {/* STEP 4 : SKILLS */}
            {s.step === 4 && (
              <div>
                {s.skillGroups.map((it, i) => (
                  <SkillCard key={it.id} item={it} drag={makeDrag('skillGroups', i)} remove={() => removeItem('skillGroups', i)} update={(f, v) => setItemField('skillGroups', i, f as string, v)} onCommit={() => commitTag(i)} onRemoveTag={(j) => removeTag(i, j)} onBackspace={() => backspaceTag(i)} />
                ))}
                <Hover as="button" onClick={() => addItem('skillGroups', { id: genId(), label: '', items: [], draft: '' })} style={{ ...addBtn, marginTop: '6px' }} hoverStyle={addBtnHover}>+ Add category</Hover>
              </div>
            )}
          </div>

          {/* FOOTER NAV */}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '18px', padding: '13px 24px', borderTop: '1px solid var(--c-border-subtle, #ededec)', background: 'var(--c-bg, #fff)' }}>
            <Hover as="button" onClick={() => patch({ step: Math.max(0, s.step - 1) })} disabled={s.step === 0} style={{ flex: 'none', fontSize: '13.5px', fontWeight: 500, color: s.step === 0 ? 'var(--c-border, #cfcdc7)' : 'var(--c-text-dim, #37352f)', background: 'var(--c-bg, #fff)', border: '1px solid var(--c-border-subtle, #e6e5e1)', borderRadius: '7px', padding: '9px 18px', cursor: s.step === 0 ? 'default' : 'pointer' }} hoverStyle={{ background: 'var(--c-bg-subtle, #f7f6f4)' }}>Prev</Hover>
            <div style={{ flex: 1, height: '7px', borderRadius: '5px', background: 'var(--c-border, #ebebf0)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent,#213885)', width: `${((s.step + 1) / 5) * 100}%`, borderRadius: '5px', transition: 'width .25s ease' }} />
            </div>
            <Hover as="button" onClick={isLast ? download : () => patch({ step: Math.min(4, s.step + 1) })} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13.5px', fontWeight: 600, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: '7px', padding: '9px 20px', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.12)' }}>{isLast ? '↓ Download' : 'Next'}</Hover>
          </div>
        </section>

        {/* PREVIEW PANE */}
        <section style={{ flex: 1, display: isMobile && s.mobilePane === 'edit' ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--c-bg-muted, #f0eff2)', position: 'relative' }}>
          <div style={{ flex: 'none', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 18px', borderBottom: '1px solid var(--c-border-subtle, #e2e1e4)', background: 'var(--c-preview-toolbar-bg, #faf9fb)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FontSizeControl scale={fz} onChange={setFontScale} />
              <div style={{ display: 'flex', gap: '2px', background: 'var(--c-preview-tab-bg, #e4e3e8)', borderRadius: '7px', padding: '2px' }}>
                <TabButton active={s.view === 'preview'} onClick={() => patch({ view: 'preview' })}>Typeset</TabButton>
                <TabButton active={s.view === 'source'} onClick={() => patch({ view: 'source' })}>.tex</TabButton>
              </div>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {s.view === 'preview' && isEmpty ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{ width: '100%', maxWidth: 680, background: dropActive ? 'var(--c-accent-tint, #efeefb)' : 'var(--c-bg, #fff)', border: `2px dashed ${dropActive ? 'var(--accent, #213885)' : 'var(--c-accent-tint-border, #d0cfe8)'}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '64px 64px', transition: 'border-color .15s, background .15s' }}
                >
                  <img src={darkMode ? '/upload-doc-dark.png' : '/upload-doc-light.png'} alt="" width={300} style={{ flexShrink: 0, display: 'block' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', color: dropActive ? 'var(--accent,#213885)' : 'var(--c-text-dim, #101a3d)', transition: 'color .15s' }}>
                      {dropActive ? 'Drop to import' : 'Drop your file here'}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--c-text-muted, #6f6d78)' }}>or upload from your device</p>
                  </div>
                  <button
                    onClick={() => patch({ importOpen: true, importError: null })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 26px', fontSize: '14px', fontWeight: 600, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    Upload your file
                  </button>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '2px', fontSize: '12.5px', color: 'var(--c-text-muted, #6f6d78)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Your file is secure and will only be used for this application.
                  </div>
                </div>
              </div>
            ) : s.view === 'preview' ? (
              <>
                <iframe
                  src={pdfState.url ? `${pdfState.url}#toolbar=0&zoom=page-fit` : undefined}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title="Resume preview"
                />
                {pdfState.loading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(240,239,242,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                    <span style={{ fontSize: '13px', color: 'var(--c-text-subtle,#888)' }}>Updating…</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ height: '100%', overflowY: 'auto', padding: '34px 30px 70px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 'var(--page-w,816px)', maxWidth: '100%', flex: 'none', background: '#1f1e1b', boxShadow: '0 8px 30px rgba(0,0,0,.18)', borderRadius: '8px', padding: '22px 24px', minHeight: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', margin: '0 0 14px' }}>
                    <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ec6a5e', display: 'inline-block' }} />
                    <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f4bf4f', display: 'inline-block' }} />
                    <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#61c554', display: 'inline-block' }} />
                    <span style={{ marginLeft: '8px', fontSize: '11.5px', color: '#8a877f' }}>{fileName}.tex</span>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'IBM Plex Mono',ui-monospace,monospace", fontSize: '12px', lineHeight: 1.6, color: '#d7d3c8', margin: 0 }}>{genTex({ ...s, fontScale: fontScaleState }, paperSize)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* FILENAME STATUS BAR */}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '34px', borderTop: '1px solid var(--c-border-subtle, #e2e1e4)', background: 'var(--c-preview-toolbar-bg, #faf9fb)' }}>
            <span style={{ color: 'var(--accent2,#893172)', fontSize: '12px' }}>↓</span>
            <span style={{ fontSize: '12.5px', color: 'var(--c-text-subtle, #6b6a72)' }}>{fileName}.{ext}</span>
          </div>

          {/* COMPILING OVERLAY */}
          {s.compiling && (
            <div style={{ position: 'absolute', inset: '42px 0 34px 0', background: 'var(--c-overlay-bg, rgba(240,239,242,.78))', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', zIndex: 8 }}>
              <div style={{ width: '34px', height: '34px', border: '3px solid var(--c-overlay-spinner-track, #dcdbe2)', borderTopColor: 'var(--accent,#213885)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              <div style={{ fontSize: '13.5px', color: 'var(--c-text-subtle, #6b6a72)', fontWeight: 500 }}>Generating {s.format} file…</div>
            </div>
          )}
        </section>
          </>
        )}
      </div>

      {/* TOAST */}
      {s.toast && (
        <div style={{ position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)', background: 'var(--c-toast-bg, #2c2c34)', color: 'var(--c-toast-text, #fff)', fontSize: '13.5px', fontWeight: 500, padding: '11px 18px', borderRadius: '9px', boxShadow: '0 8px 30px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: '9px', animation: 'pop .2s ease', zIndex: 20 }}>
          <span style={{ color: 'var(--accent2,#893172)', fontSize: '15px' }}>✓</span> {fileName}.{ext} downloaded
        </div>
      )}

      <ImportModal
        open={s.importOpen}
        importing={s.importing}
        error={s.importError}
        darkMode={darkMode}
        hasContent={hasContent}
        onFile={runImport}
        onClose={() => patch({ importOpen: false, importError: null })}
      />

      {/* Dark mode toggle — desktop floating button (bottom-right) */}
      <Hover
        as="button"
        onClick={toggleDark}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        className="dark-toggle-desktop"
        style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', border: '1px solid var(--c-border-subtle, #ededec)', borderRadius: '12px', background: 'var(--c-bg-elevated, #fff)', boxShadow: '0 2px 12px rgba(0,0,0,.10)', cursor: 'pointer', fontSize: '20px', outline: 'none', zIndex: 30 }}
        hoverStyle={{ background: 'var(--c-bg-muted, #f0eff2)', boxShadow: '0 4px 16px rgba(0,0,0,.14)' }}
      >
        {darkMode ? '☀️' : '🌙'}
      </Hover>
    </div>
  )
}

/* A labelled Personal-Info field with an optional required asterisk + validation check. */
function PersonalField({ label, required, check, input }: { label: string; required?: boolean; check?: boolean; input: React.ReactNode }) {
  return (
    <div style={{ margin: '0 0 14px' }}>
      <label style={labelStyle}>
        {required && <span style={{ color: 'var(--accent2,#893172)' }}>*</span>}
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

/** A− / A+ résumé font-size stepper for the preview toolbar. Disables at the clamp limits.
 *  Mirrors the header Import button's indigo-on-tint styling (and its dark-mode tokens). */
function FontSizeControl({ scale, onChange }: { scale: number; onChange: (next: number) => void }) {
  const atMin = scale <= FONT_SCALE_MIN + 1e-6
  const atMax = scale >= FONT_SCALE_MAX - 1e-6
  const stepBtn = (label: string, disabled: boolean, onClick: () => void, aria: string) => (
    <Hover
      as="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={aria}
      aria-label={aria}
      style={{
        minWidth: '40px', height: '30px', padding: '0 12px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 700, lineHeight: 1, color: 'var(--accent,#213885)',
        background: 'var(--c-import-bg, #efedfb)', border: '1px solid var(--c-import-border, #ddd8f7)',
        borderRadius: '8px', outline: 'none',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
      hoverStyle={disabled ? {} : { background: 'var(--c-import-hover-bg, #e6e2fb)', borderColor: 'var(--c-import-border, #c9c1f2)' }}
    >
      {label}
    </Hover>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {stepBtn('A−', atMin, () => onChange(scale - FONT_SCALE_STEP), 'Decrease font size')}
      {stepBtn('A+', atMax, () => onChange(scale + FONT_SCALE_STEP), 'Increase font size')}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ fontSize: '12.5px', fontWeight: 500, color: active ? 'var(--c-text-dim, #37352f)' : 'var(--c-text-muted, #9b9a97)', background: active ? 'var(--c-bg, #fff)' : 'transparent', border: 'none', borderRadius: '5px', padding: '5px 13px', cursor: 'pointer' }}>
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
        color: active ? 'var(--c-text-dim, #37352f)' : 'var(--c-text-muted, #9b9a97)',
        background: active ? 'var(--c-mobile-tab-active, #fff)' : 'var(--c-mobile-tab-inactive, #f5f5f5)',
        border: `1.5px solid ${active ? 'var(--c-mobile-tab-active-border, #d8d6e8)' : 'var(--c-mobile-tab-inactive-border, #e8e8ec)'}`,
        borderRadius: '8px',
        padding: '9px 0',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
