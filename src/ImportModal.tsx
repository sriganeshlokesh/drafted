import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Hover } from './Hover'

interface Props {
  open: boolean
  importing: boolean
  error: string | null
  darkMode?: boolean
  hasContent?: boolean
  onFile: (file: File) => void
  onClose: () => void
}

const ACCEPT = '.pdf,.txt,.tex,.md,.markdown'

/** Sections the importer populates — shown as reassurance chips. */
const FILLS = ['Personal Information', 'Experience', 'Education', 'Projects', 'Skills']

/** Upload glyph — arrow rising out of a tray. Inherits color via `currentColor`. */
export function UploadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M12 16V4" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

const stroke = (size: number, path: ReactNode, w = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>{path}</svg>
)
const FileGlyph = ({ size = 20 }: { size?: number }) => stroke(size, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h4" /></>)
const CloseGlyph = ({ size = 19 }: { size?: number }) => stroke(size, <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>)
const CheckCircle = ({ size = 15 }: { size?: number }) => stroke(size, <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.4l2.3 2.3 4.7-5" /></>)
const LockGlyph = ({ size = 14 }: { size?: number }) => stroke(size, <><rect x="4.5" y="10.5" width="15" height="9.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>)
const InfoGlyph = ({ size = 15 }: { size?: number }) => stroke(size, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.6h.01" /></>)

/**
 * "Import your résumé" modal — a dropzone that hands the chosen file to `onFile`.
 * Presentational: parsing, validation, and applying to the form live in the parent
 * (`ResumeBuilder.runImport`).
 */
export function ImportModal({ open, importing, error, darkMode, hasContent, onFile, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  if (!open) return null

  const pick = (file: File | null | undefined) => {
    if (file) onFile(file)
  }
  const browse = () => {
    if (!importing) inputRef.current?.click()
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (!importing) pick(e.dataTransfer.files?.[0])
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)', zIndex: 40 }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'calc(100% - 32px)', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto', background: 'var(--c-bg-elevated, #fff)', border: '1px solid var(--c-border-subtle, #e6e6ea)', borderRadius: '18px', padding: '26px 30px 22px', boxShadow: '0 24px 70px rgba(0,0,0,.28)', zIndex: 41 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
          <span style={{ flex: 'none', width: '44px', height: '44px', borderRadius: '12px', background: 'var(--c-accent-tint, #efeaf3)', color: 'var(--accent, #213885)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileGlyph size={21} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '2px 0 3px', fontSize: '19px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--c-text, #1a1a2e)' }}>Import your résumé</p>
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.4, color: 'var(--c-text-muted, #6f6d78)' }}>Upload your résumé and we'll automatically fill the application for you.</p>
          </div>
          <Hover as="button" onClick={onClose} aria-label="Close" style={{ flex: 'none', display: 'inline-flex', background: 'none', border: 'none', color: 'var(--c-text-muted, #9b9a97)', cursor: 'pointer', padding: '3px', borderRadius: '7px' }} hoverStyle={{ color: 'var(--c-text, #1a1a2e)', background: 'var(--c-bg-subtle, #f4f4f6)' }}>
            <CloseGlyph />
          </Hover>
        </div>

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

        {/* Dropzone */}
        <div
          onClick={browse}
          onDragOver={(e) => { e.preventDefault(); if (!importing) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent, #213885)' : 'var(--c-accent-tint-border, #d9cbe4)'}`,
            borderRadius: '16px',
            background: dragOver ? 'var(--c-accent-tint-hover, #e7def0)' : 'var(--c-accent-tint, #efeaf3)',
            padding: '30px 24px 34px',
            textAlign: 'center',
            cursor: importing ? 'default' : 'pointer',
            transition: 'border-color .15s, background .15s',
          }}
        >
          {importing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '30px 0' }}>
              <span style={{ width: '30px', height: '30px', border: '3px solid var(--c-overlay-spinner-track, #d6d6dc)', borderTopColor: 'var(--accent, #213885)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--c-text-dim, #101a3d)' }}>Reading your résumé…</span>
            </div>
          ) : (
            <>
              <img src={darkMode ? '/upload-doc-dark.png' : '/upload-doc-light.png'} alt="" width={224} style={{ display: 'block', margin: '0 auto 6px' }} />
              <p style={{ margin: '0 0 5px', fontSize: '20px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--c-text, #1a1a2e)' }}>Drop your file here</p>
              <p style={{ margin: '0 0 12px', fontSize: '14.5px', color: 'var(--c-text-muted, #6f6d78)' }}>
                or{' '}
                <span onClick={(e) => { e.stopPropagation(); browse() }} style={{ color: 'var(--accent, #213885)', fontWeight: 700, cursor: 'pointer' }}>upload from your device</span>
              </p>
              <p style={{ margin: 0, fontSize: '12.5px', letterSpacing: '.02em', color: 'var(--c-text-muted, #6f6d78)' }}>PDF &middot; TXT &middot; TEX &middot; MD &middot; under 10 MB</p>
            </>
          )}
        </div>

        {error && <p style={{ margin: '12px 2px 0', fontSize: '13px', color: 'var(--c-remove-hover-text, #c0392b)' }}>{error}</p>}

        {/* Auto-fill chips */}
        <p style={{ margin: '20px 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--c-text, #1a1a2e)' }}>We'll automatically fill</p>
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {FILLS.map((label) => (
            <span key={label} style={{ flex: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 11px 7px 9px', fontSize: '13px', fontWeight: 500, color: 'var(--c-text, #1a1a2e)', background: 'var(--c-bg-subtle, #f4f4f6)', border: '1px solid var(--c-border-subtle, #e6e6ea)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--accent, #213885)', display: 'inline-flex' }}><CheckCircle /></span>
              {label}
            </span>
          ))}
        </div>

        <div style={{ height: '1px', background: 'var(--c-border-subtle, #e6e6ea)', margin: '18px 0 14px' }} />

        {/* Security note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: 'var(--c-text-muted, #6f6d78)' }}>
          <span style={{ color: 'var(--accent, #213885)', display: 'inline-flex' }}><LockGlyph /></span>
          Your file is secure and will only be used for this application.
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginTop: '18px', flexWrap: 'wrap' }}>
          {hasContent ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, color: 'var(--accent2, #893172)', background: 'rgba(137,49,114,.10)', padding: '7px 12px', borderRadius: '8px' }}>
              <span style={{ display: 'inline-flex' }}><InfoGlyph /></span>
              This will replace your current information.
            </span>
          ) : <span />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
            <Hover as="button" onClick={onClose} style={{ padding: '10px 20px', fontSize: '13.5px', fontWeight: 600, color: 'var(--c-text, #1a1a2e)', background: 'var(--c-bg, #fff)', border: '1px solid var(--c-border, #d7d7db)', borderRadius: '9px', cursor: 'pointer' }} hoverStyle={{ background: 'var(--c-bg-subtle, #f4f4f6)' }}>
              Cancel
            </Hover>
            <Hover as="button" onClick={browse} disabled={importing} style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 600, color: '#fff', background: 'var(--accent, #213885)', border: 'none', borderRadius: '9px', cursor: importing ? 'default' : 'pointer' }} hoverStyle={{ filter: 'brightness(1.12)' }}>
              <UploadIcon size={16} /> Import
            </Hover>
          </div>
        </div>
      </div>
    </>
  )
}
