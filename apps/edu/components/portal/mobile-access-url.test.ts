import { describe, it, expect } from 'vitest'
import { buildMobileAccessUrl } from './mobile-access-url'

describe('buildMobileAccessUrl', () => {
  it('拼接站点地址、路径与查询参数', () => {
    expect(buildMobileAccessUrl('https://ai.zhiyu.com.cn', '/portal/workspace', '?tab=all')).toBe(
      'https://ai.zhiyu.com.cn/portal/workspace?tab=all',
    )
  })

  it('无查询参数时不拼接', () => {
    expect(buildMobileAccessUrl('https://ai.zhiyu.com.cn', '/portal')).toBe(
      'https://ai.zhiyu.com.cn/portal',
    )
  })

  it('站点地址去除尾部斜杠', () => {
    expect(buildMobileAccessUrl('https://ai.zhiyu.com.cn/', '/portal')).toBe(
      'https://ai.zhiyu.com.cn/portal',
    )
  })

  it('站点地址为空时仅保留路径', () => {
    expect(buildMobileAccessUrl('', '/portal', '?id=1')).toBe('/portal?id=1')
  })
})
