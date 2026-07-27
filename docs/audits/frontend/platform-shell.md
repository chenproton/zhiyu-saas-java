# PlatformShell 实现审计

## 核心决策

- **双应用共用 PlatformShell 架构**：`apps/edu` 和 `apps/marketplace` 各自实现 `components/platform-shell/`，共享相同的 config-based 导航配置接口 `PlatformNavigationConfig`、图标系统 `platformIconMap`、路径匹配工具 `matchesPath`。
- **权限驱动导航可见性**：`getVisibleSideNavItems()` 通过 `useAuth().hasMenuPermission` 按菜单权限过滤侧边栏条目；父级下所有子级均无权限时整个分组隐藏。
- **配置驱动布局**：`PlatformNavigationConfig` 支持 `shellClassName` / `mainClassName` / `contentClassName` 等自定义样式注入、`hideSideNav` 隐藏侧边栏、`defaultExpandedSideNavIds` 默认展开分组。
- **跨平台切换**：`platformSwitchItems` 在侧边栏底部提供跨平台导航入口，通过 `matchesPath` 高亮当前活跃平台。

## 目录结构

```
apps/edu/components/platform-shell/
├── config.ts          # PlatformNavigationConfig 接口定义
├── icons.ts           # platformIconMap (26 个 Lucide 图标)
├── index.ts           # 统一导出
├── PlatformShell.tsx  # PlatformShell + PlatformSideNav（TopNav 引用 @/components/portal/top-nav）
└── utils.ts           # cn + matchesPath

apps/marketplace/components/platform-shell/
├── config.ts          # 同上（topNavItems 为必填而非可选）
├── icons.ts           # 完全相同
├── index.ts           # 额外导出 PlatformTopNav
├── PlatformShell.tsx  # PlatformShell + PlatformSideNav + PlatformTopNav（内建顶栏）
└── utils.ts           # 完全相同
```

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| config.ts 一致性 | ✅ PASS | 两应用 `PlatformNavigationConfig` 接口定义完全一致，`SideNavItem`/`SideNavChild`/`TopNavItem`/`UserMenuItem` 均同步；唯一差异：marketplace 的 `topNavItems` 为必填，edu 为可选 |
| icons.ts 一致性 | ✅ PASS | 两应用 `platformIconMap` 26 个图标和 `resolvePlatformIcon` 实现完全相同，可直接共享；`resolvePlatformIcon` 未知 key 降级为 `Settings` 图标 |
| utils.ts 一致性 | ✅ PASS | `cn()` 和 `matchesPath()` 实现完全相同；路径匹配支持精确、前缀、`$` 结尾精确模式三策略 |
| PlatformSideNav 一致性 | ✅ PASS | 两应用侧边栏渲染逻辑一致：展开/收起切换、当前路径高亮、子级缩进 + 左边框分隔；edu 使用 `@/components/portal/top-nav` 的 TopNav，marketplace 使用同文件内建的 PlatformTopNav |
| 权限过滤导航 | ✅ PASS | `getVisibleSideNavItems()` 通过 `hasMenuPermission(child.href)` 过滤无权限的侧边栏子条目；`hidden` 属性额外支持手动隐藏 |
| 默认展开逻辑 | ✅ PASS | 优先使用 `defaultExpandedSideNavIds` 配置，否则自动展开所有有子级的分组；路径变化时自动展开当前活跃路径的父分组 |
| TopNav 实现差异 | ⚠️ WARN | marketplace 内建 `PlatformTopNav`（含用户下拉菜单、实时时钟、学院筛选、企业登录入口），edu 引用独立的 `@/components/portal/top-nav`——两者功能不一致，edu 缺少用户菜单/时钟/筛选等顶栏功能 |
| 硬编码 URL | ✅ PASS | 所有导航链接通过 config 传入（`sideBackHref`、`brandHref`、`item.href` 等），无硬编码路径；平台切换链接同样配置化 |
| 租户隔离 | ✅ PASS | 不涉及租户数据处理；权限判断依赖 `useAuth()` 上下文，由 JWT 和角色体系保证隔离 |
| 学院筛选（marketplace 专属） | ✅ PASS | `showCollegeFilter` 控制显示；通过 URL query param `college` 实现筛选状态同步，支持 `popstate` 事件响应浏览器前进/后退 |
| 用户菜单（marketplace 专属） | ✅ PASS | 支持 `tone: "danger"` 样式区分退出登录等危险操作；未配置 `userMenuItems` 时使用内置 `fallbackUserMenuItems`（个人中心/账号设置/退出登录） |

## 风险与约束

- **TopNav 实现分裂**：edu 和 marketplace 使用不同的顶栏实现，edu 依赖 `@/components/portal/top-nav` 外部组件，marketplace 内建 `PlatformTopNav`。若需对齐功能（如 edu 也加入用户下拉菜单），需评估是否下沉 `PlatformTopNav` 到共享组件还是保持在各自应用内。—— **中危，当前 edu 作为 portal 端无需商城式顶栏功能，但若未来 edu 需要类似能力，应统一使用 marketplace 的 PlatformTopNav 模式。**
- **config.ts/icons.ts/utils.ts 三文件完全重复**：两应用完全相同的代码应提取到共享包（如 `@zhiyu/ui`），避免双端修改不同步。—— **中危，当前功能稳定不常变动，但若图标集或路径匹配规则变更，需同步修改两处。**
- **PlatformSideNav 侧边栏溢出滚动**：`overflow-y-auto` 依赖固定高度 `h-[calc(100vh-3.5rem)]`，若顶栏高度变更（当前 56px）需同步调整。深层嵌套导航 + 平台切换区域可能导致滚动体验不佳。—— **低危，当前导航层级不深，平台切换最多 3-4 个入口。**
