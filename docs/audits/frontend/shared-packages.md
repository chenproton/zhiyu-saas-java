# 共享包审计

## 核心决策

### `@zhiyu/ui` — 共享 UI 组件库
- 60+ shadcn/ui 基础组件，覆盖表单/展示/交互/布局/反馈全场景。
- 全局样式 `globals.css`、工具函数 `cn()`（clsx + tailwind-merge）。
- PRD 注释叠加层系统（JSON 文件适配器）。自定义 Hook（`use-mobile`、`use-toast`）。

### `@zhiyu/shared-types` — 共享类型定义
- 7 个子模块：backend、job、scene、lesson、evaluation、portal、status。
- `STATUS_TRANSITIONS` 状态流转矩阵 + `canPerformAction()`/`getNextStatus()` 辅助函数（与后端 `content_actions.go` 一致）。
- `LevelMapping` 6 级能力等级 + `calculateLevel()` 自动计算。

### `PlatformShell` — 统一平台外壳
- 配置驱动的两栏布局（侧边栏 + 顶部导航 + 主内容区）。
- 5+ 套导航配置（`navigation-config.ts`），权限过滤。
- Lucide 图标系统。

### 菜单权限系统
- `menu-permissions.ts`：基于路径层级的菜单权限检查，向上遍历父路径。
- `permissionModuleConfig`：模块级操作权限定义。

### AI 集成组件
- 5 个共享 AI 组件（聊天/评论/信心标签/生成按钮/生成对话框）。
- 岗位 AI 辅助构建向导。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| UI 组件完整性 | PASS | 60+ 组件覆盖表单/展示/交互/布局/反馈全场景 |
| 共享类型完整性 | PASS | 7 模块覆盖 backend/job/scene/lesson/evaluation/portal/status |
| 状态机定义 | PASS | `STATUS_TRANSITIONS` 与后端矩阵一致 |
| PlatformShell | PASS | 配置驱动的两栏布局；导航配置；权限过滤 |
| 菜单权限 | PASS | 基于路径层级的权限检查 |
| AI 组件 | PASS | 5 个共享 AI 组件 |
| 跨应用共享 | PASS | ui/api-client/shared-types 被 edu 应用引用 |

## 风险与约束

- 无明显高风险项，共享包架构完整且与 edu 应用配合良好。
