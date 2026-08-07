# 前端 UI 包代码审查报告（packages/ui/src）

- 审查日期：2026-08-07
- 审查范围：packages/ui/src 下全部 55 个 .ts/.tsx 文件（逐行完整通读）
- 审查方法：只读审查，未修改任何代码、未运行构建/测试、未做 git 操作
- 严重级：P0 运行时必错 / P1 严重 / P2 重要 / P3 一般

---

## packages/ui/src/components/platform-shell/config.ts
无问题（纯类型定义）。

## packages/ui/src/components/platform-shell/icons.ts
- [P3][重复代码] icons.ts:34-35 — `barChart` 与 `barChart3` 两个 key 映射同一个 `BarChart3`，属冗余别名；最佳实践：删除其一，避免调用方误用两个键名维护混乱。

## packages/ui/src/components/platform-shell/index.ts
无问题（纯 re-export）。

## packages/ui/src/components/platform-shell/PlatformSideNav.tsx
- [P1][无障碍] PlatformSideNav.tsx:116-120 — 返回上级链接（`sideBackHref`）是纯图标按钮（仅 `<ChevronLeft>`，无文本），缺少 `aria-label`，屏幕阅读器无法读出其用途；最佳实践：给 Link 添加 `aria-label={config.currentPlatformLabel ? `返回${config.currentPlatformLabel}` : '返回'}` 或可见文本。
- [P2][逻辑缺陷] PlatformSideNav.tsx:95-103 — 展开状态 effect 每次都执行 `[...defaultExpanded, ...activeParents, ...prev]` 并 setExpandedItems：① 只要某父项处于 active 路径，手动折叠后下一次路由变化会被强制重新展开，用户折叠意图被覆盖；② 集合只增不减（prev 永远并入），长期导航后展开项单调膨胀；最佳实践：折叠/展开交由用户显式控制，effect 仅在初始化/配置变化时设置默认展开，不再把 prev 并入；或将 active 父项展开与用户折叠状态分开管理。
- [P3][代码风格] PlatformSideNav.tsx:88-93 — 用 render 期 setState（`prevPath` 守卫）代替 effect 监听路由变化收起移动端抽屉，属 React 文档允许但非常规写法，且每次路由变化触发一次额外渲染；最佳实践：改用 `useEffect(() => setMobileOpen(false), [pathname])`，语义更清晰。
- [P3][重复代码] PlatformSideNav.tsx:13-24 — `getMatchedTarget` 与 `utils.ts:1-12` 的 `matchesPath` 逻辑完全重复（含 `$` 精确匹配、`/` 特殊处理）；最佳实践：删除其一，统一复用 `matchesPath`。
- [P3][逻辑容错] PlatformSideNav.tsx:160 — 无 children 且无 href 的 item 会回退渲染为 `href="/"` 的链接（把用户导向首页），属静默错误兜底；最佳实践：`getVisibleSideNavItems` 阶段过滤掉既无 href 又无 children 的配置项。

## packages/ui/src/components/platform-shell/utils.ts
- [P3][重复代码] utils.ts:1-12 — `matchesPath` 与 PlatformSideNav.tsx 内 `getMatchedTarget` 实现重复（见上条）。

## packages/ui/src/components/shared/combobox-select.tsx
- [P1][无障碍] combobox-select.tsx:121 — 清除按钮是裸 `<X>` SVG 上挂 `onClick`（非 `<button>`）：无 `aria-label`、无 `role`、不可 Tab 聚焦、键盘完全不可操作，屏幕阅读器读不到任何含义；最佳实践：改为 `<Button variant="ghost" size="icon-sm" aria-label="清除选择" onClick={clearValue}>`（保留 stopPropagation）。
- [P3][样式逻辑] combobox-select.tsx:112 — 多选模式下 `props.value` 是数组，空数组为 truthy，`!props.value && 'text-muted-foreground'` 恒为 false，多选空值时 placeholder 不显示灰字样式，与单选行为不一致；最佳实践：统一用 `(isMultiple ? props.value.length === 0 : !props.value)` 判断。

## packages/ui/src/components/shared/confirm-dialog.tsx
无问题（pending 期禁用按钮并吞掉 onOpenChange 的防重复设计正确）。

## packages/ui/src/components/shared/error-state.tsx
无问题。

## packages/ui/src/components/shared/hover-action-bar.tsx
- [P3][重复渲染] hover-action-bar.tsx:22-24,44 — 同一份 `children` 在桌面（常显）与移动端（DropdownMenu）各渲染一次，若 children 内含 `id`/`htmlFor`（如 `<label htmlFor>`）会在页面上重复出现；最佳实践：拆成两份渲染成本较高时，至少在文档注明 children 不应含全局 id，或移动端仅在有 children 时渲染（已有 `hasActions` 判断但桌面端未使用）。

## packages/ui/src/components/shared/import-confirm-dialog.tsx
- [P1][双击/重复触发] import-confirm-dialog.tsx:111-126 — 三个操作按钮（仅导入新数据/新增并导入/覆盖并继续）无 `pending`/disabled 防重设计，且这是普通 `Dialog`（非 AlertDialog），点击按钮不会自动关闭：用户在导入请求期间可重复点击同一按钮、或连续点击不同按钮，导致多次互相冲突的导入请求（覆盖+跳过并发）；最佳实践：参照 confirm-dialog 引入 `pending` 状态，导入中禁用全部按钮并吞掉 onOpenChange，成功后由调用方关闭。
- [P3][代码风格] import-confirm-dialog.tsx:85-87 — 列表 key 用数组 index；该列表为静态预览切片（slice(0,10)）不会重排，风险低；最佳实践：仍建议用 `item.rowNum ?? item.name ?? index` 保证稳定性。

## packages/ui/src/components/shared/import-wizard-dialog.tsx
- [P2][错误处理缺失] import-wizard-dialog.tsx:99-106 — `handleDownload` 的 try 块无 catch：`onDownload()` 抛错时只有 finally 复位 loading，错误变成 unhandled promise rejection，用户无任何反馈；最佳实践：catch 后用 toast 提示下载失败。
- [P2][错误处理缺失] import-wizard-dialog.tsx:108-117 — `handleImport` 同样无 catch：`onImport()` 抛错时导入状态复位但用户无反馈（调用方 useImportFlow 内部的 executeImport 有 catch，但受控模式传入的 onImport 可能直接抛错）；最佳实践：catch 并 toast。
- [P2][事件处理缺陷] import-wizard-dialog.tsx:184-191 — file input 选择后未重置 `e.target.value`：用户先添加文件再移除，再次选择同一文件时 `onChange` 不会触发（input value 未变），表现为"点了没反应"；最佳实践：onChange 末尾加 `e.target.value = ''`。
- [P2][无障碍] import-wizard-dialog.tsx:176-192 — 上传区是一个 div+cursor-pointer+onClick，无 `role="button"`/`tabIndex`/键盘事件，键盘用户无法触发文件选择；最佳实践：改为 `<label>`+隐藏 input 或补 `role="button" tabIndex={0} onKeyDown`。
- [P3][代码风格] import-wizard-dialog.tsx:155-158 — 文件列表 key 用 index（列表会随移除操作重排）；最佳实践：用 `f.name + '_' + f.size` 作为 key。

## packages/ui/src/components/shared/mixed-tag-editor.tsx
- [P1][数据丢失] mixed-tag-editor.tsx:266-286 — `handleBlur` 只从 DOM 已渲染的 span 收集标签 id：当 `knowledgePoints/abilityPoints` 主列表缺失或异步未达（`createTagSpan` 返回 null，混合标签 editor 的 span 未生成）时，`knowledgePointIds/abilityPointIds` 中登记但未渲染成 span 的 id 会在 blur 时被静默丢弃并回写 onChange，随后保存即造成标签数据丢失；最佳实践：blur 收集时以 `knowledgePointIds/abilityPointIds` 快照为基准，只移除 DOM 中确实存在且不在 props 中的 id，未渲染的 id 保留在结果中。
- [P3][兼容性] mixed-tag-editor.tsx:306-310 — onPaste 使用已废弃的 `document.execCommand('insertText')`；最佳实践：改用 `Selection`/`Range` API 手动插入文本节点，或至少注释说明依赖浏览器兼容行为。
- [P3][性能] mixed-tag-editor.tsx:159-160 — 每次 effect 运行用 `JSON.stringify` 全量比较两个数组（O(n) 字符串化），高频输入场景不必要；最佳实践：用长度+首尾元素或引用比较即可，或改用 prev 引用快照。

## packages/ui/src/components/shared/status-badge.tsx
无问题（getStatusConfig 有兜底默认值，不会崩）。

## packages/ui/src/components/shared/table-row-actions.tsx
无问题。

## packages/ui/src/components/ui/alert-dialog.tsx
无问题。

## packages/ui/src/components/ui/alert.tsx
无问题。

## packages/ui/src/components/ui/avatar.tsx
无问题。

## packages/ui/src/components/ui/badge.tsx
无问题。

## packages/ui/src/components/ui/button.tsx
- [P3][冗余] button.tsx:54 — `cn(buttonVariants({ variant, size, className }))` 把 className 传入 cva 后又被 cn 包裹，双层合并；最佳实践：`cn(buttonVariants({ variant, size }), className)`，语义与 tree-shake 都更清晰。

## packages/ui/src/components/ui/card.tsx
无问题。

## packages/ui/src/components/ui/chart.tsx
- [P3][React key] chart.tsx:171 — tooltip payload 列表 key 用 `item.dataKey`，多系列共享同一 dataKey 时产生重复 key 警告；最佳实践：key 改为 `nameKey || item.name || item.dataKey || index`。
- [P3][安全性] chart.tsx:76-94 — `ChartStyle` 通过 `dangerouslySetInnerHTML` 注入 CSS，CSS 变量值直接取自调用方 config（开发方可信输入，风险可控）；仅提示：如 config 可能含外部数据，需对 `--color-${key}` 的 key 做转义。

## packages/ui/src/components/ui/checkbox.tsx
无问题。

## packages/ui/src/components/ui/collapsible.tsx
无问题。

## packages/ui/src/components/ui/command.tsx
无问题。

## packages/ui/src/components/ui/dialog.tsx
无问题（onOpenAutoFocus/onFocusCapture 的焦点管理、DialogBranch 的 DismissableLayer 注册设计正确）。

## packages/ui/src/components/ui/dropdown-menu.tsx
无问题。

## packages/ui/src/components/ui/empty.tsx
无问题。

## packages/ui/src/components/ui/field.tsx
- [P3][命名冲突] field.tsx:119-130 — `FieldTitle` 使用 `data-slot="field-label"`，与 `FieldLabel`（field.tsx:104-117）的 data-slot 完全同名，任何按 `[data-slot=field-label]` 定位的 CSS 都会同时命中两个组件，难以区分；最佳实践：FieldTitle 改用独立的 `data-slot="field-title"`。

## packages/ui/src/components/ui/input.tsx
无问题。

## packages/ui/src/components/ui/label.tsx
无问题。

## packages/ui/src/components/ui/multi-select-search.tsx
- [P1][无障碍] multi-select-search.tsx:170-178 — Badge 内删除已选项的 `<button>` 只有 `<X>` 图标，无 `aria-label`、无 `type="button"`；屏幕阅读器只能读出"按钮"；最佳实践：加 `aria-label={`移除${label}`}` 与 `type="button"`。
- [P2][重复 id] multi-select-search.tsx:121-127 — "全选" Checkbox 使用固定 `id="multi-select-all"`：同页多个实例时产生重复 id，`htmlFor` 只会命中第一个实例的 checkbox；最佳实践：用 `useId()` 生成实例唯一 id。
- [P3][逻辑缺陷] multi-select-search.tsx:172 — 移除 Badge 时用 `options.find((o) => o.label === label)` 按 label 反查 value：选项 label 重复时删除错项；且 `selected` 中不在 `options` 里的值会被 `selectedLabels` 过滤掉，导致触发区显示与选中数量不一致；最佳实践：selectedLabels 保留 value，Badge 渲染时带 `data-value`，移除时直接用 value。
- [P3][状态残留] multi-select-search.tsx:41-42 — 关闭 Popover 后 `search` 未清空，下次打开仍是上次搜索词；最佳实践：onOpenChange 关闭时重置 search。

## packages/ui/src/components/ui/multi-select.tsx
- [P1][无障碍] multi-select.tsx:93-98 — 移除标签的 `<X>` 是 span+onClick（无 role、无 aria-label、不可聚焦），键盘用户无法删除已选项；最佳实践：改为 `<button type="button" aria-label={`移除${displayLabel}`}>`（保留 removeOption 的 stopPropagation）。
- [P2][无障碍] multi-select.tsx:108-143 — 下拉面板是自建 div 实现：无 Escape 关闭、无焦点管理（打开后焦点不进入搜索框管理之外）、选项为 div+onClick 无键盘导航；最佳实践：迁移到 Radix Popover/Select 或补 Escape 监听与方向键导航。
- [P3][重复代码] multi-select.tsx（整体）— 与 multi-select-search.tsx 功能重叠（后者支持搜索/全选/subtitle），两套并存易导致调用方混用；最佳实践：评估是否统一收敛为一个组件（按组件复用原则）。

## packages/ui/src/components/ui/popover.tsx
无问题。

## packages/ui/src/components/ui/progress.tsx
无问题。

## packages/ui/src/components/ui/radio-group.tsx
无问题。

## packages/ui/src/components/ui/scroll-area.tsx
无问题。

## packages/ui/src/components/ui/select.tsx
无问题。

## packages/ui/src/components/ui/separator.tsx
无问题。

## packages/ui/src/components/ui/sheet.tsx
无问题（关闭按钮带 sr-only "Close" 文本）。

## packages/ui/src/components/ui/skeleton.tsx
无问题。

## packages/ui/src/components/ui/slider.tsx
- [P3][意外默认值] slider.tsx:16-18 — `value` 与 `defaultValue` 均缺省时回退为 `[min, max]`，会渲染出一个覆盖全量程的双滑块（看起来像 range 控件）而不是单滑块；最佳实践：缺省时回退为单值（如 `[min]`）或在文档中明确该回退语义。

## packages/ui/src/components/ui/spinner.tsx
无问题（role="status" + aria-label 正确）。

## packages/ui/src/components/ui/switch.tsx
无问题。

## packages/ui/src/components/ui/table.tsx
无问题。

## packages/ui/src/components/ui/tabs.tsx
无问题。

## packages/ui/src/components/ui/textarea.tsx
无问题。

## packages/ui/src/components/ui/toaster.tsx
无问题。

## packages/ui/src/components/ui/toast.tsx
无问题（ToastClose 依赖 Radix 默认 aria-label="Close"）。

## packages/ui/src/components/ui/toggle-group.tsx
无问题。

## packages/ui/src/components/ui/toggle.tsx
无问题。

## packages/ui/src/components/ui/tooltip.tsx
无问题。

## packages/ui/src/hooks/use-async.ts
- [P2][竞态/泄漏] use-async.ts:51-70 — `refresh` 无竞态防护：并发触发多次 refresh 时，先发请求的响应可能覆盖后发请求（响应乱序）；组件卸载后仍在飞行中的请求 resolve 后继续 setState（内存与状态泄漏，React 18 无警告但浪费）；最佳实践：内部用 request id 或 AbortController 丢弃过期响应，并在 effect 清理时标记 unmounted。
- [P3][可读性] use-async.ts:72-77 — effect 依赖通过 `...(options.deps ?? [])` 展开数组，语义隐晦且绕过 lint；最佳实践：文档已在注释说明，可接受，但建议调用方统一传显式 deps 数组。

## packages/ui/src/hooks/use-import-flow.ts
- [P3][死代码] use-import-flow.ts:16 — options 解构中 `entityLabel` 未声明也未使用（接口里有该字段，纯文档用途）；最佳实践：要么在成功 toast 文案中使用它，要么从类型中移除以免调用方误解。

## packages/ui/src/hooks/use-toast.ts
- [P2][产品行为] use-toast.ts:8 — `TOAST_LIMIT = 1`：新 toast 通过 `slice(0, 1)` 直接把旧 toast 从数组摘除，旧 toast 未走 DISMISS 流程（无收起动画、不触发其 onOpenChange），连续错误时用户只能看到最后一条；最佳实践：若为刻意取舍建议注释说明；否则改为叠加展示或先 DISMISS 再 ADD。
- [P3][性能] use-toast.ts:163-171 — 订阅 effect 依赖 `[state]`，每次 toast 状态变化都执行 remove+re-add listener（shadcn 原版写法）；最佳实践：依赖改 `[]` 即可，listener 只注册一次。

## packages/ui/src/index.ts
无问题。

## packages/ui/src/lib/dom-utils.ts
- [P1][无障碍] dom-utils.ts:29-36 — 标签删除按钮（`×`）是 contentEditable 内部创建的裸 `<button>`：无 `aria-label`；且 contentEditable 区域内的元素不在 Tab 顺序中，键盘用户完全无法聚焦该按钮，只能鼠标点击删除；最佳实践：给 btn 设置 `aria-label="删除标签"`，并在 MixedTagEditor 上提供键盘删除路径（如选中标签后按 Backspace/Delete 删除——当前仅靠按钮删除）。
- [P3][细节] dom-utils.ts:31 — 用 `'×'` 文本字符作删除图标，视觉大小随字体变化；最佳实践：可用内联 SVG 或统一 icon 类名。

## packages/ui/src/lib/utils.ts
- [P3][功能缺口] utils.ts:8-13 — `formatFileSize` 只输出 MB 且固定两位小数：小于 1MB 显示 "0.00 MB"，大文件显示 "1024.00 MB"；最佳实践：按量级分 B/KB/MB/GB 自适应，并去掉多余尾零。

## packages/ui/src/utils.test.ts
无问题（cn 单测覆盖 tailwind 冲突合并，与实现一致）。
