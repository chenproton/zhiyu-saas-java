import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from './format-utils'

describe('formatDate', () => {
  it('格式化 Date 为 YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 7, 2))).toBe('2026-08-02')
  })

  it('空值与非法值返回 fallback', () => {
    expect(formatDate(undefined)).toBe('-')
    expect(formatDate(null)).toBe('-')
    expect(formatDate('not-a-date')).toBe('-')
    expect(formatDate('', '无')).toBe('无')
  })
})

describe('formatDateTime', () => {
  it('格式化时间为 YYYY/MM/DD HH:mm', () => {
    const d = new Date(2026, 7, 2, 9, 30)
    expect(formatDateTime(d)).toContain('2026/08/02')
    expect(formatDateTime(d)).toContain('09:30')
  })

  it('空值返回 fallback', () => {
    expect(formatDateTime(undefined)).toBe('-')
  })
})
