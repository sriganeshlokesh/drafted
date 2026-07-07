import { useRef, useState, type DragEvent } from 'react'
import { Hover } from './Hover'

interface Props {
  open: boolean
  importing: boolean
  error: string | null
  onFile: (file: File) => void
  onClose: () => void
}

const ACCEPT = '.pdf,.txt,.tex,.md,.markdown'

/** Upload glyph — arrow rising out of a tray. Inherits color via `currentColor`. */
export function UploadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path d="M12 16V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

/**
 * "Import your résumé" modal — a dropzone that hands the chosen file to `onFile`.
 * Presentational: parsing, validation, and applying to the form live in the parent
 * (`ResumeBuilder.runImport`). Mirrors the Reset dialog's overlay + centered card.
 */
export function ImportModal({ open, importing, error, onFile, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  if (!open) return null

  const pick = (file: File | null | undefined) => {
    if (file) onFile(file)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (!importing) pick(e.dataTransfer.files?.[0])
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 540, background: 'var(--c-bg-elevated, #fff)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,.22)', zIndex: 41 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
          <span style={{ flex: 'none', width: '40px', height: '40px', borderRadius: '10px', background: 'var(--c-import-bg, #efedfb)', color: 'var(--accent,#213885)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UploadIcon size={18} /></span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: 700, color: 'var(--c-text, #1a1a1a)' }}>Import your résumé</p>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text-muted, #9b9a97)' }}>Upload a file and it fills the form for you</p>
          </div>
          <Hover as="button" onClick={onClose} aria-label="Close" style={{ flex: 'none', background: 'none', border: 'none', color: 'var(--c-text-muted, #9b9a97)', fontSize: '20px', lineHeight: 1, cursor: 'pointer', padding: '2px 4px' }} hoverStyle={{ color: 'var(--c-text-subtle, #555)' }}>
            ×
          </Hover>
        </div>

        {/* Dropzone */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = '' // allow re-selecting the same file
          }}
        />
        <div
          onClick={() => !importing && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!importing) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent,#213885)' : 'var(--c-border, #d9d8de)'}`,
            borderRadius: '14px',
            background: dragOver ? 'var(--c-accent-tint, #f6f5fe)' : 'var(--c-bg-subtle, #fafafa)',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: importing ? 'default' : 'pointer',
            transition: 'border-color .15s, background .15s',
          }}
        >
          {importing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '26px', height: '26px', border: '3px solid var(--c-overlay-spinner-track, #e0def4)', borderTopColor: 'var(--accent,#213885)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-text-dim, #37352f)' }}>Reading your résumé…</span>
            </div>
          ) : (
            <>
              <span style={{ display: 'inline-flex', width: '46px', height: '46px', borderRadius: '12px', background: 'var(--c-import-bg, #efedfb)', color: 'var(--accent,#213885)', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}><UploadIcon size={22} /></span>
              <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--c-text, #1a1a1a)' }}>Drop your résumé here, or click to browse</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-text-muted, #9b9a97)' }}>PDF or plain-text file (.pdf, .txt, .tex, .md)</p>
            </>
          )}
        </div>

        {error && <p style={{ margin: '12px 2px 0', fontSize: '13px', color: '#c0392b' }}>{error}</p>}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--c-text-muted, #9b9a97)' }}>This replaces the current form contents.</span>
          <Hover as="button" onClick={onClose} style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--c-text-subtle, #555)', background: 'var(--c-reset-bg, #f0eff2)', border: '1px solid var(--c-border-subtle, #e2e1e6)', borderRadius: '8px', cursor: 'pointer' }} hoverStyle={{ background: 'var(--c-reset-hover-bg, #e5e4e8)' }}>
            Cancel
          </Hover>
        </div>
      </div>
    </>
  )
}
