import { describe, it, expect } from 'vitest'
import { splitWeightEvenly } from './weight-distribute'

describe('splitWeightEvenly', () => {
  it('整数均分：100 分 4 项 → 25/25/25/25，合计 100', () => {
    const w = splitWeightEvenly(100, 4)
    expect(w).toEqual([25, 25, 25, 25])
    expect(w.reduce((s, v) => s + v, 0)).toBe(100)
  })

  it('余数按顺序 +0.01：100 分 3 项 → 33.34/33.33/33.33，合计 100', () => {
    const w = splitWeightEvenly(100, 3)
    expect(w).toEqual([33.34, 33.33, 33.33])
    expect(Math.round(w.reduce((s, v) => s + v, 0) * 100) / 100).toBe(100)
  })

  it('小数剩余（锁定 33.34 后剩 66.66）分 2 项 → 33.33/33.33，合计 66.66', () => {
    const w = splitWeightEvenly(66.66, 2)
    expect(w).toEqual([33.33, 33.33])
    expect(Math.round(w.reduce((s, v) => s + v, 0) * 100) / 100).toBe(66.66)
  })

  it('小数剩余（锁定 12.50 后剩 87.50）分 7 项 → 12.50×7，合计 87.50', () => {
    const w = splitWeightEvenly(87.5, 7)
    expect(w).toEqual([12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5])
    expect(w.reduce((s, v) => s + v, 0)).toBe(87.5)
  })

  it('0 项返回空数组', () => {
    expect(splitWeightEvenly(100, 0)).toEqual([])
  })
})
