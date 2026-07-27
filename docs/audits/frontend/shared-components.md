# 共享 UI 组件审计

## 核心决策

- **StatusBadge**：通过 `@/lib/status-constants` → `@/lib/types/status`（tsconfig alias 映射到 `packages/shared-types/src/status`）正确引用全局 `getStatusConfig()`，避免本地重复定义状态配置。
- **ConfirmDialog**：基于 shadcn `AlertDialog` 封装，统一项目内删除/危险操作确认交互，禁止 `window.confirm()`。
- **TableRowActions / HoverActionBar**：提供一致的 `group-hover:opacity-100` 悬停操作栏 UX，分别用于表格行和非表格容器。
- **useImportFlow**：统一的 Excel 导入流程 hook，封装文件选择、模板下载、预览与执行导入三步流程。
- **LogTableShell**：泛型日志/列表表格组件，内置 loading/empty/pagination 状态。
- **LandingFilterRow / LandingPagination**：落地页筛选与分页组件，支持 purple/emerald/blue 三色主题。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| StatusBadge 使用全局 getStatusConfig | ✅ PASS | 经 `status-constants.ts` → tsconfig alias → `shared-types/src/status.ts` 三层重导出，最终引用共享包；15 种状态映射覆盖常用场景，未知状态降级为原文显示 |
| ConfirmDialog destructive 变体 | ✅ PASS | `variant='destructive'` 时按钮添加 `bg-destructive text-white hover:bg-destructive/90`，视觉上明确区分危险操作；未定义时默认为 default |
| ConfirmDialog 禁止 window.confirm | ✅ PASS | 全项目应通过此组件做删除确认，不直接使用浏览器原生弹窗 |
| TableRowActions / HoverActionBar 悬停交互 | ✅ PASS | 两者使用一致的 `absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm opacity-0 group-hover:opacity-100` 样式；TableRowActions 包裹在 `<TableCell>` 中适配表格场景 |
| useImportFlow 文件验证 | ⚠️ WARN | 仅检查 `files?.[0]` 是否存在，**不校验文件大小与扩展名**（与后端“不限制扩展名”策略一致）；大文件上传依赖后端 100MB 限制 |
| useImportFlow 错误处理 | ✅ PASS | 预览失败 toast 提示；导入完成后展示 created/failed/skipped 统计及前 3 条错误；下载模板通过 Blob + createObjectURL 正确清理 |
| useImportFlow 重复数据处理 | ✅ PASS | 预览阶段检测 duplicates > 0 时暂停流程，由用户决定是否覆盖（通过 `executeImport(overwrite)` 二次调用） |
| LogTableShell 泛型安全 | ✅ PASS | `LogTableShell<T extends { id: string }>` 确保每行有唯一 key；`LogColumn<T>` 的 cell 回调接收强类型 item |
| LogTableShell loading/empty 状态 | ✅ PASS | loading 时显示 `Loader2` 动画；空数据时显示自定义 `emptyText`；未覆盖边缘的错误状态 |
| LandingFilterRow 溢出处理 | ✅ PASS | 通过 `useRef` + `scrollHeight` 检测溢出，提供展开/收起按钮；items ≤ 1 时返回 null 隐藏整行 |
| LandingPagination 分页逻辑 | ✅ PASS | 5 页以内全部展示，超出时采用 1...N-1,N,N+1...total 省略逻辑；支持首页/末页禁用态 |
| 所有组件类型安全 | ✅ PASS | 全部使用 TypeScript 显式 interface；无 `any` 类型暴露到公共 API（useImportFlow 内部 `importPreview` 使用 `any` 但属于中间态，非公共接口） |
| 符合 AGENTS.md 公约 | ✅ PASS | 无本地 `STATUS_CONFIG` 定义；删除确认使用 ConfirmDialog；表格操作使用 TableRowActions/HoverActionBar；导入流程使用 useImportFlow |

## 风险与约束

- **useImportFlow 无前端文件校验**：不校验文件扩展名和大小，依赖后端 100MB 上限和 Excel 解析容错。—— **低危，与后端“不限制扩展名”策略对齐，上传安全由后端网关负责。**
- **LogTableShell 无错误状态展示**：仅覆盖 loading 和 empty，当接口报错时需调用方自行处理。—— **低危，各页面 handler 自行处理错误 toast，组件保持简单职责。**
- **StatusBadge 颜色由 getStatusConfig 生成 inline style**：不走 Tailwind 主题变量，若状态值 miss 会降级为原文 `label` 显示，可能 UI 不一致。—— **低危，getStatusConfig 已覆盖 15 种常用状态 + fallback，新增状态只需在共享包扩展 STATUS_MAP。**
- **ConfirmDialog 无 loading/pending 状态**：异步 `onConfirm` 执行期间按钮无 loading 指示，用户可能重复点击。—— **低危，大部分确认操作（如删除）后端接口较快，极端场景由调用方自行禁用按钮。**
