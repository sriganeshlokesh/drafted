import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Hover } from './Hover'
import { EvaluationError, reviseResume } from './evaluation'
import type { EvaluationResponse, EvaluationSuggestion, RevisionChange } from './evaluation'
import type { ResumeData } from './types'
import { labelStyle } from './styles'
import { DIM_SHADES, MISSED_FILL, matchBand, pointsLeft, relativeTime, sectionTarget, shortDimLabel } from './matchScore'
import { resolveTarget, suggestionKey } from './revisionTarget'
import { ReviseModal } from './ReviseModal'

export interface JobMatchModeProps {
  jobDescription: string
  jdInputMode: 'link' | 'paste'
  result: EvaluationResponse | null
  previousScore: number | null
  evaluatedAt: number | null
  loading: boolean
  error: string | null
  selectedDimKey: string | null
  hasContent: boolean
  isMobile: boolean
  mobilePane: 'edit' | 'preview'
  /** Current résumé state — actionable suggestions resolve their targets against it. */
  resume: ResumeData
  onJdChange: (value: string) => void
  onJdModeChange: (mode: 'link' | 'paste') => void
  onRun: () => void
  onSelectDim: (key: string) => void
  onJumpToSection: (step: number) => void
  onBack: () => void
  /** Called when the user accepts a previewed change in the diff modal. */
  onApply: (change: RevisionChange) => void
}

// ── Shared style tokens ─────────────────────────────────────────────────────
const cardStyle: CSSProperties = {
  background: 'var(--c-bg, #fff)',
  border: '1px solid var(--c-border-subtle, #e6e6ea)',
  borderRadius: '16px',
  padding: '22px 24px',
  marginBottom: '18px',
}
const sectionLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--c-text-muted, #9b9a97)',
}

// ── Small building blocks ───────────────────────────────────────────────────
function Spinner({ size = 16, light = false }: { size?: number; light?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${light ? 'rgba(255,255,255,.4)' : 'var(--c-overlay-spinner-track, #dcdbe2)'}`,
        borderTopColor: light ? '#fff' : 'var(--accent, #213885)',
        display: 'inline-block',
        animation: 'spin .7s linear infinite',
        flex: 'none',
      }}
    />
  )
}

function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const ring = `conic-gradient(var(--accent, #213885) ${score * 3.6}deg, var(--c-ring-track, #e2e2e6) 0)`
  const inner = size - 10
  return (
    <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: ring, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <span style={{ width: inner, height: inner, borderRadius: '50%', background: 'var(--c-bg, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 44 ? '16px' : '12px', fontWeight: 700, color: 'var(--c-text, #1a1a2e)' }}>
        {score}
      </span>
    </span>
  )
}

function DeltaChip({ delta }: { delta: number }) {
  const up = delta > 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', background: up ? 'rgba(232,145,18,.14)' : 'rgba(192,57,43,.12)', color: up ? '#9a5b12' : '#b23b2e' }}>
      {up ? `▲ +${delta}` : `▼ ${Math.abs(delta)}`} vs last run
    </span>
  )
}

// ── Left: job-description input panel ────────────────────────────────────────
function JobMatchInputPanel(props: JobMatchModeProps) {
  const { jobDescription, jdInputMode, result, previousScore, evaluatedAt, loading, hasContent, onJdChange, onJdModeChange, onRun, onBack } = props
  const canRun = !!jobDescription.trim() && hasContent && !loading
  const band = result ? matchBand(result.score) : null
  const delta = result && previousScore != null ? result.score - previousScore : null

  const segTab = (key: 'link' | 'paste', text: string, disabled = false) => {
    const active = jdInputMode === key
    return (
      <Hover
        as="button"
        disabled={disabled}
        title={disabled ? 'Coming soon — paste text for now' : undefined}
        onClick={disabled ? undefined : () => onJdModeChange(key)}
        style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '7px', cursor: disabled ? 'default' : 'pointer', background: active ? 'var(--c-bg, #fff)' : 'transparent', color: disabled ? 'var(--c-text-muted, #9b9a97)' : active ? 'var(--c-text, #1a1a2e)' : 'var(--c-text-subtle, #55535f)', boxShadow: active ? '0 1px 2px rgba(0,0,0,.08)' : 'none', opacity: disabled ? 0.55 : 1 }}
        hoverStyle={disabled || active ? {} : { color: 'var(--c-text, #1a1a2e)' }}
      >
        {text}
      </Hover>
    )
  }

  return (
    <>
      <div style={{ flex: 'none', padding: props.isMobile ? '14px 18px 10px' : '18px 20px 12px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--c-text, #2c2c34)', margin: '0 0 4px' }}>Job match</h1>
        <p style={{ fontSize: '14px', color: 'var(--c-text-muted, #9b9a97)', margin: 0 }}>Check your résumé against a job description</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px', minHeight: 0 }}>
        <label style={labelStyle}>Job description</label>
        <div style={{ display: 'inline-flex', gap: '3px', background: 'var(--c-preview-tab-bg, #e4e3e8)', borderRadius: '9px', padding: '3px', marginBottom: '12px' }}>
          {segTab('link', 'Link', true)}
          {segTab('paste', 'Paste text')}
        </div>

        <textarea
          className="dc-input"
          value={jobDescription}
          onChange={(e) => onJdChange(e.target.value)}
          placeholder="Paste the full job description here…"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: '260px', resize: 'vertical', fontSize: '14px', lineHeight: 1.5, color: 'var(--c-text, #2c2c34)', background: 'var(--c-bg, #fff)', border: '1px solid var(--c-border, #d7d7db)', borderRadius: '10px', padding: '12px 14px', outline: 'none' }}
        />
        <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted, #9b9a97)', margin: '8px 0 16px' }}>Tip: include the requirements section — it drives the score.</p>

        <Hover
          as="button"
          onClick={canRun ? onRun : undefined}
          disabled={!canRun}
          style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', fontSize: '14.5px', fontWeight: 700, color: '#fff', background: 'var(--accent, #213885)', border: 'none', borderRadius: '10px', cursor: canRun ? 'pointer' : 'default', opacity: canRun ? 1 : 0.5 }}
          hoverStyle={canRun ? { filter: 'brightness(1.08)' } : {}}
        >
          {loading ? <><Spinner size={16} light /> Matching…</> : <><span>◎</span> {result ? 'Re-run match' : 'Run match'}</>}
        </Hover>
        {!hasContent && (
          <p style={{ fontSize: '12.5px', color: 'var(--accent2, #893172)', margin: '10px 2px 0' }}>Add résumé content in the editor first.</p>
        )}

        {result && band && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '18px', padding: '14px', border: '1px solid var(--c-border-subtle, #e6e6ea)', borderRadius: '12px', background: 'var(--c-bg-subtle, #f4f4f6)' }}>
            <ScoreRing score={result.score} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent, #213885)' }}>{band.label}</span>
                {delta != null && delta !== 0 && <DeltaChip delta={delta} />}
              </div>
              {evaluatedAt != null && (
                <div style={{ fontSize: '12.5px', color: 'var(--c-text-muted, #9b9a97)', marginTop: '2px' }}>Evaluated {relativeTime(evaluatedAt)}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '13px 20px', borderTop: '1px solid var(--c-border-subtle, #ededec)', background: 'var(--c-bg, #fff)' }}>
        <Hover as="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--c-text-subtle, #55535f)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 2px' }} hoverStyle={{ color: 'var(--accent, #213885)' }}>
          ← Back to editor
        </Hover>
        <span style={{ fontSize: '12px', color: 'var(--c-text-muted, #9b9a97)' }}>Scores use your current résumé content</span>
      </div>
    </>
  )
}

// ── Right: match report ─────────────────────────────────────────────────────
function MatchScoreCard({ result, previousScore, evaluatedAt, selectedDimKey, onSelectDim }: {
  result: EvaluationResponse
  previousScore: number | null
  evaluatedAt: number | null
  selectedDimKey: string | null
  onSelectDim: (key: string) => void
}) {
  const { score, summary, dimensions } = result
  const band = matchBand(score)
  const left = pointsLeft(score)
  const delta = previousScore != null ? score - previousScore : null
  const sel = dimensions.find((d) => d.key === selectedDimKey) ?? dimensions[0]

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <span style={sectionLabel}>Match score</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          {delta != null && delta !== 0 && <DeltaChip delta={delta} />}
          {left > 0 && (
            <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', background: 'rgba(192,57,43,.10)', border: '1px solid rgba(192,57,43,.28)', color: '#b23b2e' }}>
              {left} pts left on the table
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', margin: '8px 0 12px' }}>
        <span style={{ fontSize: '52px', fontWeight: 800, lineHeight: 1, color: 'var(--c-text, #1a1a2e)' }}>{score}</span>
        <span style={{ fontSize: '18px', color: 'var(--c-text-muted, #9b9a97)' }}>/ 100</span>
        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, letterSpacing: '.04em', color: '#fff', background: 'var(--accent, #213885)' }}>{band.label.toUpperCase()}</span>
      </div>

      {summary.trim() && (
        <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--c-text-subtle, #55535f)', margin: 0 }}>{summary}</p>
      )}

      {/* Stacked dimension bar */}
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', background: 'var(--c-ring-track, #e2e2e6)', margin: '18px 0 14px' }}>
        {dimensions.map((d, i) => (
          <div key={d.key} title={`${d.label} ${d.score}/${d.max}`} style={{ flex: `${d.score} 0 0%`, background: DIM_SHADES[i % DIM_SHADES.length] }} />
        ))}
        <div title={`Missed ${left}`} style={{ flex: `${left} 0 0%`, background: MISSED_FILL }} />
      </div>

      {/* Dimension chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {dimensions.map((d, i) => {
          const active = d.key === sel?.key
          return (
            <Hover
              as="button"
              key={d.key}
              onClick={() => onSelectDim(d.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, background: active ? 'var(--c-accent-tint, #efeaf3)' : 'var(--c-bg-subtle, #f4f4f6)', border: `1px solid ${active ? 'var(--accent, #213885)' : 'var(--c-border-subtle, #e6e6ea)'}`, color: 'var(--c-text, #1a1a2e)' }}
              hoverStyle={{ borderColor: 'var(--accent, #213885)' }}
            >
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: DIM_SHADES[i % DIM_SHADES.length], flex: 'none' }} />
              <span>{shortDimLabel(d.key, d.label)}</span>
              <span style={{ color: 'var(--c-text-muted, #9b9a97)', fontWeight: 600 }}>{d.score} / {d.max}</span>
            </Hover>
          )
        })}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, background: 'var(--c-bg-subtle, #f4f4f6)', border: '1px solid var(--c-border-subtle, #e6e6ea)', color: 'var(--c-text-muted, #9b9a97)' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: MISSED_FILL, flex: 'none' }} />
          <span>Missed {left}</span>
        </span>
      </div>

      {/* Why callout for the selected dimension */}
      {sel && (
        <div style={{ marginTop: '16px', background: 'var(--c-accent-tint, #efeaf3)', border: '1px solid var(--c-accent-tint-border, #d9cbe4)', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.06em', color: 'var(--accent, #213885)', marginBottom: '6px' }}>WHY — {sel.label.toUpperCase()}</div>
          <div style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--c-text-subtle, #55535f)' }}>{sel.evidence?.trim() || 'No evidence provided for this dimension yet.'}</div>
        </div>
      )}

      {evaluatedAt != null && (
        <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--c-text-muted, #9b9a97)' }}>Evaluated {relativeTime(evaluatedAt)}</div>
      )}
    </div>
  )
}

function HighlightsCard({ strengths, gaps }: { strengths: string[]; gaps: string[] }) {
  if (!strengths.length && !gaps.length) return null
  return (
    <div style={cardStyle}>
      <div style={{ ...sectionLabel, marginBottom: '14px' }}>Highlights</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {strengths.map((s, i) => (
          <span key={`s${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 13px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, background: 'rgba(232,145,18,.12)', border: '1px solid rgba(232,145,18,.32)', color: '#9a5b12' }}>
            <span>✓</span> {s}
          </span>
        ))}
        {gaps.map((g, i) => (
          <span key={`g${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 13px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, background: 'transparent', border: '1px dashed rgba(192,57,43,.42)', color: '#c0392b' }}>
            <span>✕</span> {g}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Transient per-row apply state; `applied`/`stale` are derived, not stored. */
type RowState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }

function SuggestedEditsCard({ suggestions, resume, jobDescription, onJumpToSection, onApply }: {
  suggestions: EvaluationSuggestion[]
  resume: ResumeData
  jobDescription: string
  onJumpToSection: (step: number) => void
  onApply: (change: RevisionChange) => void
}) {
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [preview, setPreview] = useState<{ key: string; change: RevisionChange } | null>(null)
  // One revise call in flight at a time — every other Apply button is disabled meanwhile.
  const [inFlightKey, setInFlightKey] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // A new evaluation replaces the suggestion list — drop all transient row state.
  useEffect(() => {
    abortRef.current?.abort()
    setRows({})
    setPreview(null)
    setInFlightKey(null)
  }, [suggestions])
  useEffect(() => () => abortRef.current?.abort(), [])

  if (!suggestions.length) return null

  const setRow = (key: string, row: RowState) => setRows((r) => ({ ...r, [key]: row }))

  const requestRevision = async (s: EvaluationSuggestion) => {
    const action = s.action
    if (!action || inFlightKey) return
    const resolved = resolveTarget(resume, action.target)
    if (!resolved) return // stale — button is disabled, belt and braces
    const key = suggestionKey(s)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setInFlightKey(key)
    setRow(key, { status: 'loading' })
    try {
      const res = await reviseResume({
        job_description: jobDescription,
        suggestion: s, // echoed verbatim per the wire contract
        target: { field: action.target.field, content: resolved.content, context: resolved.context },
      }, ctrl.signal)
      if (ctrl.signal.aborted) return
      const change = res.changes[0]
      if (change) {
        setRow(key, { status: 'idle' })
        setPreview({ key, change })
      } else {
        setRow(key, { status: 'error', message: 'No edit came back — try again.' })
      }
    } catch (err) {
      if (ctrl.signal.aborted) return
      setRow(key, {
        status: 'error',
        message: err instanceof EvaluationError ? err.message : 'Something went wrong — try again.',
      })
    } finally {
      setInFlightKey((cur) => (cur === key ? null : cur))
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '14px' }}>
        <span style={sectionLabel}>Suggested edits</span>
        <span style={{ fontSize: '12px', color: 'var(--c-text-muted, #9b9a97)' }}>Est. lift · jump straight to the section</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {suggestions.map((s) => {
          const key = suggestionKey(s)
          const target = sectionTarget(s.section)
          const resolved = s.action ? resolveTarget(resume, s.action.target) : null
          const stale = !!s.action && !resolved
          const row = rows[key] ?? { status: 'idle' }
          const loading = row.status === 'loading'
          const applyDisabled = stale || inFlightKey !== null
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {s.estimated_lift > 0 && (
                  <span style={{ flex: 'none', marginTop: '1px', fontSize: '12px', fontWeight: 700, color: '#fff', background: '#e0901d', borderRadius: '20px', padding: '3px 10px', whiteSpace: 'nowrap' }}>+{s.estimated_lift} pts</span>
                )}
                <span style={{ flex: 1, fontSize: '14px', lineHeight: 1.5, color: 'var(--c-text, #1a1a2e)' }}>{s.text}</span>
                {s.action && (
                  <Hover
                    as="button"
                    onClick={applyDisabled ? undefined : () => requestRevision(s)}
                    disabled={applyDisabled}
                    title={stale ? 'Your resume changed here — re-run the match' : undefined}
                    style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'var(--accent, #213885)', border: 'none', borderRadius: '8px', padding: '5px 12px', cursor: applyDisabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: applyDisabled && !loading ? 0.45 : 1 }}
                    hoverStyle={applyDisabled ? {} : { filter: 'brightness(1.08)' }}
                  >
                    {loading ? <><Spinner size={12} light /> Applying…</> : row.status === 'error' ? 'Retry' : 'Apply'}
                  </Hover>
                )}
                {target && (
                  <Hover as="button" onClick={() => onJumpToSection(target.step)} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--accent, #213885)', background: 'var(--c-accent-tint, #efeaf3)', border: '1px solid var(--c-accent-tint-border, #d9cbe4)', borderRadius: '8px', padding: '5px 11px', cursor: 'pointer', whiteSpace: 'nowrap' }} hoverStyle={{ background: 'var(--c-accent-tint-hover, #e7def0)' }}>
                    {target.label} →
                  </Hover>
                )}
              </div>
              {stale && (
                <div style={{ fontSize: '12.5px', color: 'var(--c-text-muted, #9b9a97)' }}>Your resume changed here — re-run the match</div>
              )}
              {row.status === 'error' && (
                <div style={{ fontSize: '12.5px', color: '#b23b2e' }}>{row.message}</div>
              )}
            </div>
          )
        })}
      </div>
      {preview && (
        <ReviseModal
          change={preview.change}
          onAccept={() => { onApply(preview.change); setPreview(null) }}
          onDiscard={() => setPreview(null)}
        />
      )}
    </div>
  )
}

function MatchReport(props: JobMatchModeProps) {
  const { result, previousScore, evaluatedAt, loading, error, selectedDimKey, jobDescription, hasContent, resume, onRun, onSelectDim, onJumpToSection, onApply } = props
  const canRun = !!jobDescription.trim() && hasContent && !loading

  return (
    <>
      {/* Report toolbar */}
      <div style={{ flex: 'none', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '0 18px', borderBottom: '1px solid var(--c-border-subtle, #e2e1e4)', background: 'var(--c-preview-toolbar-bg, #f2f2f4)' }}>
        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12.5px', fontWeight: 600, background: 'var(--c-bg-muted, #e6e6ea)', color: 'var(--c-text-subtle, #55535f)' }}>Match report</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {result && evaluatedAt != null && (
            <span style={{ fontSize: '12.5px', color: 'var(--c-text-muted, #9b9a97)' }}>Evaluated {relativeTime(evaluatedAt)}</span>
          )}
          <Hover as="button" onClick={canRun ? onRun : undefined} disabled={!canRun} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent, #213885)', background: 'transparent', border: 'none', cursor: canRun ? 'pointer' : 'default', opacity: canRun ? 1 : 0.45, padding: '4px 6px' }} hoverStyle={canRun ? { textDecoration: 'underline' } : {}}>
            ↻ Re-run
          </Hover>
        </div>
      </div>

      {/* Report body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '22px 24px', background: 'var(--c-bg-muted, #e6e6ea)' }}>
        {error && (
          <div style={{ background: 'rgba(192,57,43,.08)', border: '1px solid rgba(192,57,43,.28)', borderRadius: '12px', padding: '14px 16px', color: '#b23b2e', fontSize: '13.5px', lineHeight: 1.5, marginBottom: '18px' }}>{error}</div>
        )}

        {!result && loading && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--c-text-muted, #9b9a97)' }}>
            <Spinner size={30} />
            <span style={{ fontSize: '13.5px' }}>Matching your résumé…</span>
          </div>
        )}

        {!result && !loading && !error && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '10px', padding: '40px', color: 'var(--c-text-muted, #9b9a97)' }}>
            <div style={{ fontSize: '34px' }}>◎</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--c-text-subtle, #55535f)' }}>Run a match to see your report</div>
            <div style={{ fontSize: '13.5px', maxWidth: '320px', lineHeight: 1.5 }}>Paste a job description on the left and we'll score your current résumé against it.</div>
          </div>
        )}

        {result && (
          <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s', maxWidth: '760px', margin: '0 auto' }}>
            <MatchScoreCard result={result} previousScore={previousScore} evaluatedAt={evaluatedAt} selectedDimKey={selectedDimKey} onSelectDim={onSelectDim} />
            <HighlightsCard strengths={result.strengths} gaps={result.gaps} />
            <SuggestedEditsCard suggestions={result.suggestions} resume={resume} jobDescription={jobDescription} onJumpToSection={onJumpToSection} onApply={onApply} />
          </div>
        )}
      </div>
    </>
  )
}

// ── Mode wrapper: two sections mirroring the editor split ────────────────────
export function JobMatchMode(props: JobMatchModeProps) {
  const { isMobile, mobilePane } = props
  return (
    <>
      <section style={{ width: isMobile ? '100%' : '560px', flex: 'none', display: isMobile && mobilePane === 'preview' ? 'none' : 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid var(--c-border-subtle, #ededec)', minWidth: 0, background: 'var(--c-bg, #fff)' }}>
        <JobMatchInputPanel {...props} />
      </section>
      <section style={{ flex: 1, display: isMobile && mobilePane === 'edit' ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--c-bg-muted, #e6e6ea)', position: 'relative' }}>
        <MatchReport {...props} />
      </section>
    </>
  )
}
