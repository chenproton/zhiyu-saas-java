import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn (className utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles undefined values', () => {
    expect(cn('base', undefined, 'extra')).toBe('base extra')
  })

  it('handles tailwind conflicts', () => {
    const result = cn('px-4', 'px-2')
    expect(result).toContain('px-2')
    expect(result).not.toContain('px-4')
  })
})
