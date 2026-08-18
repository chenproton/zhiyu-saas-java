import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clampColumnWidth,
  loadTableWidths,
  saveTableWidths,
} from '@/components/ui/table'

const KEY = 'test.table'

describe('loadTableWidths / saveTableWidths（localStorage 持久化）', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('save 后 load 返回相同宽度', () => {
    saveTableWidths(KEY, { name: 160, code: 96 })
    expect(loadTableWidths(KEY)).toEqual({ name: 160, code: 96 })
  })

  it('未保存时返回空对象', () => {
    expect(loadTableWidths(KEY)).toEqual({})
  })

  it('不同 storageKey 互不干扰', () => {
    saveTableWidths(KEY, { name: 160 })
    expect(loadTableWidths('other.table')).toEqual({})
  })

  it('非法 JSON / 损坏数据安全返回空对象', () => {
    window.localStorage.setItem('zhiyu:table-widths:' + KEY, '{oops')
    expect(loadTableWidths(KEY)).toEqual({})
    window.localStorage.setItem('zhiyu:table-widths:' + KEY, 'null')
    expect(loadTableWidths(KEY)).toEqual({})
  })

  it('load 时将越界值钳制到 [40, 800]', () => {
    window.localStorage.setItem(
      'zhiyu:table-widths:' + KEY,
      JSON.stringify({ name: 10000, code: -5, fine: 120 }),
    )
    expect(loadTableWidths(KEY)).toEqual({ name: 800, code: 40, fine: 120 })
  })

  it('load 时丢弃非数字值', () => {
    window.localStorage.setItem(
      'zhiyu:table-widths:' + KEY,
      JSON.stringify({ name: 'wide', code: null, fine: 120 }),
    )
    expect(loadTableWidths(KEY)).toEqual({ fine: 120 })
  })
})

describe('clampColumnWidth（拖拽钳制）', () => {
  it('在 [minWidth, 800] 范围内原样返回并取整', () => {
    expect(clampColumnWidth(160)).toBe(160)
    expect(clampColumnWidth(160.6)).toBe(161)
  })

  it('低于 minWidth 时钳到 minWidth（默认 48）', () => {
    expect(clampColumnWidth(10)).toBe(48)
    expect(clampColumnWidth(30, 40)).toBe(40)
  })

  it('超过 800 时钳到 800', () => {
    expect(clampColumnWidth(900)).toBe(800)
  })
})
