# 前端 packages/ui 复查报告（2026-08-08）

复查范围：`packages/ui/src` 全部 60 个 ts/tsx 文件，逐行通读。
重点：2026-08-07 修复引入的回归（combobox 清除按钮事件处理、import-confirm-dialog 防重、mixed-tag-editor 兜底合并）、上轮遗漏、新问题。
原则：简单优先，样式问题不做视觉验证。

问题统计：P0 0 条、P1 1 条、P2 9 条、P3 10 条，共 20 条。

---

## packages/ui/src/components/shared/mixed-tag-editor.tsx

- [P2][数据回弹/竞态] packages/ui/src/components/shared/mixed-tag-editor.tsx:237-245 — 聚焦态分支只追加不删除：当编辑器持有焦点且 props 的 knowledgePointIds/abilityPointIds 被外部移除（如父组件重置/联动）时，`newKpIds/newAbIds` 为空且 missing 为空 → 早退，prevTags 与 DOM 均保持旧值；随后 blur 时 handleBlur 的兜底合并（:287-292）把 prevTags 中已移除的 id 重新写入 onChange → 被删标签"复活"。正常删除路径（×按钮 mousedown 先 blur 再 click）不受影响，但聚焦期间的外部变更会被静默回滚。最佳实践：聚焦分支同样处理移除（同步 DOM 并更新 prevTags），或兜底合并时用「prevTags ∩ props」而不是直接并入 prevTags。
- [P3][死代码] packages/ui/src/components/shared/mixed-tag-editor.tsx:49,84 — `cursorOffsetRef` 只写不读（updateCursorOffset 计算的偏移从未用于恢复光标），三个事件绑定（onInput/onKeyUp/onMouseUp, :305-307）产生无效计算。最佳实践：删除 cursorOffsetRef 及 updateCursorOffset 的 offset 计算，仅保留事件占位或直接移除；若确实要聚焦态追加标签时保光标，应实现基于该偏移的 caret 恢复。

## packages/ui/src/components/shared/combobox-select.tsx

- [P2][DOM 合法性/无障碍] packages/ui/src/components/shared/combobox-select.tsx:121-132 — 上轮改造把清除按钮做成 `<button>` 嵌套在触发器 `<Button>`（也是 `<button>`）内部，形成 button-in-button 非法嵌套；屏幕阅读器可访问名计算异常，键盘焦点语义混乱（两个 Tab 停靠点同属一个控件）。事件处理本身正确（stopPropagation 阻止冒泡到 Radix trigger 的 onClick）。最佳实践：清除按钮改为与触发器并列（外层 div 相对定位 + 清除按钮绝对定位于右上角），或触发器内用 `role="button"` 的 span + tabIndex + keydown 处理。
- [P3][样式] packages/ui/src/components/shared/combobox-select.tsx:112 — 多选模式下 `!props.value` 恒为 false（`[]` 为真值），空选时 placeholder 不应用 `text-muted-foreground`，与单选模式视觉不一致。最佳实践：多选判断 `(props.value as string[]).length === 0`。

## packages/ui/src/components/shared/confirm-dialog.tsx

无问题（pending 护栏、Escape/遮罩拦截均正确，AlertDialogAction 不会自动关闭）。

## packages/ui/src/components/shared/error-state.tsx

无问题。

## packages/ui/src/components/shared/hover-action-bar.tsx

- [P3][无障碍] packages/ui/src/components/shared/hover-action-bar.tsx:22-24 — 桌面端操作按钮 `opacity-0 group-hover:opacity-100` 隐藏但仍在 Tab 焦点序中，键盘用户可聚焦到不可见按钮。最佳实践：hidden 态加 `invisible` + `focus-within:visible` 或 aria-hidden 管理。

## packages/ui/src/components/shared/import-confirm-dialog.tsx

- [P1][防重失效/并发导入] packages/ui/src/components/shared/import-confirm-dialog.tsx:51-59 — 上轮「导入防重」修复存在回归：`run()` 中 `fn()` 未 await，而所有调用方传入的都是 async 函数（如 apps/edu content-list-page.tsx:1859-1861 的 `() => doImport('skip')`，内部 `await executeImport`）。`fn()` 返回 pending Promise 后同步进入 finally 执行 `setPending(null)`，两次 setState 在同一事件循环内被 React 18 自动批处理 → busy 中间态可能根本不渲染、按钮从不真正禁用、`if (pending) return` 读到的是旧闭包值 null → 快速连点同一按钮或切换按钮可并发发起两次 importExcel（覆盖+跳过同时执行，重复/覆盖数据）。最佳实践：`fn: () => void | Promise<void>` 且 `await fn()`（try 内），finally 再 setPending(null)，保持 pending 到异步完成。
- [P2][事件处理] packages/ui/src/components/shared/import-confirm-dialog.tsx:64 — `onOpenChange={onOpenChange}` 未加 pending 护栏，导入进行中按 Esc/点击遮罩仍可关闭弹窗；与 confirm-dialog.tsx:40 的 `pending ? () => {} : onOpenChange` 不一致。最佳实践：`onOpenChange={pending ? () => {} : onOpenChange}`。

## packages/ui/src/components/shared/import-wizard-dialog.tsx

- [P2][无障碍] packages/ui/src/components/shared/import-wizard-dialog.tsx:169-176 — 文件移除按钮为纯图标按钮（X）无 aria-label，上轮全包 aria-label 补漏未覆盖此处。最佳实践：`aria-label={`移除${f.name}`}`。
- [P2][无障碍] packages/ui/src/components/shared/import-wizard-dialog.tsx:181-197 — 上传点击区为 div + onClick，无 role/tabIndex/onKeyDown，键盘用户无法触发文件选择。最佳实践：改为 `<button type="button">`（内部保留 hidden input）或加 `role="button" tabIndex={0} onKeyDown={Enter/Space 触发}`。
- [P3][状态] packages/ui/src/components/shared/import-wizard-dialog.tsx:127-130 — step 重置只挂在 onOpenChange(false) 上，父级直接置 open=false（不经 Radix 回调）关闭后重开时仍停留在 upload 步。最佳实践：onOpenChange 之外再监听 open 转为 true 时重置 step。

## packages/ui/src/components/shared/status-badge.tsx

无问题。

## packages/ui/src/components/shared/table-row-actions.tsx

无问题。

## packages/ui/src/components/platform-shell/PlatformSideNav.tsx

- [P2][无障碍] packages/ui/src/components/platform-shell/PlatformSideNav.tsx:238-242 — 移动端 SheetContent 未提供 SheetTitle，Radix Dialog 触发 a11y 警告（console warning）且读屏无标题。最佳实践：加 `<SheetTitle className="sr-only">{config.currentPlatformLabel}</SheetTitle>`（或 aria-labelledby 指向 :124 的 h2）。
- [P3][无障碍] packages/ui/src/components/platform-shell/PlatformSideNav.tsx:139-158 — 可展开分组按钮缺 `aria-expanded={isExpanded}`（及 aria-controls）；:160-169/:177-188 活动链接缺 `aria-current="page"`。最佳实践：补充对应 ARIA 属性。
- [P3][风格] packages/ui/src/components/platform-shell/PlatformSideNav.tsx:89-93 — 渲染期 setState（prevPath 守卫式状态调整）虽为 React 认可的派生状态模式，但每次路由切换多渲染一轮；用 `useEffect(() => setMobileOpen(false), [pathname])` 语义更清晰（存在一帧闪烁权衡，可接受现状）。

## packages/ui/src/components/platform-shell/config.ts

无问题。

## packages/ui/src/components/platform-shell/icons.ts

无问题。

## packages/ui/src/components/platform-shell/index.ts

无问题。

## packages/ui/src/components/platform-shell/utils.ts

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

无问题。

## packages/ui/src/components/ui/card.tsx

无问题。

## packages/ui/src/components/ui/chart.tsx

无问题。

## packages/ui/src/components/ui/checkbox.tsx

无问题。

## packages/ui/src/components/ui/collapsible.tsx

无问题。

## packages/ui/src/components/ui/command.tsx

无问题。

## packages/ui/src/components/ui/dialog.tsx

- [P3][无障碍/文案] packages/ui/src/components/ui/dialog.tsx:113（同 sheet.tsx:71）— 关闭按钮 sr-only 文案为英文 "Close"，与全中文 UI 不一致，读屏朗读英文。最佳实践：改为中文「关闭」或由调用方传 label。

## packages/ui/src/components/ui/dropdown-menu.tsx

无问题。

## packages/ui/src/components/ui/empty.tsx

无问题。

## packages/ui/src/components/ui/field.tsx

无问题。

## packages/ui/src/components/ui/input.tsx

无问题。

## packages/ui/src/components/ui/label.tsx

无问题。

## packages/ui/src/components/ui/multi-select-search.tsx

- [P2][DOM/ID 冲突] packages/ui/src/components/ui/multi-select-search.tsx:121 — 硬编码 `id="multi-select-all"`；实际已有同页双实例（apps/edu/components/evaluation/random-question-dialog.tsx:485,551 同一弹窗渲染两个），重复 id 导致 htmlFor 关联错乱（点第二个"全选"文本勾选第一个复选框）。最佳实践：`const uid = useId()`，`id={`${uid}-all`}`。

## packages/ui/src/components/ui/multi-select.tsx

- [P2][DOM 合法性/无障碍] packages/ui/src/components/ui/multi-select.tsx:73-108 — 移除按钮（上轮 span→button 改造）嵌套在外层触发 `<button>` 内，button-in-button 非法嵌套，与 combobox-select 同类问题。最佳实践：外层改为 div（可聚焦）+ 内层 button，或清除按钮移出触发器。
- [P3][无障碍] packages/ui/src/components/ui/multi-select.tsx:73-108 — 触发按钮缺 `aria-expanded`/`aria-haspopup`；下拉内容非 dialog，Escape 不关闭。最佳实践：补 aria-expanded 即可（低成本）。

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

- [P3][无障碍/文案] packages/ui/src/components/ui/sheet.tsx:71 — 同 dialog.tsx:113，sr-only "Close" 英文文案。

## packages/ui/src/components/ui/skeleton.tsx

无问题。

## packages/ui/src/components/ui/slider.tsx

无问题。

## packages/ui/src/components/ui/spinner.tsx

无问题。

## packages/ui/src/components/ui/switch.tsx

无问题。

## packages/ui/src/components/ui/table.tsx

无问题。

## packages/ui/src/components/ui/tabs.tsx

无问题。

## packages/ui/src/components/ui/textarea.tsx

无问题。

## packages/ui/src/components/ui/toast.tsx

- [P3][无障碍] packages/ui/src/components/ui/toast.tsx:72-88 — ToastClose 纯图标按钮无 aria-label（上轮 aria-label 补漏未覆盖）。最佳实践：加 `aria-label="关闭"`。

## packages/ui/src/components/ui/toaster.tsx

无问题。

## packages/ui/src/components/ui/toggle.tsx

无问题。

## packages/ui/src/components/ui/toggle-group.tsx

无问题。

## packages/ui/src/components/ui/tooltip.tsx

无问题。

## packages/ui/src/hooks/use-async.ts

- [P2][竞态] packages/ui/src/hooks/use-async.ts:51-70 — refresh 无请求序号守卫：deps 快速变化（筛选联动）时，先发出的慢请求可能后返回并覆盖新数据，与仓库近期「8 处前端竞态请求序号守卫」的标准不一致。最佳实践：useRef 请求序号 `seqRef.current++`，await 后 `if (seq !== seqRef.current) return`。

## packages/ui/src/hooks/use-import-flow.ts

- [P3][逻辑/误报] packages/ui/src/hooks/use-import-flow.ts:64-74 — executeImport 成功路径先 `setImportFiles([])`/`setImportPreview(null)` 再 `await onSuccess()`；若 onSuccess 抛错（如刷新列表失败），catch 显示「导入失败」toast，但实际数据已导入成功，且文件已被清空无法重试。最佳实践：onSuccess 失败单独 toast（如「导入成功，但刷新失败」），不并入导入失败分支。

## packages/ui/src/hooks/use-toast.ts

- [P3][性能] packages/ui/src/hooks/use-toast.ts:163-171 — useEffect 依赖 `[state]`，每次 toast 状态变化都执行 listeners 解绑+重订阅（每次 dispatch 后多一轮 effect 往返）；无实际必要性。最佳实践：依赖改 `[]`，订阅/退订只发生一次。

## packages/ui/src/index.ts

无问题。

## packages/ui/src/lib/dom-utils.ts

无问题（上轮 aria-label + type="button" 修复正确；stopPropagation 与 span.remove() 顺序合理）。

## packages/ui/src/lib/utils.ts

无问题。

## packages/ui/src/utils.test.ts

无问题。

---

# 汇总

- 审查文件数：60
- 问题总数：20（P0 0 / P1 1 / P2 9 / P3 10）

## P1 摘要

1. **import-confirm-dialog.tsx:51-59 防重失效（回归）** — `run()` 未 await async 回调即复位 pending：调用方传入的 `doImport`（async→`await executeImport`）使 busy 中间态与 pending 护栏在同一次批处理内被跳过，按钮从不真正禁用，连点可并发发起两次导入（skip/overwrite 同时执行）。需改为 `await fn()` 且类型放宽为 `() => void | Promise<void>`。

## P2 摘要

1. **mixed-tag-editor.tsx:237-245+287-292 数据回弹** — 聚焦态外部移除标签时分支早退、prevTags 不更新，blur 兜底合并将已删标签重新写回（边缘场景，正常 × 删除不受影响）。
2. **combobox-select.tsx:121-132 / multi-select.tsx:73-108 非法嵌套** — 上轮清除/移除按钮改 button 后形成 button-in-button 嵌套（清除事件 stopPropagation 正确，属 DOM/读屏问题）。
3. **import-confirm-dialog.tsx:64** — pending 期间未拦截 Esc/遮罩关闭（与 confirm-dialog 不一致）。
4. **import-wizard-dialog.tsx:169-176 / :181-197** — 移除文件按钮缺 aria-label；上传区 div 无键盘可达性。
5. **multi-select-search.tsx:121** — 硬编码 id 重复，同页双实例（random-question-dialog）htmlFor 关联错乱。
6. **use-async.ts:51-70** — refresh 无请求序号守卫，慢响应覆盖新数据。
7. **PlatformSideNav.tsx:238-242** — SheetContent 缺 SheetTitle，Radix 警告且读屏无标题。

## 无问题文件（45 个）

platform-shell/{config,icons,index,utils}.ts、shared/{confirm-dialog,error-state,status-badge,table-row-actions}.tsx、ui/{alert,alert-dialog,avatar,badge,button,card,chart,checkbox,collapsible,command,empty,field,input,label,popover,progress,radio-group,scroll-area,select,separator,skeleton,slider,spinner,switch,table,tabs,textarea,toaster,toggle,toggle-group,tooltip}.tsx、lib/dom-utils.ts、lib/utils.ts、index.ts、utils.test.ts

有问题的文件（15 个）：mixed-tag-editor、combobox-select、hover-action-bar（P3）、import-confirm-dialog、import-wizard-dialog、PlatformSideNav、dialog、sheet、multi-select、multi-select-search、toast、use-async、use-import-flow（P3）、use-toast（P3）
