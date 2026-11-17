import { describe, expect, it } from 'vitest'
import { QUANTITY_ERRORS, formatAmount, formatQuantity, parseQuantity } from './quantity.ts'

describe('parseQuantity', () => {
  it('treats an empty field as no amount', () => {
    expect(parseQuantity('')).toEqual({ ok: true, quantity: null })
    expect(parseQuantity('   ')).toEqual({ ok: true, quantity: null })
  })

  it.each([
    ['2', 2],
    [' 2 ', 2],
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['.5', 0.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['1  1/2', 1.5],
    ['½', 0.5],
    ['1½', 1.5],
    ['1 ½', 1.5],
    ['1⁄4', 0.25],
    ['1/3', 0.333333],
    ['250', 250],
  ])('parses %j as a single amount of %d', (text, value) => {
    expect(parseQuantity(text)).toEqual({ ok: true, quantity: { type: 'single', value } })
  })

  it.each([
    ['1-2', 1, 2],
    ['1 - 2', 1, 2],
    ['1–2', 1, 2],
    ['1—2', 1, 2],
    ['1 to 2', 1, 2],
    ['1 TO 2', 1, 2],
    ['1/2-1', 0.5, 1],
    ['1 1/2-2', 1.5, 2],
    ['1½–2½', 1.5, 2.5],
  ])('parses %j as a range from %d to %d', (text, min, max) => {
    expect(parseQuantity(text)).toEqual({ ok: true, quantity: { type: 'range', min, max } })
  })

  it('collapses a range whose ends are equal into a single amount', () => {
    expect(parseQuantity('2-2')).toEqual({ ok: true, quantity: { type: 'single', value: 2 } })
  })

  it('rejects a range whose max is below its min', () => {
    expect(parseQuantity('3-2')).toEqual({ ok: false, error: QUANTITY_ERRORS.maxBelowMin })
    expect(parseQuantity('1 1/2 to 1')).toEqual({ ok: false, error: QUANTITY_ERRORS.maxBelowMin })
  })

  it.each(['abc', '2 cups', '1/0', '1 1/0', '-1', '1-', '-', '1-2-3', '1..5', '1/2/3'])(
    'rejects %j as invalid',
    (text) => {
      expect(parseQuantity(text)).toEqual({ ok: false, error: QUANTITY_ERRORS.invalid })
    },
  )

  it('rejects zero and absurdly large amounts', () => {
    expect(parseQuantity('0')).toEqual({ ok: false, error: QUANTITY_ERRORS.notPositive })
    expect(parseQuantity('0-2')).toEqual({ ok: false, error: QUANTITY_ERRORS.notPositive })
    expect(parseQuantity('2000000')).toEqual({ ok: false, error: QUANTITY_ERRORS.tooLarge })
  })
})

describe('formatAmount', () => {
  it.each([
    [2, '2'],
    [0.5, '1/2'],
    [1.5, '1 1/2'],
    [0.25, '1/4'],
    [2.75, '2 3/4'],
    [1 / 3, '1/3'],
    [0.333333, '1/3'],
    [2 / 3, '2/3'],
    [0.125, '1/8'],
    [0.375, '3/8'],
    [1.999, '2'],
    [0.15, '0.15'],
    [1.2, '1.2'],
    [0.05, '0.05'],
    [250, '250'],
  ])('formats %d as %j', (value, text) => {
    expect(formatAmount(value)).toBe(text)
  })
})

describe('formatQuantity', () => {
  it('formats no amount, a single amount and a range', () => {
    expect(formatQuantity(null)).toBe('')
    expect(formatQuantity({ type: 'single', value: 1.5 })).toBe('1 1/2')
    expect(formatQuantity({ type: 'range', min: 0.5, max: 1 })).toBe('1/2–1')
  })

  it.each(['2', '1 1/2', '1/3', '1–2', '1 1/2–2', '0.15'])('round-trips %j', (text) => {
    const parsed = parseQuantity(text)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(formatQuantity(parsed.quantity)).toBe(text)
  })

  it('normalizes typed variants to one canonical form', () => {
    const canonical = (text: string) => {
      const parsed = parseQuantity(text)
      return parsed.ok ? formatQuantity(parsed.quantity) : parsed.error
    }
    expect(canonical('1.5')).toBe('1 1/2')
    expect(canonical('1½ to 2')).toBe('1 1/2–2')
    expect(canonical('0.25')).toBe('1/4')
  })
})
