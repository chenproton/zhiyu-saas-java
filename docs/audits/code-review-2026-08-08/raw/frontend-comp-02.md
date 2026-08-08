# 前端 components 层复查（第二轮）— 2026-08-08

复查范围：`apps/edu/components` 下 43 个文件（`/tmp/opencode/c2-ab` 列表）。
重点：已修项回归（yi-know-assistant 定时器、content-list-page 竞态、知识图谱）、上轮遗漏、新问题。
已修项回归结论：**yi-know-assistant 定时器（unmount/close 清理）✓、content-list-page loadSeq 竞态守卫 + batchSubmitLock ✓、知识图谱抽屉/工具函数 ✓，均未回归**。

## apps/edu/components/knowledge-graph/graph-data-context.tsx
无问题

## apps/edu/components/knowledge-graph/graph-node-detail.tsx
- [P3][死代码] graph-node-detail.tsx:14-18 — `COURSE_TYPE_LABEL` 仅 'course' 键可达，'material'/'quiz' 分支无 GraphNode.type 可命中（`node.type` 枚举只有 course），属预留死分支；最佳实践：删除或用真实资源类型字段区分
- [P3][状态管理] graph-node-detail.tsx:332-337 — `GraphDetailStack` 的 `rootNode` 由父组件每次渲染内联新建对象（d3-view:736、view:377），effect 依赖 `[rootNode]` 导致父组件任何无关重渲染（resize/高亮变化）都会重置抽屉导航栈；最佳实践：父组件用 `useMemo` 稳定 rootNode 引用，或 effect 改依赖 `rootNode?.id`
- [P3][契约] graph-node-detail.tsx:306 — `t(COURSE_TYPE_LABEL[node.type])` 直接把中文当 i18n key 再 t() 一次，双重翻译绕圈；最佳实践：course 类型直接映射常量文案

## apps/edu/components/knowledge-graph/knowledge-graph-d3-view.tsx
- [P2][状态管理/竞态] knowledge-graph-d3-view.tsx:474-516 — 第二个样式 effect 会在主绘制 effect 之后无条件覆盖 circle 的 `fill/stroke/stroke-width`（回到 TYPE_META 普通配色），使主 effect 中针对 `highlightNodeIds` 的红色渐变/红描边/加宽高亮（:313-329）全部失效；若未来任何页面启用 highlightNodeIds（当前 KnowledgeGraphShell 未透传、无调用方，功能休眠），红色高亮将不可见，仅剩透明度区分；最佳实践：样式 effect 内同样处理 highlight 分支，或高亮样式集中到单一 effect 管理
- [P3][性能] knowledge-graph-d3-view.tsx:197 — `filteredNodes = useMemo(() => nodes, [nodes])` 无意义包装；最佳实践：直接使用 nodes
- [P3][契约] knowledge-graph-d3-view.tsx:571 — 抽屉宽度硬编码 400，实际抽屉 380（graph-node-detail DRAWER_W），自动聚焦视口计算与抽屉宽度不一致（380px 抽屉被按 400 让位）；最佳实践：共享常量

## apps/edu/components/knowledge-graph/knowledge-graph-shell.tsx
无问题

## apps/edu/components/knowledge-graph/knowledge-graph-view.tsx
- [P3][状态管理] knowledge-graph-view.tsx:375-382 — 同 graph-node-detail:332，rootNode 每渲染新建对象，父组件无关重渲染会重置抽屉栈；最佳实践：稳定 rootNode 引用
- [P3][一致性] knowledge-graph-view.tsx:250-253 — fitView effect 使用未过滤的 `edges` prop 计算关联节点，与 `filteredEdges`（:147）口径不一致（悬挂边场景下聚焦结果可能不同）；最佳实践：统一用 filteredEdges

## apps/edu/components/knowledge-graph/types.ts
无问题

## apps/edu/components/lesson/course-evaluation-rules-dialog.tsx
无问题

## apps/edu/components/lesson/student/hybrid-modules-view.tsx
- [P3][死代码] hybrid-modules-view.tsx:422-426 — `m.moduleKey === 'homeworks'` 分支不可达：homeworks 在 `HYBRID_EVAL_MODULE_LABELS`（:44）中，:328-342 已先行路由到 `EvalModuleCards`；最佳实践：删除该分支
- [P3][错误被吞] hybrid-modules-view.tsx:252-256 — `evalRuleConfigToMethods` 异常被 catch 置空列表，无任何日志/降级提示；最佳实践：reportError 记录原始错误

## apps/edu/components/lesson/student/knowledge-graph.tsx
无问题

## apps/edu/components/platform-shell/index.ts
无问题

## apps/edu/components/platform-shell/PlatformShell.tsx
无问题（`useT` 由 useCallback 按 locale 稳定化（locale-provider.tsx:76-80），translatedConfig memo 依赖安全）

## apps/edu/components/portal/footer.tsx
- [P3][死代码/占位] footer.tsx:19-24,48-56,73-79 — 「访问官网/使用手册/常见问题/隐私政策/用户协议」均为 `href="#"` 死链；最佳实践：接入真实路由或隐藏

## apps/edu/components/portal/mobile-access-dialog.tsx
- [P3][性能/响应性] mobile-access-dialog.tsx:21-28 — 渲染期直接读 `window.location`（非响应式），弹窗打开期间若路由变化二维码不会更新；边缘场景可容忍；最佳实践：改为 state + effect 监听

## apps/edu/components/portal/mobile-access-url.test.ts
无问题

## apps/edu/components/portal/mobile-access-url.ts
无问题

## apps/edu/components/portal/top-nav.tsx
无问题（回归通过：时钟定时器含 visibilitychange 节流 + cleanup；溢出折叠逻辑收敛于 fit 条件，无死循环）

## apps/edu/components/portal/yi-know-assistant.tsx
- [P2][交互失效/状态管理] yi-know-assistant.tsx:774-781 — 聊天气泡内点击「为你推荐」资源卡片仅 setActiveTab/setExpandedIds，而 `isChatMode = chatMessages.length > 0 || isTyping`（:540）不会因此退出，界面仍停留在 chatView，用户点击无任何可见反馈（预期切回资源列表并展开该卡片）；最佳实践：点击推荐时调用 handleCloseChat 或新增「返回导航面板」行为
- [P3][性能] yi-know-assistant.tsx:504-538 — filteredResources 每次输入变化对全量 RESOURCES 过滤/排序，数据规模小可容忍；最佳实践：数据量增长后抽常量表

## apps/edu/components/providers/data-provider.tsx
- [P2][竞态/卸载] data-provider.tsx:108-131 — `cancelled` 仅保护 reportError/setEvaluationLoading，`loadQuestionBanks/loadExams` 内部的 setQuestionBanks/setExams（:89,:103）不受保护：路由快速切换（isPortal 条件翻转）时旧请求响应会写入新页面状态，且卸载后 setState；最佳实践：loadXxx 返回后统一过 cancelled 检查
- [P3][契约/错误路径] data-provider.tsx:244-251 — updateExamStatus('submit') 中 submit 成功但 approvalApi.create 失败时，试卷已提交却未创建审批记录，非事务操作；错误虽会抛出给调用方，但状态已部分变更；最佳实践：后端提供原子接口或前端补偿撤回

## apps/edu/components/scene/scenarios/scenario-list.tsx
无问题

## apps/edu/components/scene/student/knowledge-graph.tsx
无问题（edge 去重、空数据 emptyView 处理完备）

## apps/edu/components/scene/student/scene-card.tsx
无问题

## apps/edu/components/shared/alliance-detail-shell.tsx
- [P3][状态管理] alliance-detail-shell.tsx:49-56 — 渲染期直接调用 setState 同步 urlTab（render-phase state adjustment），React 允许但有额外渲染开销且需精确守卫；当前守卫正确，可接受；最佳实践：如未来复杂化改回 useEffect

## apps/edu/components/shared/approval-list-page.tsx
- [P2][防重复] approval-list-page.tsx:230-234 + approval-dialogs.tsx:142-153 — 通过/驳回按钮在审批请求执行期间无 pending/loading 禁用，快速双击会重复调用 onApprove/onReject（后端可能二次审批报错或重复流转）；最佳实践：useApprovalDialogs 内部增加 submitting 状态禁用按钮

## apps/edu/components/shared/archive-list-page.tsx
无问题

## apps/edu/components/shared/batch-group-page.tsx
- [P3][一致性] batch-group-page.tsx:188-193 — 批次编号 `BG-年份-4位随机`，同秒多次创建有碰撞可能（虽概率低）；最佳实践：后端生成或加时间戳
- [P3][竞态/卸载] batch-group-page.tsx:151-159,100-123 — `cancelled` 仅检查于 await 前，loadData/setMajors 在卸载后仍可能 setState；最佳实践：与 data-provider 相同模式，setState 前复查 cancelled

## apps/edu/components/shared/batch-selector.tsx
- [P3][竞态/卸载] batch-selector.tsx:40-45 — effect 无 cancelled 守卫，卸载后 setBatches（React 18 后无警告但存在覆盖风险）；最佳实践：参照 brand-relation-select.tsx 加 cancelled
- [P3][契约] batch-selector.tsx:51 — `value || '__none__'`：当 value 指向尚未加载完成的批次 id 时 Radix Select 显示空值，加载完成后才回显；可接受，仅提示

## apps/edu/components/shared/brand-relation-select.tsx
无问题（cancelled 守卫完整，含 finally 处理）

## apps/edu/components/shared/citation-stats-panel.tsx
无问题（首载用 Promise.resolve().then 规避 effect 内同步 setState；onDeleted 联动刷新正确）

## apps/edu/components/shared/combobox-select.tsx
无问题

## apps/edu/components/shared/_components/approval-dialogs.tsx
- [P2][防重复] approval-dialogs.tsx:142-153 — `confirmApprove/confirmReject` 无 pending 状态，双击可重复提交（同 approval-list-page:231 一并修复）；最佳实践：按钮增加 loading 并 disable

## apps/edu/components/shared/_components/org-filter-tree.tsx
无问题

## apps/edu/components/shared/_components/workflow-editor.tsx
- [P3][类型] workflow-editor.tsx:149 — `ids as any` 绕过 UserSelector onChange 类型；最佳实践：收敛泛型签名

## apps/edu/components/shared/confirm-dialog.tsx
无问题

## apps/edu/components/shared/content-list-page.tsx
- [P2][竞态] content-list-page.tsx:400-413 — `setBatches/setExpandedBatches/setMajors/setWorkflows` 在 `loadSeq` 守卫（:453）之前无条件执行，快速连续 refresh 时旧请求的批次/专业列表可覆盖新请求结果（frontItems 已正确受守卫）；最佳实践：将全部 setState 移到 loadSeq 校验之后
- [P3][状态残留] content-list-page.tsx:1999-2022 — 克隆重命名弹窗点「取消」时 cloneTargetRef/cloneRenameValueRef 未清理（确认成功路径已清理），若目标被删除则 ref 指向失效对象（下次 clone 前无实际危害）；最佳实践：取消时同步清理
- 回归确认：loadSeq 竞态守卫（:452-463）、batchSubmitLock 防重复提交（:592-623）、mapItemRef 等 ref 化（:335-346）均正常

## apps/edu/components/shared/cover-image-upload.tsx
- [P3][内存泄漏] cover-image-upload.tsx:50-56 — `URL.createObjectURL` 仅在编辑完成/取消时 revoke，若用户在编辑弹窗打开期间卸载组件则对象 URL 泄漏；最佳实践：unmount 时兜底 revoke

## apps/edu/components/shared/date-range-picker.tsx
无问题（min=2 保证首点只选开始日期，语义正确）

## apps/edu/components/shared/editor-shell.tsx
无问题

## apps/edu/components/shared/error-state.tsx
无问题

## apps/edu/components/shared/eval-method-card.tsx
- [P2][错误被吞] eval-method-card.tsx:299-312 — `handleFileUpload` 中 `onFileUpload` 失败（reject）无任何捕获/提示，仅 finally 复位 uploading，产生 unhandled rejection 且用户无感知；最佳实践：catch 后 setError 展示
- [P3][契约] eval-method-card.tsx:328 — 提交 payload 硬编码 `maxScore: 100`，与后端/result.maxScore 口径可能不一致；最佳实践：从 resourceConfig/result 读取

## apps/edu/components/shared/eval-method-config-module.tsx
- [P3][契约] eval-method-config-module.tsx:32-70 — `value` 为 `Partial<EvalRuleConfig>` 时直接 as 返回，不合并默认字段（缺 methodWeights 等时下游 undefined 读属性），依赖上游始终给全量；最佳实践：与 DEFAULT 深合并

## apps/edu/components/shared/eval-method-selector.tsx
无问题

---
## 汇总

- 审查文件数：43
- 问题总数：22（P0: 0，P1: 0，P2: 6，P3: 16）
- P0：无
- P1：无
- P2 摘要：
  1. yi-know-assistant.tsx:774-781 推荐卡片点击在聊天模式下无可见反馈（状态已设但界面不切换）
  2. knowledge-graph-d3-view.tsx:474-516 样式 effect 覆盖主绘制的高亮样式（当前 highlightNodeIds 无调用方，休眠功能）
  3. data-provider.tsx:108-131 loadXxx 的 setState 不受 cancelled 保护（卸载/路由切换竞态）
  4. content-list-page.tsx:400-413 setBatches/majors 在 loadSeq 守卫前（列表已修复，批次/专业仍可能被旧响应覆盖）
  5. eval-method-card.tsx:299-312 文件上传失败错误被吞（无提示 + unhandled rejection）
  6. approval-list-page.tsx:231 / approval-dialogs.tsx:142-153 审批确认无 pending 禁用，双击可重复提交
- 上轮已修项（定时器、列表竞态、图谱）复查均无回归。
