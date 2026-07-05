import type { CSSProperties } from 'react'

/** Common field label above inputs. */
export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '13.5px',
  color: 'var(--c-text-label, #8e8e93)',
  margin: '0 0 8px',
}

/** Base text input / select / textarea chrome. Pair with className "dc-input" for the focus ring. */
export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '15px',
  lineHeight: 1.45,
  color: 'var(--c-text, #2c2c34)',
  background: 'var(--c-bg, #fff)',
  border: '1px solid var(--c-border, #e4e4e9)',
  borderRadius: '8px',
  padding: '9px 12px',
  outline: 'none',
  transition: 'border-color .12s, box-shadow .12s',
}

/** Input variant leaving room on the right for a validation check icon. */
export const inputWithCheck: CSSProperties = { ...inputStyle, padding: '9px 40px 9px 12px' }

/** The orange circular "✓" badge shown at the right edge of a valid field. */
export const checkBadge: CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background: 'var(--accent2,#f5871f)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: '12px',
}

export const removeBtn: CSSProperties = {
  fontSize: '13.5px',
  fontWeight: 500,
  color: 'var(--c-remove-text, #5c5c63)',
  background: 'var(--c-bg, #fff)',
  border: '1px solid var(--c-border, #e4e4e9)',
  borderRadius: '7px',
  padding: '8px 16px',
  cursor: 'pointer',
}
export const removeBtnHover: CSSProperties = {
  background: 'var(--c-remove-hover-bg, #fbecec)',
  borderColor: 'var(--c-remove-hover-border, #e8b4b0)',
  color: 'var(--c-remove-hover-text, #c0492f)',
}

export const addBtn: CSSProperties = {
  width: '100%',
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--accent,#5b50e0)',
  background: 'var(--c-accent-tint, #f3f2fc)',
  border: '1px solid var(--c-accent-tint-border, #ddd9f5)',
  borderRadius: '9px',
  padding: '12px',
  cursor: 'pointer',
}
export const addBtnHover: CSSProperties = { background: 'var(--c-accent-tint-hover, #ebe9fb)' }

export const dragHandle: CSSProperties = {
  position: 'absolute',
  top: '34px',
  right: '-40px',
  zIndex: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '34px',
  height: '38px',
  border: '1px solid transparent',
  borderRadius: '7px',
  background: 'transparent',
  cursor: 'grab',
  fontSize: '21px',
  letterSpacing: '-2px',
  color: 'var(--c-text-muted, #b3b1ab)',
  userSelect: 'none',
}
export const dragHandleHover: CSSProperties = {
  background: 'var(--c-accent-tint, #f3f2fc)',
  borderColor: 'var(--c-drag-hover-border, #d8d8df)',
  color: 'var(--accent,#5b50e0)',
}

/** The card wrapper used by every repeatable entry (Experience / Projects / …). */
export const entryCard: CSSProperties = {
  position: 'relative',
  padding: '0 0 20px',
  borderBottom: '1px solid var(--c-border-subtle, #ededed)',
  margin: '0 0 20px',
}

export const sectionHeading: CSSProperties = {
  fontSize: '14px',
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: '#111',
  fontWeight: 700,
  borderBottom: '1px solid #000',
  padding: '0 0 3px',
  margin: '12px 0 5px',
}

/** Small toolbar button (B / I / list / link) above the rich-text textareas. */
export const toolbarBtn: CSSProperties = {
  width: '28px',
  height: '26px',
  border: 'none',
  background: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--c-text-subtle, #5c5c63)',
}
export const toolbarBtnHover: CSSProperties = { background: 'var(--c-toolbar-active, #eceaf6)' }
