import { useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react'
import { Hover } from './Hover'
import type { Education, Experience, Project, SkillGroup } from './types'
import { RichTextEditor } from './RichTextEditor'
import {
  dragHandle,
  dragHandleHover,
  entryCard,
  inputStyle,
  labelStyle,
  removeBtn,
  removeBtnHover,
} from './styles'

export interface DragBundle {
  cardProps: {
    'data-drag-card': string
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
  handleProps: {
    draggable: boolean
    onDragStart: (e: DragEvent) => void
    onDragEnd: (e: DragEvent) => void
  }
  isOver: boolean
}

const insertionLine: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '-4px',
  height: '3px',
  borderRadius: '2px',
  background: 'var(--accent,#5b50e0)',
}

function DragHandle({ handleProps, anchor }: { handleProps: DragBundle['handleProps']; anchor?: string }) {
  return (
    <Hover
      {...handleProps}
      title="Drag to reorder"
      data-comment-anchor={anchor}
      style={dragHandle}
      hoverStyle={dragHandleHover}
    >
      ⠿
    </Hover>
  )
}

/* ── Shared date-range picker (month + year only) ───────────────────────── */

function DateRange({
  start, end, present, onStart, onEnd, onPresent,
}: {
  start: string
  end: string
  present?: boolean
  onStart: (v: string) => void
  onEnd: (v: string) => void
  onPresent?: (v: boolean) => void
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px', margin: '0 0 10px' }}>
        <div>
          <label style={labelStyle}>Start</label>
          <input
            className="dc-input"
            type="date"
            value={start}
            onChange={e => onStart(e.target.value)}
            style={{ ...inputStyle, fontSize: '14.5px' }}
          />
        </div>
        <div>
          <label style={labelStyle}>End</label>
          <input
            className="dc-input"
            type="date"
            value={end}
            onChange={e => onEnd(e.target.value)}
            disabled={present}
            style={{ ...inputStyle, fontSize: '14.5px', background: present ? '#f3f3f5' : '#fff' }}
          />
        </div>
      </div>
      {onPresent !== undefined && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '9px', margin: '0 0 14px', cursor: 'pointer', fontSize: '14px', color: '#3c3c44' }}>
          <input
            type="checkbox"
            checked={!!present}
            onChange={e => onPresent(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--accent,#5b50e0)', cursor: 'pointer' }}
          />{' '}
          I presently work here
        </label>
      )}
    </>
  )
}

/* ── Experience ─────────────────────────────────────────────────────────── */

export function ExperienceCard({
  item,
  update,
  remove,
  drag,
}: {
  item: Experience
  update: <K extends keyof Experience>(field: K, value: Experience[K]) => void
  remove: () => void
  drag: DragBundle
}) {
  return (
    <div {...drag.cardProps} style={entryCard}>
      {drag.isOver && <div style={insertionLine} />}
      <DragHandle handleProps={drag.handleProps} />
      <div style={{ margin: '0 0 14px' }}>
        <label style={labelStyle}>Company</label>
        <input
          className="dc-input"
          value={item.company}
          onChange={(e) => update('company', e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ margin: '0 0 14px' }}>
        <label style={labelStyle}>Title</label>
        <input
          className="dc-input"
          value={item.role}
          onChange={(e) => update('role', e.target.value)}
          style={{ ...inputStyle, fontWeight: 600 }}
        />
      </div>
      <div style={{ margin: '0 0 12px' }}>
        <label style={labelStyle}>Employment</label>
        <div style={{ position: 'relative' }}>
          <select
            className="dc-input"
            value={item.employment}
            onChange={(e) => update('employment', e.target.value)}
            style={{
              ...inputStyle,
              padding: '11px 36px 11px 14px',
              appearance: 'none',
              WebkitAppearance: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
            <option value="Freelance">Freelance</option>
          </select>
          <span
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#9b9a97',
              fontSize: '11px',
            }}
          >
            ▾
          </span>
        </div>
      </div>
      <DateRange
        start={item.start}
        end={item.end}
        present={item.present}
        onStart={v => update('start', v)}
        onEnd={v => update('end', v)}
        onPresent={v => update('present', v)}
      />
      <div style={{ margin: '0 0 12px' }}>
        <label style={labelStyle}>Description</label>
        <RichTextEditor value={item.bulletsText} onChange={v => update('bulletsText', v)} />
      </div>
      <Hover as="button" onClick={remove} style={removeBtn} hoverStyle={removeBtnHover}>
        Remove
      </Hover>
    </div>
  )
}

/* ── Projects ───────────────────────────────────────────────────────────── */

export function ProjectCard({
  item,
  update,
  remove,
  drag,
}: {
  item: Project
  update: <K extends keyof Project>(field: K, value: Project[K]) => void
  remove: () => void
  drag: DragBundle
}) {
  return (
    <div {...drag.cardProps} style={entryCard}>
      {drag.isOver && <div style={insertionLine} />}
      <DragHandle handleProps={drag.handleProps} />
      <div style={{ margin: '0 0 14px' }}>
        <label style={labelStyle}>Project name</label>
        <input
          className="dc-input"
          value={item.name}
          onChange={(e) => update('name', e.target.value)}
          style={{ ...inputStyle, fontWeight: 600 }}
        />
      </div>
      <div style={{ margin: '0 0 14px' }}>
        <label style={labelStyle}>Link</label>
        <input
          className="dc-input"
          value={item.link}
          onChange={(e) => update('link', e.target.value)}
          style={{ ...inputStyle, fontSize: '14px', fontFamily: "'IBM Plex Mono',ui-monospace,monospace" }}
        />
      </div>
      <div style={{ margin: '0 0 12px' }}>
        <label style={labelStyle}>Description</label>
        <RichTextEditor value={item.description} onChange={v => update('description', v)} />
      </div>
      <Hover as="button" onClick={remove} style={removeBtn} hoverStyle={removeBtnHover}>
        Remove
      </Hover>
    </div>
  )
}

/* ── Education ──────────────────────────────────────────────────────────── */

const DETAIL_OPTIONS = ['GPA', 'Honours / Awards', 'Concentration', 'Relevant Coursework', 'Thesis', 'Minor', 'Activities']

export function EducationCard({
  item,
  update,
  remove,
  drag,
}: {
  item: Education
  update: <K extends keyof Education>(field: K, value: Education[K]) => void
  remove: () => void
  drag: DragBundle
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const addDetail = (label: string) => {
    update('extraDetails', [...item.extraDetails, { label, value: '' }])
    setMenuOpen(false)
  }
  const removeDetail = (i: number) => {
    const next = item.extraDetails.slice()
    next.splice(i, 1)
    update('extraDetails', next)
  }
  const updateDetail = (i: number, value: string) => {
    const next = item.extraDetails.slice()
    next[i] = { ...next[i], value }
    update('extraDetails', next)
  }

  const usedLabels = new Set(item.extraDetails.map(d => d.label))
  const availableOptions = DETAIL_OPTIONS.filter(o => !usedLabels.has(o))


  const detailRow = (label: string, value: string, placeholder: string, onValue: (v: string) => void, onRemove?: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 12px' }}>
      <span style={{ width: '140px', flex: 'none', fontSize: '13.5px', color: '#6b6a65' }}>{label}</span>
      <input
        className="dc-input"
        value={value}
        onChange={e => onValue(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, flex: 1, fontSize: '14px' }}
      />
      {onRemove && (
        <Hover
          as="button"
          onClick={onRemove}
          style={{ flex: 'none', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e4e4e9', borderRadius: '7px', background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#b3b1ab' }}
          hoverStyle={{ background: '#fbecec', borderColor: '#e8b4b0', color: '#c0492f' }}
        >×</Hover>
      )}
    </div>
  )

  return (
    <div {...drag.cardProps} style={entryCard}>
      {drag.isOver && <div style={insertionLine} />}
      <DragHandle handleProps={drag.handleProps} />
      <div style={{ margin: '0 0 14px' }}>
        <label style={labelStyle}>School</label>
        <input className="dc-input" value={item.school} onChange={e => update('school', e.target.value)} style={inputStyle} />
      </div>
      <div style={{ margin: '0 0 14px' }}>
        <label style={labelStyle}>Degree</label>
        <input className="dc-input" value={item.degree} onChange={e => update('degree', e.target.value)} placeholder="Master of Science, Computer Science" style={{ ...inputStyle, fontWeight: 600 }} />
      </div>
      <DateRange start={item.start} end={item.end} onStart={v => update('start', v)} onEnd={v => update('end', v)} />
      {item.extraDetails.length > 0 && (
        <div style={{ margin: '0 0 6px' }}>
          {item.extraDetails.map((d, i) => detailRow(d.label, d.value, 'Add detail…', v => updateDetail(i, v), () => removeDetail(i)))}
        </div>
      )}
      {availableOptions.length > 0 && (
        <div style={{ position: 'relative', margin: '0 0 20px' }}>
          <Hover
            as="button"
            onClick={() => setMenuOpen(o => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--accent,#5b50e0)', background: '#f3f2fc', border: '1px solid #ddd9f5', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer' }}
            hoverStyle={{ background: '#ebe9fb' }}
          >+ Add detail <span style={{ fontSize: '10px' }}>▼</span></Hover>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 18 }} />
              <div style={{ position: 'absolute', top: '38px', left: 0, minWidth: '200px', background: '#fff', border: '1px solid #e6e5e1', borderRadius: '10px', boxShadow: '0 8px 28px rgba(0,0,0,.13)', padding: '5px', zIndex: 20 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', color: '#9b9a97', padding: '7px 9px 5px' }}>ADD A DETAIL</div>
                {availableOptions.map(opt => (
                  <Hover key={opt} onClick={() => addDetail(opt)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '13.5px', color: '#2c2c34', background: 'transparent', border: 'none', borderRadius: '7px', padding: '8px 9px', cursor: 'pointer' }} hoverStyle={{ background: '#f3f2fc' }}>
                    {opt}
                  </Hover>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <Hover as="button" onClick={remove} style={removeBtn} hoverStyle={removeBtnHover}>Remove</Hover>
    </div>
  )
}

/* ── Skills (tag/pill input) ────────────────────────────────────────────── */

export function SkillCard({
  item,
  update,
  remove,
  drag,
  onCommit,
  onRemoveTag,
  onBackspace,
}: {
  item: SkillGroup
  update: <K extends keyof SkillGroup>(field: K, value: SkillGroup[K]) => void
  remove: () => void
  drag: DragBundle
  onCommit: () => void
  onRemoveTag: (j: number) => void
  onBackspace: () => void
}) {
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      onCommit()
    } else if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value) {
      onBackspace()
    }
  }
  return (
    <div {...drag.cardProps} style={{ ...entryCard, padding: '0 0 16px', margin: '0 0 16px' }}>
      {drag.isOver && <div style={insertionLine} />}
      <DragHandle handleProps={drag.handleProps} />
      <div style={{ margin: '0 0 12px' }}>
        <label style={labelStyle}>Category</label>
        <input
          className="dc-input"
          value={item.label}
          onChange={(e) => update('label', e.target.value)}
          placeholder="Programming Languages"
          style={{ ...inputStyle, fontWeight: 600 }}
        />
      </div>
      <div style={{ margin: '0 0 12px' }}>
        <label style={labelStyle}>Items · type and press Enter</label>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '7px',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box',
            background: '#fff',
            border: '1px solid #e4e4e9',
            borderRadius: '8px',
            padding: '8px 10px',
            minHeight: '44px',
          }}
        >
          {item.items.map((t, j) => (
            <span
              key={j}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f3f2fc',
                color: '#4b41c9',
                border: '1px solid #ddd9f5',
                borderRadius: '6px',
                padding: '4px 5px 4px 9px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {t}
              <Hover
                as="span"
                onClick={() => onRemoveTag(j)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#9b93e6',
                  fontSize: '13px',
                }}
                hoverStyle={{ background: '#e3dffa', color: '#4b41c9' }}
              >
                ×
              </Hover>
            </span>
          ))}
          <input
            value={item.draft}
            onChange={(e) => update('draft', e.target.value)}
            onKeyDown={onKey}
            placeholder="Add a skill…"
            style={{
              flex: 1,
              minWidth: '120px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '14px',
              color: '#2c2c34',
              padding: '3px 2px',
            }}
          />
        </div>
      </div>
      <Hover as="button" onClick={remove} style={removeBtn} hoverStyle={removeBtnHover}>
        Remove
      </Hover>
    </div>
  )
}
