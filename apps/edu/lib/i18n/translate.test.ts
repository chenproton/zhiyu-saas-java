import { describe, it, expect } from 'vitest'
import { translate } from './locale-provider'

describe('translate 中文模式', () => {
  it('中文即 key，原样返回', () => {
    expect(translate('保存', 'zh')).toBe('保存')
  })

  it('中文模式占位符插值', () => {
    expect(translate('共 {n} 个批次分组', 'zh', { n: 5 })).toBe('共 5 个批次分组')
  })

  it('缺失占位符保留原文', () => {
    expect(translate('共 {n} 个批次分组', 'zh', {})).toBe('共 {n} 个批次分组')
  })
})

describe('translate 英文模式', () => {
  it('命中字典返回英文', () => {
    expect(translate('保存', 'en')).toBe('Save')
    expect(translate('权限不足', 'en')).toBe('Insufficient permissions')
  })

  it('英文模式占位符插值', () => {
    expect(translate('共 {n} 个批次分组', 'en', { n: 5 })).toBe('5 batch groups in total')
  })

  it('未命中字典回退中文原文', () => {
    expect(translate('未收录的自定义文案', 'en')).toBe('未收录的自定义文案')
  })

  it('未命中字典且带插值时回退原文并插值', () => {
    expect(translate('未知 {x} 文案', 'en', { x: 1 })).toBe('未知 1 文案')
  })

  it('数字插值转为字符串', () => {
    expect(translate('得分 {totalScore}/{maxScore}', 'en', { totalScore: 88, maxScore: 100 })).toBe(
      'Score 88/100',
    )
  })
})
