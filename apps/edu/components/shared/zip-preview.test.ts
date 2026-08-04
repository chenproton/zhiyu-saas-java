import { describe, it, expect } from 'vitest'
import { isZipUrl } from './zip-preview'

describe('isZipUrl', () => {
  it('识别 .zip 结尾的 url（大小写不敏感）', () => {
    expect(isZipUrl('/uploads/a.zip')).toBe(true)
    expect(isZipUrl('/uploads/a.ZIP')).toBe(true)
    expect(isZipUrl('https://example.com/a.zip?x=1')).toBe(false)
  })

  it('非 zip 返回 false', () => {
    expect(isZipUrl('/uploads/a.rar')).toBe(false)
    expect(isZipUrl('/uploads/a.7z')).toBe(false)
    expect(isZipUrl('/uploads/a.pdf')).toBe(false)
    expect(isZipUrl('')).toBe(false)
    expect(isZipUrl(null)).toBe(false)
    expect(isZipUrl(undefined)).toBe(false)
  })
})
