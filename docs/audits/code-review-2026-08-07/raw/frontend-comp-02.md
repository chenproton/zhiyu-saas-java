# 前端组件审查报告 frontend-comp-02（knowledge-graph / lesson / platform-shell / portal / providers / scene / shared 前半部分）

审查时间：2026-08-08 ｜ 审查方式：逐行完整通读（41 个文件）
后端契约核实：workflow status="active"（backend/internal/domain/unified.go:87）、NodeEvaluationResult.methodKey 格式 `${moduleKey}:${methodKey}`（backend/internal/store/node_evaluation_results.go:96 ON CONFLICT 同 key）、useT 稳定（locale-provider.tsx:76-80 useCallback）
结论：未发现 P0；发现 P1 1 条、P2 18 条、P3 若干。

---

## apps/edu/components/knowledge-graph/graph-data-context.tsx
无问题。

## apps/edu/components/knowledge-graph/types.ts
无问题。

## apps/edu/components/knowledge-graph/graph-node-detail.tsx
- [P3][i18n] graph-node-detail.tsx:145,176 — `|| '未命名能力'` 硬编码中文兜底，未走 t()，英文环境下显示中文。
- [P3][命名] graph-node-detail.tsx:214,265 — 回调参数 `(t) => {...}` 遮蔽外层 useT 的 `t`，易误用（当前未触发，纯隐患）；建议改名 task/kp。
- [P3][副作用] graph-node-detail.tsx:346-351 — `closeFrom` 在 setState updater 内部调用 `onClose()`（副作用进 updater），React 18 StrictMode 下 updater 双调用会重复执行 onClose；应把 onClose 提到 updater 外判断。
- [P3][渲染] graph-node-detail.tsx:332-339 — rootNode 变化后需经 useEffect+queueMicrotask 才更新 stack，首帧会短暂显示旧抽屉内容；queueMicrotask 无必要，直接 setState 即可。

## apps/edu/components/knowledge-graph/knowledge-graph-d3-view.tsx
- [P2][性能] knowledge-graph-d3-view.tsx:181-195,213-472 — ResizeObserver 每次尺寸变化都会触发全量重建（simulation 重启、节点位置/缩放丢失、fitTimer 重新执行）；窗口缩放/字体调整时图谱跳动明显。最佳实践：尺寸变化仅调整 svg viewBox，不重建 simulation；或将重建节流（requestAnimationFrame 合并）。
- [P2][残留渲染] knowledge-graph-d3-view.tsx:213-214 — `filteredNodes.length === 0` 直接 return 不清空 g 元素；节点数据由有变无时旧图残留（外壳层 emptyView 只在 nodes 初始为 0 时兜底）。最佳实践：空数据时 `g.selectAll('*').remove()`。
- [P3][冗余] knowledge-graph-d3-view.tsx:197 — `filteredNodes = useMemo(() => nodes, [nodes])` 无意义 memo。
- [P3][样式不一致] knowledge-graph-d3-view.tsx:419-426 vs 495-502 — 选中态下非关联节点 opacity 重建时为 0.12、样式 effect 为 0.35；数据重建后样式 effect 不重跑，两者不一致导致视觉抖动。
- [P3][硬编码] knowledge-graph-d3-view.tsx:571 — 自动聚焦视口按 DRAWER_W=400 预留，实际抽屉宽 380，compact 模式下也预留 400 偏移。
- [P3][类型] knowledge-graph-d3-view.tsx:263,272,281,292,311,389,396,402,410,419,423,428,435,448,462 — d3 回调大量 `any` 断言（d3 类型限制可接受，建议统一 SimNode 泛型）。

## apps/edu/components/knowledge-graph/knowledge-graph-shell.tsx
- [P3][i18n/语义] knowledge-graph-shell.tsx:65 — force 视图标签「力矩」语义可疑（力导向布局应为「力导向」/「动态」），疑为错别字。

## apps/edu/components/knowledge-graph/knowledge-graph-view.tsx
- [P2][性能] knowledge-graph-view.tsx:145-149 — filteredNodes/filteredEdges 每次渲染重建（未 memo），ReactFlow 每帧收到新引用触发全量 reconcile；connectedIds 已 memo，此处建议一并 useMemo。
- [P3][类型] knowledge-graph-view.tsx:144 — `rfRef = useRef<any>`。
- [P3][一致性] knowledge-graph-view.tsx:241-260 — fitView effect 的 connected 集合由原始 `edges` 计算（非 filteredEdges），数据含悬空边时行为与选中高亮不一致（轻微）。

## apps/edu/components/lesson/course-evaluation-rules-dialog.tsx
- [P3][状态管理] course-evaluation-rules-dialog.tsx:50-63,106-113 — 编辑器渲染的是 memo 派生的 `config`（initialConfig 合并），`liveConfig` 仅用于权重校验；若父组件不把 onChange 结果回灌 initialConfig，编辑内容在父级重渲染时会丢失。当前调用方（EvalMethodConfigModule）满足契约，但组件自身不兜底，属脆弱接口。
- [P2][提交/保存] course-evaluation-rules-dialog.tsx:119-135 — 对话框「保存」仅校验权重并关闭，真实持久化依赖父级 onChange 链路，保存失败无提示、错误不透传；若父级未保存，用户看到的是"已保存"的假象。

## apps/edu/components/lesson/student/hybrid-modules-view.tsx
- [P2][错误被吞] hybrid-modules-view.tsx:251-257 — `evalRuleConfigToMethods(ruleConfig)` 异常被 try/catch 吞掉 → methods=[] → 整个评价模块卡片静默消失，无任何提示；规则数据损坏时学生端完全无感知。最佳实践：catch 后至少渲染「评价规则异常」占位。
- [P3][死代码] hybrid-modules-view.tsx:422-426 — `m.moduleKey === 'homeworks'` 分支不可达（homeworks 在 HYBRID_EVAL_MODULE_LABELS 中已走 EvalModuleCards 分支）。
- [P3][性能] hybrid-modules-view.tsx:452-464 — activityModules 每次渲染 filter+sort 重建新数组，phaseModules 的 useMemo 实际失效。
- [P3][key 冲突] hybrid-modules-view.tsx:472-479 — handlePreview 以 `attachment-${url}` 作 id，同一 URL 多附件会 key 冲突、remove 误删多个。

## apps/edu/components/lesson/student/knowledge-graph.tsx
- [P3][类型] knowledge-graph.tsx:54 — `kp as KnowledgePoint` 强转，建议 node.knowledgePoints 类型与 KnowledgePoint 对齐。

## apps/edu/components/platform-shell/index.ts
无问题（纯转发）。

## apps/edu/components/platform-shell/PlatformShell.tsx
- [P3][防御] PlatformShell.tsx:33 — `config.sideNavItems.map` 无 `?.` 保护，配置缺该字段即运行时崩溃（依赖 PlatformNavigationConfig 类型必填约束）。

## apps/edu/components/portal/footer.tsx
- [P3][内容] footer.tsx:45-65,83 — 生产页硬编码占位数据：热线 400-888-8888、support@example.com、XX职业技术学院、张老师、0000-12345678、软件著作权 2020SR0123456、京ICP 占位号；上线前应替换为真实信息或配置化。

## apps/edu/components/portal/mobile-access-dialog.tsx
无问题。

## apps/edu/components/portal/mobile-access-url.test.ts
无问题。

## apps/edu/components/portal/mobile-access-url.ts
无问题。

## apps/edu/components/portal/top-nav.tsx
- [P3][性能] top-nav.tsx:96-108 — useLayoutEffect 依赖每秒变化的 currentTime，隐藏逻辑每秒全量重算（开销小但多余）；建议仅当 isLoggedIn/level/容器尺寸变化时计算。
- [P3][a11y] top-nav.tsx:253-310 — DropdownMenuItem（menuitem）内嵌套 Button 交互控件，键盘导航/读屏语义冲突；语言/字号切换建议改为菜单项点击或菜单外独立控件。

## apps/edu/components/portal/yi-know-assistant.tsx
- [P1][状态管理] yi-know-assistant.tsx:622-634 — 发送后的 800ms setTimeout 无任何清理；用户点「返回导航面板」（handleCloseChat）或关闭面板后，定时器仍会追加 assistant 消息 → 已清空的聊天区"复活"并自动切回聊天视图，展示一条用户已放弃的回复。最佳实践：保存 timer ref，在 handleCloseChat/handleOpenChange(false)/unmount 时 clearTimeout；回复回调前校验面板仍开启且 chatMessages 未被清空。
- [P3][交互] yi-know-assistant.tsx:758-764 — 聊天中点击推荐卡片仅 setActiveTab/expand，聊天视图不退出，用户看不到 tab 变化；建议点击推荐后同步 handleCloseChat 回到资源面板。

## apps/edu/components/providers/data-provider.tsx
- [P2][部分失败不一致] data-provider.tsx:244-250 — updateExamStatus submit 流程：`examApi.submit` 成功后 `approvalApi.create` 失败 → 试卷已提交但审批记录缺失，仅向调用方抛通用错误，无补偿/重试。最佳实践：approval create 失败时提示已提交但审批未建，或先建审批再提交。
- [P2][静默 no-op] data-provider.tsx:257-270 — approve/reject 时查不到 pending 审批记录则静默跳过（仅刷新列表），用户点「通过」无任何反馈。建议无记录时 toast 提示。
- [P3][静默] data-provider.tsx:187-188 — moveQuestions 目标批次不存在时静默 return，调用方无感知。
- [P3][数据语义] data-provider.tsx:22 — `parseDate(undefined)` 回退 `new Date()`，缺失的 createdAt/updatedAt 显示为当前时间，具有误导性。

## apps/edu/components/scene/scenarios/scenario-list.tsx
- [P3][类型] scenario-list.tsx:33 — `tasks?: { length: number }` 结构怪异，仅为取 length 设计类型。

## apps/edu/components/scene/student/knowledge-graph.tsx
- [P3][性能] knowledge-graph.tsx:23-28 — nodeLabels 对象每次渲染重建（传给 shell 后无 memo 保护）。

## apps/edu/components/scene/student/scene-card.tsx
- [P3][安全/样式] scene-card.tsx:37 — coverImage 直接拼入 `url('...')`，含引号等字符可破坏样式注入（管理员可控内容，低风险）。
- [P3][死代码] scene-card.tsx:17-27 — industryTagMap/professionTagMap 仅含 default 项，映射表结构无意义。

## apps/edu/components/shared/alliance-detail-shell.tsx
- [P3][模式] alliance-detail-shell.tsx:49-56 — render 阶段条件 setState 派生 URL tab 状态（合法 React 模式但非常规，React Compiler 下易触发警告）；建议改用「key 或受控重挂载」或 useSyncExternalStore 方案。

## apps/edu/components/shared/approval-list-page.tsx
- [P3][类型] approval-list-page.tsx:32,39,46 — `records: any[]`、`mapRecord: (record: any) => T` 全 any，泛型约束形同虚设。
- [P3][性能] approval-list-page.tsx:89 — useMemo 依赖 mapRecord，父级内联传参时每次重算（轻微）。

## apps/edu/components/shared/archive-list-page.tsx
- [P2][状态管理] archive-list-page.tsx:91,103-120,215-248 — 搜索/侧栏筛选变化时不清空 selectedIds：批量操作可作用于不在当前列表中的条目（筛选后残留选择）；且批量操作异常抛出时（无 try/catch）选择同样被清空，用户丢失选择。最佳实践：onSearchChange/onSidebarSelect 时联动清空选择；批量操作失败时保留选择并提示。

## apps/edu/components/shared/batch-group-page.tsx
- [P3][并发] batch-group-page.tsx:183-207,217-237 — 创建/保存按钮无进行中锁，双击可重复提交创建两个批次（代码生成依赖 Math.random，重复创建概率真实存在）。
- [P3][竞态] batch-group-page.tsx:151-159 — loadData 无取消标记，卸载/快速切换时 setState 落在已卸载组件（React 18 无警告但不规范）。

## apps/edu/components/shared/batch-selector.tsx
- [P2][依赖不稳定] batch-selector.tsx:40-45 — useEffect 依赖 `batchApi` 对象身份：调用方若传内联对象，每次渲染触发重新请求 → setState → 父级重渲染 → 新对象 → 再请求，形成拉取循环；且无 cancelled 清理。最佳实践：调用方 memo 化 API 对象，或组件内部以字符串 key 依赖。

## apps/edu/components/shared/brand-relation-select.tsx
无问题（含 cancelled 清理，依赖为 string fetchUrl 稳定）。

## apps/edu/components/shared/citation-stats-panel.tsx
- [P2][错误被吞] citation-stats-panel.tsx:62-69 — fetchStats 失败静默 setStats(null)，页面显示 '-' 无任何错误提示；建议至少 console/reportError 留痕。
- [P3][类型] citation-stats-panel.tsx:148 — Tooltip formatter 参数 `value: any`。

## apps/edu/components/shared/combobox-select.tsx
无问题（转发 @zhiyu/ui）。

## apps/edu/components/shared/_components/approval-dialogs.tsx
- [P2][错误处理] approval-dialogs.tsx:142-153 — confirmApprove/confirmReject 的 `await onApprove/onReject` 无 try/catch：API 失败时异常上抛（父级未捕获即 unhandled rejection），弹窗保持打开但无任何错误提示，用户可无感知重试导致重复提交。最佳实践：catch 后在对话框内展示错误文案。
- [P3][语义] approval-dialogs.tsx:62 — `(h.action || h.status) === 'approved'` 字符串比较依赖后端字段值约定，建议与后端枚举对齐并注释。

## apps/edu/components/shared/_components/org-filter-tree.tsx
- [P3][a11y] org-filter-tree.tsx:41-64 — div[role=button] 内嵌套 button 控件（嵌套交互元素），键盘/读屏冲突；折叠按钮建议移到 row 内独立定位。

## apps/edu/components/shared/_components/workflow-editor.tsx
- [P3][类型] workflow-editor.tsx:149 — `ids as any` 强转 UserSelector onChange。

## apps/edu/components/shared/confirm-dialog.tsx
无问题（转发 @zhiyu/ui）。

## apps/edu/components/shared/content-list-page.tsx
- [P2][并发竞态] content-list-page.tsx:460-464 — loadData 无取消/序号保护，reloadKey 连续 bump（连续操作触发 refresh）时多个请求并发，先发的慢响应可能覆盖后发的新数据，列表回退到旧状态。
- [P2][UX] content-list-page.tsx:399 — 每次 loadData 都 `setExpandedBatches(全部展开)`，用户折叠状态在每次操作后的 refresh 中丢失。
- [P2][逻辑 bug] content-list-page.tsx:792-810 — CSV 导出 `importExportApi.export(exportEntityName)` 不带选中 ids，导出全部数据；而按钮文案/禁用态为"选中项导出"（Excel 路径 exportXxxExcel(selectedIds) 是正确的），行为与语义不符。
- [P2][部分失败不一致] content-list-page.tsx:600-612,969-983,990-1009 — 提交审批均为"先 submit 再 approvalApi.create"两步：第二步失败时实体已进入 pending 但无审批记录，仅 toast 错误；用户重试又会触发 submit → pending→pending 后端 400。最佳实践：create 失败时提示"已提交但审批未创建，请勿重复提交"或后端合并为单接口。
- [P3][死代码/冗余] content-list-page.tsx:316-317,904-911 — cloneTarget 采用 ref+state 双写冗余（state 仅触发渲染，值一律读 ref）。
- [P3][文件选择] content-list-page.tsx:1813-1819 — CSV input 选择后未重置 value，同一文件二次选择不触发 onChange。
- [P3][类型] content-list-page.tsx:94,102 — ContentApi create/update 载荷 `any`（注释说明了 Omit 差异，可接受）。

## apps/edu/components/shared/cover-image-upload.tsx
- [P3][内存泄漏] cover-image-upload.tsx:50,56 — editTarget 的 objectURL 仅在 finishEdit 时 revoke，组件卸载/导航离开时泄漏。
- [P3][i18n] cover-image-upload.tsx:123 — `label.replace('封面', '')` 中文硬编码字符串处理，label 不含「封面」时文案错误。

## apps/edu/components/shared/date-range-picker.tsx
- [P3][初始化] date-range-picker.tsx:90 — defaultMonth 仅首次挂载生效，外部 value 变化后日历月视图不同步（轻微）。

## apps/edu/components/shared/editor-shell.tsx
无问题。

## apps/edu/components/shared/error-state.tsx
无问题（转发 @zhiyu/ui）。

## apps/edu/components/shared/eval-method-card.tsx
- [P2][后端契约] eval-method-card.tsx:326-329 — 提交载荷 `maxScore: 100` 硬编码；后端按 max_score 计分/展示（packages/api-client lesson.ts:249-251），若测评配置最大分 ≠ 100（如 50 分制），成绩与展示错位。最佳实践：从 method.resourceConfig/规则配置取 maxScore，缺省再回退 100。
- [P3][硬编码] eval-method-card.tsx:331,333 — `attempts: 1` 硬编码进 subjectiveContent。
- [P3][类型] eval-method-card.tsx:42,48,53,141,142 — 视图模型多处 `any`。

## apps/edu/components/shared/eval-method-config-module.tsx
- [P3][类型/防御] eval-method-config-module.tsx:69 — 部分配置 `value as EvalRuleConfig` 直接当全量使用，深层字段（methodWeights/methodEvalSubjects 等）可能 undefined，依赖下游默认值防御；建议用 makeDefaultEvalRuleConfig 合并补齐。

## apps/edu/components/shared/eval-method-selector.tsx
- [P3][性能] eval-method-selector.tsx:176-181 — methodOptions 每次渲染重建（含 12 项 label/desc 翻译映射）。
