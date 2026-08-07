# 前端组件审查批次 03（shared 目录 + exam-grading + theme-brand-sync + theme-provider）

审查日期：2026-08-08（批次 03，共 43 个文件）。后端契约已 grep 核实（parsePageLimit 钳制 MaxPageSize=200，backend/internal/handler/common.go；favorite/tag/资源库/任务/工作流接口）。

---

## apps/edu/components/shared/exam-grading/question-grading-card.tsx
- [P2][状态管理] question-grading-card.tsx:150,163-175 — `localScore` 只在 `useState(score.toString())` 时初始化一次，外部 `score` 属性变化（撤销评分、服务端回填、父组件重置）后输入框不回显新值，且 `handleBlur` 失败时用旧 `score` 还原，可能把刚提交的值覆盖回旧值。最佳实践：`useEffect(() => setLocalScore(score.toString()), [score, question.id])` 同步或按 `question.id` 重建组件。
- [P3][i18n] question-grading-card.tsx:62-66,341,347 — `getAnswerLabel` 的兜底 `'未作答'` 及 `answer` 文本经 `t()` 二次查找，若答案文本恰好命中字典 key 会被误翻译（低概率）；`isAnswerCorrect` judge 分支（41-46）硬编码中文 `'正确'/'错误'` 与英文 `'true'/'false'` 双值判断，依赖题型数据契约。建议：翻译走显式分支，判断逻辑保持契约注释。
- [P3][类型] question-grading-card.tsx:16-65 — `q/ans` 大量 `any` 参数，`q.score`、`q.answer` 无结构校验，依赖后端字段契约。可定义 `Question`/`Answer` 联合类型。
- [P3][逻辑] question-grading-card.tsx:166 — 满分提交条件 `val === String(question.score || 0)`：当 `question.score` 为 0 时，任意输入与 `"0"` 不等则不提交（失焦兜底），边缘但符合现有注释语义。

## apps/edu/components/shared/favorite-button.tsx
- [P3][重复代码] favorite-button.tsx:83-118 — light 与默认两个 JSX 分支高度重复（仅 className 差异），可抽公共渲染函数。
- 无 P0/P1/P2。收藏状态查询失败被吞（50-52）符合"查询失败不阻塞页面"设计；toggle 失败有 toast 且 finally 复位 loading，错误处理完整。

## apps/edu/components/shared/form-field-row.tsx
无问题。

## apps/edu/components/shared/hover-action-bar.tsx
无问题（@zhiyu/ui re-export，单行）。

## apps/edu/components/shared/image-editor-dialog.tsx
- [P3][状态管理] image-editor-dialog.tsx:46,89 — `loaded` 状态跨 open 会话残留：关闭后重开（换图片）不会重新显示加载遮罩，仅凭 ImageEditor 内部行为；`src` 变化后旧 `loaded=true` 期间编辑器加载中无反馈。可 `useEffect` 在 `open/src` 变化时 `setLoaded(false)`。
- 无 P0/P1/P2。`handleFail` 返回函数适配 onLoadError/onError 签名正确；离线模式资源路径为注释承诺的部署约定。

## apps/edu/components/shared/image-list-upload.tsx
- [P2][数据丢失] image-list-upload.tsx:74-83 — `handleFiles` 直接 `queueRef.current = list.filter(...)` 覆盖队列：若用户在前一批文件仍在上传/正在编辑（editTarget 打开）时再次选择文件，前一批剩余文件被静默丢弃，且 `editTarget` 被新文件覆盖（正在编辑的图片在 `finishEdit` 时以新 target 回调，编辑结果写错对象）。最佳实践：追加队列 `[...queueRef.current, ...files]`，或在 `uploading || !!editTarget` 时拒绝选择。
- [P3][内存泄漏] image-list-upload.tsx:47-62,190-201 — 上传失败 fallback 的 `URL.createObjectURL(f)` 写入 value 后永不 revoke，组件卸载也不回收；多次失败上传累积 blob URL。
- [P3][状态管理] image-list-upload.tsx:99-101 — `addUrl` 使用 `value` 而非 `valueRef`，与上传路径（valueRef）不一致；父组件 onChange 异步落地时快速连续操作可能基于过期值追加。

## apps/edu/components/shared/image-upload-utils.ts
无问题（纯函数，判定简单正确）。

## apps/edu/components/shared/import-confirm-dialog.tsx
无问题（re-export）。

## apps/edu/components/shared/import-wizard-dialog.tsx
无问题（re-export）。

## apps/edu/components/shared/knowledge-selector.tsx
- [P2][并发竞态] knowledge-selector.tsx:204-230,243-264 — `handleSceneChange`/`handlePositionChange` 无序号/取消保护：快速连续切换场景或岗位时，先发出的请求后返回会覆盖后发请求的 `filterKpIds`（fetch 覆盖，筛选结果错乱）；搜索（158-177）有 `searchSeqRef` 保护而筛选没有。最佳实践：与搜索一致加 seqRef 比对或 AbortController。
- [P2][错误吞掉] knowledge-selector.tsx:355 — `handleSaveKp` 的 `onAddCustom?.(...)` 同步调用不 await：新建知识点名称与 pool 之外后端已有 KP 冲突时（findNameCollision 只查 pool/searchResults/selected，309-315 未覆盖懒加载的 allKps）后端返回 409，onAddCustom 的 rejection 无人捕获 → 未处理 Promise rejection、界面无提示。最佳实践：`await onAddCustom(...)` 并 catch 展示错误；或把冲突校验扩到 allKps。
- [P3][逻辑] knowledge-selector.tsx:34 — `generateKpCode()` 取 Date.now 后 6 位，高并发/快速创建可能撞码；后端无唯一约束兜底时可能重复。低概率可容忍。
- [P3][竞态] knowledge-selector.tsx:120-137 — 挂载时 courseApi/positionApi/scenarioApi 三个请求并行且无取消（组件卸载后 setState，React 18 不警告但浪费）；可忽略。

## apps/edu/components/shared/landing-filter-row.tsx
- [P3][useEffect] landing-filter-row.tsx:89-92 — overflow 检测依赖仅 `[items]`：窗口 resize / 字体缩放 / 展开后内容变化不重测，`expanded` 状态也不随 items 变化复位（换一组筛选后仍保持展开）。可加 resize listener 或依赖宽度。
- 无 P0/P1/P2。

## apps/edu/components/shared/landing-pagination.tsx
- [P3][逻辑] landing-pagination.tsx:65-78 — 页码生成规则：`totalPages <= 7` 时全量；`currentPage <= 3` 时 `[1,2,3,4,...,N]`，`currentPage >= N-2` 时 `[1,...,N-3,N-2,N-1,N]`，边界（N=8,9）时省略号区间与数字重叠（如 N=8、currentPage=4 → `1,...,3,4,5,...,8`，正确；N=8、currentPage=6 → `1,...,5,6,7,8`，无重叠）。无实际 bug，边界可读性一般。
- 无 P0/P1/P2。

## apps/edu/components/shared/landing-shell.tsx
- [P3][逻辑] landing-shell.tsx:190-195 — `onClearFilters` 未传时「清空筛选」按钮仍渲染（仅当 activeFilters 存在），点击无反应。可 `onClearFilters &&` 包裹。
- [P3][性能] landing-shell.tsx:56 — 组件未 memo，6 个业务模块 Landing 页每次父级渲染整树重建；hero/stats 为 props 引用，可接受。

## apps/edu/components/shared/log-table-shell.tsx
无问题。

## apps/edu/components/shared/major-select.tsx
- [P2][与后端契约] major-select.tsx:42-46 — `limit: 1000` 被后端 `ParsePageLimit` 钳制到 MaxPageSize=200（backend/internal/handler/common.go:126 `MaxPageSize = 200`），专业数 >200 时列表静默截断且无分页/提示。最佳实践：参照 knowledge-selector 的 `fetchAllPages` 分页拉全量，或显式注明 200 上限。
- [P3][错误处理] major-select.tsx:70-72 — 加载失败仅渲染错误文本，无重试入口（只有 tenantId 变化才重拉）；`loading` 期间 Select 禁用但错误时不渲染 Select，表单布局跳变。可加重试按钮。
- [P3][useCallback] major-select.tsx:38-59 — `loadMajors` 依赖 `t`，`t` 若每渲染新引用会导致 effect 重跑（当前 i18n provider 大概率稳定）；无实际风险。

## apps/edu/components/shared/mobile-tab-dropdown.tsx
- [P3][性能] mobile-tab-dropdown.tsx:38-45 — 每次 open 时重挂/卸载 document 级 mousedown listener，量级可忽略。
- 无 P0/P1/P2。

## apps/edu/components/shared/multi-org-node-picker.tsx
- [P3][命名风格] multi-org-node-picker.tsx:244-250 — `n.has(id) ? n.delete(id) : n.add(id)` 三目表达式当 if 用（无返回值副作用），可读性差；React StrictMode 下 double-invoke 无副作用问题（纯 Set 操作）。
- [P3][状态管理] multi-org-node-picker.tsx:268-272 — `handleConfirm` 确认后 `pendingIds` 置 null，但若父组件 onChange 是异步落地且用户在关闭动画期间再次打开，`[...value]` 可能是旧值 — 低概率。
- 无 P0/P1/P2。

## apps/edu/components/shared/org-node-picker.tsx
- [P3][健壮性] org-node-picker.tsx:212 — `disabled={disabled || !tenantId}`：未传 tenantId 时按钮静默禁用且无提示（配合 portal-sidebar-crud-page:574 的 P1 使用点），建议至少提供 disabled 提示或说明。
- 无 P0/P1/P2（组件自身逻辑：搜索展开/折叠/确认回填均正确）。

## apps/edu/components/shared/page-header-card.tsx
无问题。

## apps/edu/components/shared/pagination-bar.tsx
无问题。

## apps/edu/components/shared/platform-layout.tsx
- [P3][安全] platform-layout.tsx:48-58 — 无权限时 children 仍在 DOM 渲染（仅被 fixed 遮罩覆盖），敏感数据可能瞬时可见/可被脚本读取。可改为 `!allowed` 时渲染占位而非 children。
- 无 P0/P1/P2（重定向与权限判定逻辑正确）。

## apps/edu/components/shared/portal-crud-page.tsx
- [P2][逻辑] portal-crud-page.tsx:182-186,258-265 — 导入预览生成后打开确认弹窗；用户点「取消/关闭」确认弹窗后 `importPreview` 仍保留（不清空），无法再次打开确认弹窗（只有重新导入才触发 effect），且 `setImportFiles([])` 在向导关闭时清空导致重导需重新选文件。最佳实践：关闭确认弹窗时 `setImportFiles([])` 或保留 preview 可重开。
- [P3][类型] portal-crud-page.tsx:174-176 — `(importConfig?.importType || 'positions') as ...` 强制断言：importType 非法时静默退回 'positions' 模板，与目标实体不一致（下载错模板）。可显式校验枚举。
- [P3][状态管理] portal-crud-page.tsx:268-270 — `allSelected` 基于 `filteredItems`（服务端分页时仅当前页），跨页全选语义模糊（只选当前页）。设计取舍，可注明。
- [P3][重复请求] portal-crud-page.tsx:211-213 — `handleSave` 成功后 `await onRetry()`，若 `onSave` 内部已触发 refetch 则重复请求。可容忍。
- 无 P0/P1。

## apps/edu/components/shared/portal-sidebar-crud-page.tsx
- [P1][严重-功能不可用] portal-sidebar-crud-page.tsx:574-582 — 批量加入弹窗中的 `OrgNodePicker` 未传 `tenantId`，而 org-node-picker.tsx:212 `disabled={disabled || !tenantId}` 恒为 true → 「选择目标节点」按钮永远禁用，批量加入功能完全不可用（其他调用点如 teachers/page.tsx:383、timetable-view-tab.tsx:175 均显式传 tenantId，唯独此处遗漏）。最佳实践：在 PortalSidebarCrudPage 中从 useAuth 取 tenantId 传入，或把 orgNodePickerProps 扩展支持 tenantId。
- [P2][状态管理] portal-sidebar-crud-page.tsx:170,225-231 — `selectedIds` 在翻页/改搜索/改状态/改组织筛选后不清空：跨页残留选中，`toggleSelectAll` 的判定与替换只基于当前页 `filteredItems`（先选满第 1 页再翻到第 2 页，表头复选框表现为已全选但实际第 2 页未选；点击后清空全部含第 1 页），导出/批量加入的选中计数与所见不一致。最佳实践：筛选/翻页时清空 selectedIds，或全选语义改为跨页记录。
- [P3][错误处理] portal-sidebar-crud-page.tsx:271-285 — `confirmDelete` 成功无 toast；`deleting` 未跟踪（ConfirmDialog 无 pending），连点可重复调用 onDelete（后端幂等则无害）。且删除成功后 `selectedIds` 中的已删 id 未清除（计数残留）。
- [P3][死代码] portal-sidebar-crud-page.tsx:203-206 — 包在无 await 的 async IIFE 中同步 `setIsImportConfirmOpen(true)`（与 portal-crud-page 的 queueMicrotask 写法不一致），无实际 bug。
- 无 P0。

## apps/edu/components/shared/reset-password-dialog.tsx
- [P3][useEffect] reset-password-dialog.tsx:43-55 — 在 effect 内同步 setState（无 await 的 async IIFE），eslint react-hooks 会告警；实际行为正确（open 时重置表单）。
- [P3][契约] reset-password-dialog.tsx:20 — 前端密码规则 `8 位+字母+数字` 未与后端校验规则核对；若后端更严（如要求特殊字符）会以 400 错误展示后端 message，可接受。

## apps/edu/components/shared/resource-preview-modal.tsx
- [P3][性能] resource-preview-modal.tsx:289,875-883 — `memo` 无效：调用方传入内联 `onOpenChange={() => removePreviewResource(r.id)}`，每次父组件渲染新引用 → memo 形同虚设（多弹窗场景每次列表重渲染全量重绘）。
- [P3][逻辑] resource-preview-modal.tsx:291-311 — `usePreviewResources` 超 `max` 时 `next.shift()` 丢弃最旧：正在打开预览的弹窗也会被直接关闭（用户无感知丢失）。可改为拒绝新增或提示。
- [P3][契约] resource-preview-modal.tsx:32-36 — `buildKkFileViewUrl` 假定 fileUrl 为相对路径；绝对 URL（含域名）会拼出 `origin + https://...` 的非法 base64 地址导致 kkfileview 失败（依赖资源库只存相对路径的契约）。
- 无 P0/P1/P2（拖拽/缩放/分层 z-index 逻辑正确，drag 时 iframe pointer-events 处理到位）。

## apps/edu/components/shared/resource-selector.tsx
- [P2][数据一致性] resource-selector.tsx:342-365 — `resourceLibraryApi.create` 成功后（355-359）`courseResourceApi.bind`/`nodeResourceApi.bind` 失败时进入 catch 提示「资源保存失败」并 return，但资源已在资源库创建、文件已上传 → 用户重试会重复创建资源（无幂等/无回滚），库中残留孤儿资源。最佳实践：bind 失败时提示"资源已创建但绑定失败"，或提供删除已建资源的补偿。
- [P2][状态管理] resource-selector.tsx:367-368,375-377 — `useApi=false`（无 courseId/nodeId 的 standalone 场景）时上传仅走 `onUpload?.(newRes)`，`newRes` 不进 `mergedPool`，随后 `onChange([...selectedIds, newRes.id])` 后 `selectedResources` 按 id 在 mergedPool 查找失败 → 已选标签不显示刚上传的资源（依赖父组件把 onUpload 结果回填 externalPool 才能显示）。最佳实践：无论 useApi 与否都把 newRes 加入 internalPool。
- [P3][重复代码] resource-selector.tsx:298-307,379-388 — `fileTypes` 与 `fileTypesWithUpload` 两份完全相同的常量列表；`inferTypeFromName`（242-252）也重复判定扩展名。可合并为单一常量。
- [P3][i18n] resource-selector.tsx:337 — `uploadedBy: '当前用户'` 硬编码中文未走 `t()`（资源提供者列会显示中文原文，其他语言环境不一致）。
- [P3][重复请求] resource-selector.tsx:198-212 — 非 standalone 时 mount 即 loadResources，对话框打开又 load 一次（两个 effect 并行），打开瞬间可能双请求。可合并条件。
- [P3][内存] resource-selector.tsx:330-340 — 上传失败（fileApi.upload catch）时 `newResUploading=false` 提前 return，但已选文件状态保留，可接受。

## apps/edu/components/shared/schedule-grid.tsx
- [P3][逻辑] schedule-grid.tsx:176-195 — 同时提供 `getEntryHref` 与 `onEntryClick` 时，卡片被 Link 包裹且卡片 onClick 仍执行 onEntryMoveStart/onEntryClick（点击编辑与导航并存，行为取决于传入方）；href 分支未禁用卡片点击。调用方需自行保证二选一。
- [P3][逻辑] schedule-grid.tsx:11-19 — `if (!week) return entries`：week=0 视为"不过滤"，若业务周次从 0 计数会失效（当前契约从 1 开始，安全）。
- [P3][性能] schedule-grid.tsx:104-196 — `renderCard` 每次渲染重建（大课表渲染 7×N 个卡片可忽略）。
- 无 P0/P1/P2（cellMap/周次过滤/拖拽落点逻辑正确）。

## apps/edu/components/shared/status-action-bar.tsx
- [P3][逻辑] status-action-bar.tsx:24,143 — `EDITABLE_STATUSES` 含 'approved'（审批通过后可编辑，注释已声明意图）；`extraActions` 仅在可编辑状态渲染，而 `onClone`/`onInvite` 无条件渲染 — 语义自洽。
- 无 P0/P1/P2。

## apps/edu/components/shared/status-badge.tsx
无问题（re-export）。

## apps/edu/components/shared/table-row-actions.tsx
无问题（re-export）。

## apps/edu/components/shared/tag-badge.tsx
- [P3][契约] tag-badge.tsx:13-18 — `${tag.color}55`/`${tag.color}14` 透明度拼接要求 color 为 6 位 hex；8 位 hex、`#rgb` 或命名色会输出无效色值。依赖标签管理端固定输出 6 位 hex 的契约。

## apps/edu/components/shared/tag-filter-bar.tsx
- [P3][useEffect] tag-filter-bar.tsx:31-38 — overflow 检测依赖仅 `[tags.length]`：窗口 resize / 字体缩放不重测（与 landing-filter-row 同模式）；同一长度标签重载后（改名等）不重测。
- 无 P0/P1/P2（折叠/展开/清除逻辑正确）。

## apps/edu/components/shared/tag-picker.tsx
无问题。

## apps/edu/components/shared/theme-color-picker.tsx
- [P3][性能] theme-color-picker.tsx:69-74 — 手动输入每键触发 onChange（无防抖），若父组件在 onChange 内做重活（如即时提交预览）会频繁计算；当前仅 setState，可接受。
- 无 P0/P1/P2。

## apps/edu/components/shared/uncited-resources-dialog.tsx
- [P3][逻辑] uncited-resources-dialog.tsx:142-149 — 天数输入框允许任意文本：`Math.floor(Number('abc'))` 为 NaN，`Math.max(0, NaN)` 仍为 NaN → `format(addDays(date, -NaN))` 产出 'Invalid Date' 参数，后端 400 后仅展示错误 toast（无输入级拦截）。可加 `Number.isNaN` 防护。
- [P3][错误处理] uncited-resources-dialog.tsx:176-197 — `Promise.all` 批量删除部分失败时整体报错但部分已删，toast 文案与实际删除数不一致（小概率，项目原则容忍）。
- 无 P0/P1/P2（propsRef/nowRef 防循环设计正确，分页删除后页码收敛逻辑正确）。

## apps/edu/components/shared/user-selector.tsx
- [P2][与后端契约] user-selector.tsx:219,225 — `limit: 200` 静默截断用户列表：组织内用户 >200 时搜索/选择不到后续用户且无分页/提示。最佳实践：分页拉全量或加"仅显示前 200"提示。
- [P3][死代码] user-selector.tsx:434 — `<TableHead className="w-10">{multiple ? '' : ''}</TableHead>` 三元恒为空字符串，纯死代码。
- [P3][类型] user-selector.tsx:219,226-233 — `params: any`；过滤逻辑用 `(u.roleCodes || [])` 依赖后端返回 roleCodes 字段契约。
- [P3][状态管理] user-selector.tsx:155,288-290 — `selectedIds` 仅在打开对话框时与 value 同步；关闭期间外部 value 变化界面显示旧值（打开时修正）。可接受。

## apps/edu/components/shared/use-tag-bindings.ts
- [P3][竞态] use-tag-bindings.ts:16-36 — `loadBindings` 无竞态保护：快速连续调用（列表页翻页/刷新）时后发先返回会覆盖最新页的标签映射（页面可能短暂显示旧页标签）。当前为覆盖式 setState，最后一次 resolve 生效，风险低。
- [P3][错误吞掉] use-tag-bindings.ts:29-31 — 失败静默 `setTagsByResource({})`（列表页标签列空白无提示），符合"查询失败不阻塞页面"原则。

## apps/edu/components/shared/use-tags.ts
- [P2][状态管理-多实例串数据] use-tags.ts:9-11 — 模块级 `cachedTags` 未按租户 key 隔离：同一 SPA 内切换租户（多租户部署、超管切换组织上下文）会复用上一个租户的标签缓存直到 reload()，可能把 A 租户标签展示给 B 租户。最佳实践：缓存 key 加租户维度（如 `cachedTagsByTenant`）。
- [P3][错误处理] use-tags.ts:50-52 — 加载失败时 `loading=false` 但 `cachedTags` 仍为 null：组件显示空标签列表，effect（依赖 v）不会自动重试，仅 reload() 可恢复。可加失败标记驱动重试。
- [P3][并发] use-tags.ts:39-56 — 多个组件同时首挂载会并发发起重复请求（各自 effect 均看到 cachedTags===null），双请求浪费（数据一致无害）。

## apps/edu/components/shared/workflow-config-page.tsx
- [P2][与后端契约] workflow-config-page.tsx:74-88 — `workflowApi.list({ limit: 1000 })` 被后端钳制到 200（MaxPageSize），审批流程 >200 时列表截断且无分页提示。流程数通常较少，可接受但建议注明。
- [P2][重复提交] workflow-config-page.tsx:137-170 — `handleSave` 无 submitting 防重入：连点「创建流程」可重复创建（或重复 PUT）；保存按钮未 disabled。最佳实践：加 saving state 并禁用按钮。
- [P3][错误处理] workflow-config-page.tsx:167-169 — 保存失败仅 toast，`error` state（表单内联错误）不联动，WorkflowEditor 内 name 校验错误与请求错误两套展示并存；可统一。
- [P3][逻辑] workflow-config-page.tsx:251-262 — Tabs 仅当 `majors.length > 0` 时渲染；若某专业被禁用仍显示为筛选项（专业状态未过滤）。边缘。
- 无 P0/P1（创建/更新/删除流程的字段契约与后端 WorkflowRequest 一致：majorIds/status:active 均被后端接受）。

## apps/edu/components/shared/zip-preview.test.ts
无问题（测试构造与断言正确；`café.txt` 场景经 `>0xff` 判定正确走兜底路径）。

## apps/edu/components/shared/zip-preview.tsx
- [P2][性能] zip-preview.tsx:100-105 — 最大 50MB zip 在主线程 `unzipSync` 同步解压：大包解压期间 UI 完全冻结（移动端明显）。有 50MB 上限兜底，可接受，但可考虑 Worker。
- [P3][契约] zip-preview.tsx:116-121 — 加密包检测依赖 fflate 错误消息含 'encrypted' 子串，否则展示通用"解压失败"（提示不精确，可容忍）。
- [P3][内存] zip-preview.tsx:152-159 — `downloadEntry` 创建 blob URL 后 1 秒定时 revoke；快速连续点击下载时第二个 URL 可能已被 revoke（低概率）。
- 无 P0/P1（选中条目 blob URL 复用与卸载 revoke 正确，fixName 编码回退逻辑健壮）。

## apps/edu/components/theme-brand-sync.tsx
- [P3][错误处理] theme-brand-sync.tsx:25-30 — `fetchAndApplyBrandColor(...).then(...)` 无 `.catch`：当前 `fetchThemeColor` 内部已全面 try/catch（apps/edu/lib/theme-brand.ts:36-54 无抛错路径），风险低，但未来改动若引入抛错会形成未处理 rejection。
- 无 P0/P1/P2（缓存先应用避免闪烁、storage 事件与自定义事件同步、tenantId 变化重拉逻辑正确）。

## apps/edu/components/theme-provider.tsx
无问题（next-themes 薄封装）。

---

## 汇总统计

- 审查文件数：43
- 总问题数：70（P0: 0，P1: 1，P2: 14，P3: 55）

### P0
无。

### P1
1. portal-sidebar-crud-page.tsx:574-582（org-node-picker.tsx:212 联动）— 批量加入弹窗 OrgNodePicker 未传 tenantId，`disabled={disabled || !tenantId}` 恒真，按钮永远禁用，批量加入功能不可用。

### P2（14 条）
1. question-grading-card.tsx:150,163-175 — localScore 不随外部 score 同步，回显/还原陈旧值。
2. image-list-upload.tsx:74-83 — 二次选文件覆盖上传队列/编辑目标，前批文件静默丢失。
3. knowledge-selector.tsx:204-230,243-264 — 场景/岗位筛选无竞态保护，旧响应覆盖新筛选结果。
4. knowledge-selector.tsx:355 — 自定义知识点重名 409 时 onAddCustom rejection 未处理。
5. major-select.tsx:42-46 — limit 1000 被后端钳制 200，专业列表静默截断。
6. portal-crud-page.tsx:182-186,258-265 — 导入预览确认弹窗关闭后 preview 残留不可重开。
7. portal-sidebar-crud-page.tsx:170,225-231 — selectedIds 跨页/跨筛选残留，全选语义与展示不一致。
8. resource-selector.tsx:342-365 — 资源创建成功但 bind 失败时重复创建孤儿资源。
9. resource-selector.tsx:367-368,375-377 — 非 API 场景上传后已选标签不显示。
10. user-selector.tsx:219,225 — limit 200 用户列表静默截断。
11. use-tags.ts:9-11 — 模块级标签缓存未按租户隔离，切换租户串数据。
12. workflow-config-page.tsx:74-88 — workflow 列表 limit 1000 钳制 200 截断。
13. workflow-config-page.tsx:137-170 — handleSave 无防重入，连点重复创建。
14. zip-preview.tsx:100-105 — 50MB 主线程同步解压卡 UI。
