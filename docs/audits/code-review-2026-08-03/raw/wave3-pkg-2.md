# 前端 packages 批次2 审查（62文件，4933行）

## P2（摘要）
```
packages/ui/src/components/platform-shell/PlatformSideNav.tsx:73-81 | P2 | 逻辑 | useEffect 折叠展开 = new Set([...defaultExpanded, ...activeParents, ...prev]) 全量保留 prev，每次路径变化撤销用户手动折叠的条目 | 改为 new Set([...defaultExpanded, ...activeParents])
packages/ui/src/components/shared/import-wizard-dialog.tsx:99-117 | P2 | 错误处理 | handleDownload/handleImport 的 await onDownload()/onImport(files) 无 try/catch，reject 产生 unhandled rejection（only finally 复位 loading）| 包 try/catch 失败 toast
packages/ui/src/components/shared/mixed-tag-editor.tsx:230-257 | P2 | 逻辑 | 聚焦分支只追加不清理：外部删除标签后 ghost span 保留，blur 时把已删标签"复活"回状态 | 聚焦分支同样移除已删 span
packages/ui/src/components/ui/field.tsx:119-130 | P2 | 一致性/命名 | FieldTitle 误用 data-slot="field-label"（与 FieldLabel 相同），水平布局选择器同时命中两者 | 改为 data-slot="field-title"
packages/ui/src/components/ui/multi-select-search.tsx:70-74,167-180 | P2 | 逻辑 | 已选 Badge 用 label 作 React key，移除按钮经 options.find(o=>o.label===label) 反查 value：同 label 不同 value 时移除错条目 | Badge key 与移除均直接用 value
packages/ui/src/hooks/use-toast.ts:8-9 | P2 | 稳定性 | TOAST_LIMIT=1 + TOAST_REMOVE_DELAY=1000000(≈16min)：连续 toast 截断上一 toast 且定时器迟到触发 REMOVE | 提高 LIMIT 或缩短 REMOVE_DELAY 并清理定时器
packages/ui/src/hooks/use-import-flow.ts:42-69 | P2 | 错误处理 | executeImport 中 await onSuccess() 抛错向上传导至 wizard onImport（unhandled rejection），导入成功但向导不关闭 | onSuccess 包 try/catch 仍返回 true
```

## P3（摘要）
```
platform-shell/icons.ts:61-65 | P3 | 类型/死代码 | || Settings 在类型层不可达，未知 key 静默降级 | 去掉或显式报错
shared/combobox-select.tsx:138,121 | P3 | 交互/可访问性 | CommandItem value=o.label 同 label 歧义；清除按钮非 button 无键盘可达 | 修正
shared/import-wizard-dialog.tsx:184-191 | P3 | 稳定性 | file input onChange 后未清空 value，重选同一文件不触发 change | onChange 末尾清空
shared/mixed-tag-editor.tsx:298-302,137-153 | P3 | 稳定性/性能 | 使用废弃 document.execCommand('insertText')；全量重建 effect 与增量 effect 重复操作 | Selection API/去重
shared/hover-action-bar.tsx:43-47 | P3 | 交互 | DropdownMenuContent onClickCapture 拦截任意点击 | 改为各 action 自身关闭
ui/field.tsx:16 | P3 | 死代码 | FieldSet 引用不存在的 checkbox-group slot | 移除或补组件
ui/chart.tsx:76-94,167 | P3 | 安全/稳定性 | ChartStyle 用 dangerouslySetInnerHTML 拼接 CSS，key 含 }/引号可注入；item.payload.fill 未判空 | 白名单校验/判空
ui/dialog.tsx:90-104 | P3 | 稳定性 | 自定义焦点管理在无可聚焦元素时焦点丢失到 body | 简化
ui/empty.tsx:36-46 | P3 | 类型 | EmptyDescription 声明 p 类型实际渲染 div | 统一
ui/multi-select-search.tsx:170-178,121 | P3 | 稳定性/一致性 | Badge 移除 button 未设 type=button 会触发表单提交；全选 id 硬编码冲突 | 修正/useId
ui/multi-select.tsx:20-146 | P3 | 重复代码 | 与 multi-select-search/ComboboxSelect 三套多选并存，apps 10+ 页面使用 | 收敛迁移
ui/toast.tsx:82 | P3 | 代码质量 | 残留非标准 toast-close="" 属性 | 删除
hooks/use-toast.ts:163-171 | P3 | 性能 | useEffect 依赖 [state] 每次 toast 变更重注册 listener | 依赖改 []
hooks/use-import-flow.ts:9-14 | P3 | 死代码 | entityLabel 声明必填但未使用 | 使用或移除
ui/button.tsx:7-37 | P3 | 一致性 | 变体硬编码渐变 #4f46e5/#7c3aed/#06b6d4，偏离主题 token 体系 | 收敛 design tokens
```

## 无问题文件（约 40 个）
platform-shell/config.ts、platform-shell/index.ts、platform-shell/utils.ts、shared/confirm-dialog.tsx、shared/error-state.tsx、shared/import-confirm-dialog.tsx、shared/status-badge.tsx、shared/table-row-actions.tsx、ui/alert-dialog.tsx、ui/alert.tsx、ui/avatar.tsx、ui/badge.tsx、ui/card.tsx、ui/checkbox.tsx、ui/collapsible.tsx、ui/command.tsx、ui/input.tsx、ui/label.tsx、ui/popover.tsx、ui/progress.tsx、ui/radio-group.tsx、ui/scroll-area.tsx、ui/select.tsx、ui/separator.tsx、ui/sheet.tsx、ui/skeleton.tsx、ui/slider.tsx、ui/spinner.tsx、ui/switch.tsx、ui/table.tsx、ui/tabs.tsx、ui/textarea.tsx、ui/toaster.tsx、ui/toggle-group.tsx、ui/toggle.tsx、ui/tooltip.tsx、index.ts、lib/dom-utils.ts、lib/utils.ts、utils.test.ts

总行数 4933
