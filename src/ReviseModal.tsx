import { useEffect } from 'react'
import { Hover } from './Hover'
import type { RevisionChange } from './evaluation'

interface Props {
  change: RevisionChange
  onAccept: () => void
  onDiscard: () => void
}

const panelLabel = (color: string): React.CSSProperties => ({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color,
  marginBottom: '7px',
})

/**
 * Before/after preview for a proposed revision. Read-only by design: the user
 * is the final gate — "Apply change" hands the change back to the editor,
 * Discard (button, Esc, or backdrop) drops it without touching any state.
 */
export function ReviseModal({ change, onAccept, onDiscard }: Props) {
  // Esc mirrors the backdrop click: discard, never apply.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDiscard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDiscard])

  return (
    <>
      <div onClick={onDiscard} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)', zIndex: 40 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review proposed edit"
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', background: 'var(--c-bg-elevated, #fff)', border: '1px solid var(--c-border-subtle, #e6e6ea)', borderRadius: '18px', padding: '24px 28px 20px', boxShadow: '0 24px 70px rgba(0,0,0,.28)', zIndex: 41, animation: 'pop .2s ease' }}
      >
        {/* Header */}
        <p style={{ margin: '0 0 4px', fontSize: '19px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--c-text, #1a1a2e)' }}>Review proposed edit</p>
        {change.rationale.trim() && (
          <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.45, color: 'var(--c-text-muted, #6f6d78)' }}>{change.rationale}</p>
        )}

        {/* Stacked before/after panels.
            dangerouslySetInnerHTML is acceptable here — and only here — because:
            - `before` is the user's own Tiptap editor output (their own content), and
            - `after` was sanitized by the backend against a strict tag allowlist
              (p, ul, ol, li, strong, em, br; all attributes stripped) before it
              ever reaches this client. */}
        <div style={{ marginTop: '18px' }}>
          <div style={panelLabel('var(--c-text-muted, #9b9a97)')}>Before</div>
          <div
            className="revise-html"
            style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--c-text-subtle, #55535f)', background: 'var(--c-bg-subtle, #f4f4f6)', border: '1px solid var(--c-border-subtle, #e6e6ea)', borderRadius: '10px', padding: '12px 14px' }}
            dangerouslySetInnerHTML={{ __html: change.before }}
          />
        </div>
        <div style={{ marginTop: '14px' }}>
          <div style={panelLabel('var(--accent, #213885)')}>After</div>
          <div
            className="revise-html"
            style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--c-text, #1a1a2e)', background: 'var(--c-accent-tint, #efeaf3)', border: '1px solid var(--c-accent-tint-border, #d9cbe4)', borderRadius: '10px', padding: '12px 14px' }}
            dangerouslySetInnerHTML={{ __html: change.after }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Hover as="button" onClick={onDiscard} style={{ padding: '10px 20px', fontSize: '13.5px', fontWeight: 600, color: 'var(--c-text, #1a1a2e)', background: 'var(--c-bg, #fff)', border: '1px solid var(--c-border, #d7d7db)', borderRadius: '9px', cursor: 'pointer' }} hoverStyle={{ background: 'var(--c-bg-subtle, #f4f4f6)' }}>
            Discard
          </Hover>
          <Hover as="button" onClick={onAccept} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 700, color: '#fff', background: 'var(--accent, #213885)', border: 'none', borderRadius: '9px', cursor: 'pointer' }} hoverStyle={{ filter: 'brightness(1.12)' }}>
            Apply change
          </Hover>
        </div>
      </div>
    </>
  )
}
