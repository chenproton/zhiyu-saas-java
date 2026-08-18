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
  it('menus 为 null/undefined/非对象时视为无授权，已知菜单路径拒绝（fail-closed）', () => {
    expect(checkMenuPermission(null, '/job/positions')).toBe(false)
    expect(checkMenuPermission(undefined, '/job/positions')).toBe(false)
    expect(checkMenuPermission('x', '/job/positions')).toBe(false)
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

describe('checkMenuPermission 我的服务台', () => {
  it('menus 缺失时我的服务台入口按无授权拒绝（超级管理员由调用方按角色放行）', () => {
    expect(checkMenuPermission(undefined, '/portal/workspace')).toBe(false)
    expect(checkMenuPermission(null, '/portal/workspace')).toBe(false)
  })

  it('已勾选 /portal/workspace 放行', () => {
    expect(checkMenuPermission({ '/portal/workspace': true }, '/portal/workspace')).toBe(true)
  })

  it('未勾选时隐藏入口', () => {
    expect(checkMenuPermission({}, '/portal/workspace')).toBe(false)
    expect(checkMenuPermission({ '/portal/apps/system': true }, '/portal/workspace')).toBe(false)
  })

  it('子路径继承 workspace 授权', () => {
    expect(checkMenuPermission({ '/portal/workspace': true }, '/portal/workspace?tab=profile')).toBe(
      true,
    )
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

describe('checkMenuPermission 教务平台订阅链路', () => {
  it('教务未订阅时拒绝，订阅后按菜单授权判断', () => {
    const menus = { '/affairs/programs': true }
    expect(checkMenuPermission(menus, '/affairs/programs', { affairs: false })).toBe(false)
    expect(checkMenuPermission(menus, '/affairs/programs', { affairs: true })).toBe(true)
    expect(checkMenuPermission({}, '/affairs/programs', { affairs: true })).toBe(false)
  })
})

describe('checkMenuPermission AI 中心单一开关', () => {
  // AI 平台菜单树收敛为单一节点 href=/portal/apps/ai（168 迁移），
  // 前台功能（助手/广场/工坊/落地页及其动态子路径）随该开关一起授权
  const granted = { '/portal/apps/ai': true }

  it('授予单一开关后前台页面全部放行', () => {
    expect(checkMenuPermission(granted, '/portal/apps/ai/chat')).toBe(true)
    expect(checkMenuPermission(granted, '/portal/apps/ai/square')).toBe(true)
    expect(checkMenuPermission(granted, '/portal/apps/ai/studio')).toBe(true)
    expect(checkMenuPermission(granted, '/portal/apps/ai/studio/kb/some-uuid')).toBe(true)
    expect(checkMenuPermission(granted, '/portal/apps/ai/agents/some-uuid')).toBe(true)
    expect(checkMenuPermission(granted, '/portal/apps/ai/landing')).toBe(true)
  })

  it('单一开关不覆盖管理组（管理路径在权限树内，未勾选即拒绝）', () => {
    expect(checkMenuPermission(granted, '/portal/apps/ai/admin/reviews')).toBe(false)
    expect(checkMenuPermission(granted, '/portal/apps/ai/admin/integrations')).toBe(false)
  })

  it('管理组可独立勾选', () => {
    const adminOnly = { '/portal/apps/ai/admin/reviews': true }
    expect(checkMenuPermission(adminOnly, '/portal/apps/ai/admin/reviews')).toBe(true)
    expect(checkMenuPermission(adminOnly, '/portal/apps/ai/chat')).toBe(false)
  })

  it('未授予单一开关时前台页面拒绝', () => {
    expect(checkMenuPermission({}, '/portal/apps/ai/chat')).toBe(false)
    expect(checkMenuPermission({}, '/portal/apps/ai/landing')).toBe(false)
  })

  it('订阅未开通 ai 模块时整体不可见', () => {
    expect(
      checkMenuPermission(granted, '/portal/apps/ai/chat', { ai: false }),
    ).toBe(false)
    expect(
      checkMenuPermission(granted, '/portal/apps/ai/chat', { ai: true }),
    ).toBe(true)
  })
})
