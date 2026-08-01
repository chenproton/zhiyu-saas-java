import { describe, it, expect } from 'vitest'
import { buildQuery } from './api-helpers'

describe('buildQuery', () => {
  it('拼接查询参数', () => {
    expect(buildQuery({ limit: 100, status: 'approved', page: 2 })).toBe(
      '?limit=100&status=approved&page=2',
    )
  })

  it('忽略 undefined 与空字符串', () => {
    expect(buildQuery({ a: undefined, b: '', c: 0, d: false })).toBe('?c=0&d=false')
  })

  it('空参数返回空字符串', () => {
    expect(buildQuery({})).toBe('')
  })
})
