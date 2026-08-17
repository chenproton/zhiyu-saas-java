import { describe, expect, it } from 'vitest'
import { aiNavigationConfig, platformModuleDefs } from './navigation-config'

describe('AI 平台导航（v2.8 对话全弹窗化）', () => {
  it('侧边栏不再包含「YI Know 助手」导航项（仅保留「AI 广场管理」管理组）', () => {
    const labels = aiNavigationConfig.sideNavItems.map((i) => i.label)
    expect(labels).not.toContain('YI Know 助手')
    expect(labels).toEqual(['AI 广场管理'])
    // 管理组子项仍完整
    const admin = aiNavigationConfig.sideNavItems.find((i) => i.id === 'admin')
    expect(admin?.children?.map((c) => c.href)).toEqual([
      '/portal/apps/ai/admin/reviews',
      '/portal/apps/ai/admin/kbs',
      '/portal/apps/ai/admin/agents',
      '/portal/apps/ai/admin/integrations',
    ])
  })

  it('品牌入口（brandHref）指向落地页而非已下线对话页', () => {
    expect(aiNavigationConfig.brandHref).toBe('/portal/apps/ai/landing')
  })

  it('应用中心「YI Know 助手」卡片保留为弹窗入口（href 指向已下线 chat 路由仅作弹窗标识）', () => {
    const aiSubModules = platformModuleDefs.ai.subModules
    const chatCard = aiSubModules.find((m) => m.id === 'chat')
    expect(chatCard).toBeDefined()
    expect(chatCard?.label).toBe('YI Know 助手')
    expect(chatCard?.href).toBe('/portal/apps/ai/chat')
  })
})
