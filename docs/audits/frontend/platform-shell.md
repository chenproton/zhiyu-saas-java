# PlatformShell 实现审计

## 核心决策

- **单应用 PlatformShell 架构**：当前仅 `apps/edu` 使用 PlatformShell，通过 config-based 导航配置接口 `PlatformNavigationConfig`、图标系统 `platformIconMap`、路径匹配工具 `matchesPath` 驱动布局。
- **权限驱动导航可见性**：`getVisibleSideNavItems()` 通过 `useAuth().hasMenuPermission` 按菜单权限过滤侧边栏条目；父级下所有子级均无权限时整个分组隐藏。
- **配置驱动布局**：`PlatformNavigationConfig` 支持 `shellClassName` / `mainClassName` / `contentClassName` 等自定义样式注入、`hideSideNav` 隐藏侧边栏、`defaultExpandedSideNavIds` 默认展开分组。
- **跨平台切换**：`platformSwitchItems` 在侧边栏底部提供跨平台导航入口，通过 `matchesPath` 高亮当前活跃平台。

> **历史**：此前 `apps/marketplace` 也独立维护了一套 PlatformShell（与 edu 版本高度重复），商城源码已移除，对应 PlatformShell 不再维护。

## 目录结构

组件实现在共享包，组装在应用侧：

```
packages/ui/src/components/platform-shell/
├── config.ts          # PlatformNavigationConfig 接口定义
├── icons.ts           # platformIconMap (26 个 Lucide 图标)
├── index.ts           # 统一导出（PlatformSideNav + 类型）
├── PlatformSideNav.tsx# PlatformSideNav 侧边栏（权限过滤、展开/收起）
└── utils.ts           # cn + matchesPath

apps/edu/components/platform-shell/
├── index.ts           # 统一导出
└── PlatformShell.tsx  # PlatformShell 组装（TopNav 引用 @/components/portal/top-nav）
```

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| config.ts 接口 | ✅ PASS | `PlatformNavigationConfig` 接口定义清晰，`topNavItems` 为可选字段适应 portal 使用场景 |
| icons.ts 完整性 | ✅ PASS | 26 个图标映射 + `resolvePlatformIcon` 降级为 `Settings` 图标 |
| utils.ts 路径匹配 | ✅ PASS | `matchesPath()` 支持精确、前缀、`$` 结尾精确模式三策略 |
| PlatformSideNav 渲染 | ✅ PASS | 展开/收起切换、当前路径高亮、子级缩进 + 左边框分隔 |
| 权限过滤导航 | ✅ PASS | `getVisibleSideNavItems()` 通过 `hasMenuPermission(child.href)` 过滤；`hidden` 属性额外支持手动隐藏 |
| 默认展开逻辑 | ✅ PASS | 优先使用 `defaultExpandedSideNavIds` 配置，否则自动展开所有有子级的分组；路径变化时自动展开当前活跃路径的父分组 |
| TopNav 实现 | ✅ PASS | edu 使用 `@/components/portal/top-nav`（含学院筛选、用户下拉菜单、实时时钟等功能） |
| 硬编码 URL | ✅ PASS | 所有导航链接通过 config 传入，无硬编码路径；平台切换链接同样配置化 |
| 租户隔离 | ✅ PASS | 不涉及租户数据处理；权限判断依赖 `useAuth()` 上下文 |

## 风险与约束

- **PlatformSideNav 侧边栏溢出滚动**：`overflow-y-auto` 依赖固定高度 `h-[calc(100vh-3.5rem)]`，若顶栏高度变更（当前 56px）需同步调整。深层嵌套导航 + 平台切换区域可能导致滚动体验不佳。—— **低危，当前导航层级不深，平台切换最多 3-4 个入口。**
