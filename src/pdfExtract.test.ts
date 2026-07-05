import { describe, it, expect } from 'vitest'
import { reconstructLines, detectColumns, type RawItem } from './pdfExtract'

const item = (str: string, x: number, y: number, width: number, extra: Partial<RawItem> = {}): RawItem => ({
  str,
  x,
  y,
  width,
  height: 10,
  fontSize: 10,
  bold: false,
  hasEOL: false,
  ...extra,
})

describe('reconstructLines — spacing', () => {
  it('inserts a space where there is a real horizontal gap', () => {
    const lines = reconstructLines([item('Senior', 0, 100, 30), item('Engineer', 40, 100, 40)])
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('Senior Engineer')
  })

  it('concatenates glyph-split items that touch (no gap)', () => {
    const lines = reconstructLines([item('Se', 0, 100, 12), item('nior', 12, 100, 24)])
    expect(lines[0].text).toBe('Senior')
  })
})

describe('reconstructLines — line grouping', () => {
  it('splits items into lines by y and records the vertical gap', () => {
    const lines = reconstructLines([item('First line', 0, 100, 60), item('Second line', 0, 80, 66)])
    expect(lines.map((l) => l.text)).toEqual(['First line', 'Second line'])
    expect(lines[0].gapBefore).toBe(0)
    expect(lines[1].gapBefore).toBe(20)
  })

  it('marks a line bold when the majority of its items are bold', () => {
    const lines = reconstructLines([item('ACME CORP', 0, 100, 60, { bold: true })])
    expect(lines[0].bold).toBe(true)
    expect(lines[0].fontSize).toBe(10)
  })
})

describe('detectColumns', () => {
  const rows = (x: number, w: number) =>
    Array.from({ length: 10 }, (_, i) => item('text', x, 700 - i * 50, w))

  it('returns a single column when text is not split by a gutter', () => {
    const cols = detectColumns(rows(10, 60), 612, 792)
    expect(cols).toHaveLength(1)
  })

  it('splits a two-column layout into left-then-right, ordered', () => {
    const left = rows(10, 60) // x-extent [10,70]
    const right = rows(320, 60) // x-extent [320,380], gutter ~[70,320]
    const cols = detectColumns([...right, ...left], 612, 792) // pass unordered
    expect(cols).toHaveLength(2)
    expect(cols[0].every((i) => i.x === 10)).toBe(true) // left column first
    expect(cols[1].every((i) => i.x === 320)).toBe(true)
  })
})
