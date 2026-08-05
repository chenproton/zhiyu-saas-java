import { describe, it, expect } from 'vitest'
import { normalizeMenuPath, checkMenuPermission } from './menu-permissions'

describe('normalizeMenuPath', () => {
  it('去除 query/hash 与尾部斜杠', () => {
    expect(normalizeMenuPath('/job/positions?tab=all')).toBe('/job/positions')
    expect(normalizeMenuPath('/job/positions#top')).toBe('/job/positions')
    expect(normalizeMenuPath('/job/positions/')).toBe('/job/positions')
    expect(normalizeMenuPath('/')).toBe('/')
  })

  it('空值原样返回', () => {
    expect(normalizeMenuPath('')).toBe('')
    expect(normalizeMenuPath(undefined as unknown as string)).toBeUndefined()
  })
})

describe('checkMenuPermission 无订阅信息时', () => {
  it('menus 为 null/undefined/非对象时放行', () => {
    expect(checkMenuPermission(null, '/job/positions')).toBe(true)
    expect(checkMenuPermission(undefined, '/job/positions')).toBe(true)
    expect(checkMenuPermission('x', '/job/positions')).toBe(true)
  })

  it('menus 为空数组视为无授权，已知菜单路径拒绝', () => {
    expect(checkMenuPermission([], '/job/positions')).toBe(false)
  })

  it('显式授权路径放行', () => {
    const menus = { '/job/positions': true }
    expect(checkMenuPermission(menus, '/job/positions')).toBe(true)
  })

  it('已知菜单路径未授权则拒绝（含其动态详情子路径，详情页需列表权限）', () => {
    expect(checkMenuPermission({}, '/job/positions')).toBe(false)
    expect(checkMenuPermission({}, '/job/positions/123/edit')).toBe(false)
  })

  it('已知菜单未授权时向上回退在第一个已知路径处停止，不越级放行', () => {
    expect(checkMenuPermission({ '/job': true }, '/job/positions/123/edit')).toBe(false)
  })

  it('未知中间段路径向上回退到已授权的已知菜单则放行', () => {
    expect(checkMenuPermission({ '/job': true }, '/job/anything/deep')).toBe(true)
  })

  it('完全未知路径（非菜单内页面）按兜底放行', () => {
    expect(checkMenuPermission({}, '/some/unknown/route/123')).toBe(true)
  })
})

describe('checkMenuPermission 订阅模块开关', () => {
  it('模块未订阅时拒绝', () => {
    const menus = { '/job': true }
    expect(checkMenuPermission(menus, '/job/positions', { career: false })).toBe(false)
  })

  it('模块已订阅时按菜单授权判断', () => {
    const menus = { '/job/positions': true }
    expect(checkMenuPermission(menus, '/job/positions', { career: true })).toBe(true)
    expect(checkMenuPermission({}, '/job/positions', { career: true })).toBe(false)
  })

  it('非平台路径不受订阅开关影响', () => {
    expect(checkMenuPermission({}, '/some/unknown', { career: false })).toBe(true)
  })
})
