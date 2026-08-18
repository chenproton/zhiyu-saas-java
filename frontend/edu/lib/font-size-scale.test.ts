import { describe, it, expect } from 'vitest'
import { clampFontScaleLevel, fontScaleForLevel, MAX_FONT_SCALE_LEVEL } from './font-size-scale'

describe('clampFontScaleLevel', () => {
  it('默认字号为 0', () => {
    expect(clampFontScaleLevel(0)).toBe(0)
  })

  it('超上限截断到最大档位', () => {
    expect(clampFontScaleLevel(MAX_FONT_SCALE_LEVEL + 1)).toBe(MAX_FONT_SCALE_LEVEL)
    expect(clampFontScaleLevel(99)).toBe(MAX_FONT_SCALE_LEVEL)
  })

  it('负数与非法值归零', () => {
    expect(clampFontScaleLevel(-1)).toBe(0)
    expect(clampFontScaleLevel(Number.NaN)).toBe(0)
    expect(clampFontScaleLevel(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('小数四舍五入', () => {
    expect(clampFontScaleLevel(2.4)).toBe(2)
    expect(clampFontScaleLevel(2.6)).toBe(3)
  })
})

describe('fontScaleForLevel', () => {
  it('0 号字号为 1（默认）', () => {
    expect(fontScaleForLevel(0)).toBe(1)
  })

  it('每号递增 6.25%', () => {
    expect(fontScaleForLevel(1)).toBeCloseTo(1.0625)
    expect(fontScaleForLevel(2)).toBeCloseTo(1.0625 ** 2)
    expect(fontScaleForLevel(MAX_FONT_SCALE_LEVEL)).toBeCloseTo(1.0625 ** MAX_FONT_SCALE_LEVEL)
  })
})
