import { describe, it, expect } from 'vitest'
import {
  getHybridMethodLabel,
  hybridMethodCompare,
  parseHybridMethodKey,
} from './hybrid-eval'

describe('hybrid-eval', () => {
  it('parses composite method keys', () => {
    expect(parseHybridMethodKey('preQuiz:quiz')).toEqual({
      moduleKey: 'preQuiz',
      methodKey: 'quiz',
    })
    expect(parseHybridMethodKey('inClassQuiz:question_bank')).toEqual({
      moduleKey: 'inClassQuiz',
      methodKey: 'question_bank',
    })
    expect(parseHybridMethodKey('homework:homework')).toEqual({
      moduleKey: 'homework',
      methodKey: 'homework',
    })
    expect(parseHybridMethodKey('quiz')).toBeNull()
    expect(parseHybridMethodKey('unknown:quiz')).toBeNull()
    expect(parseHybridMethodKey(':quiz')).toBeNull()
  })

  it('builds display labels', () => {
    const fallback = (k: string) => k
    expect(getHybridMethodLabel('preQuiz:quiz', fallback)).toBe('课前测验 · quiz')
    expect(getHybridMethodLabel('inClassQuiz:question_bank', fallback)).toBe(
      '随堂测验 · question_bank',
    )
    expect(getHybridMethodLabel('quiz', fallback)).toBe('quiz')
  })

  it('sorts by module order then method key', () => {
    const keys = ['homework:homework', 'preQuiz:quiz', 'inClassQuiz:quiz', 'quiz']
    const sorted = [...keys].sort(hybridMethodCompare)
    expect(sorted).toEqual(['preQuiz:quiz', 'inClassQuiz:quiz', 'homework:homework', 'quiz'])
  })
})
