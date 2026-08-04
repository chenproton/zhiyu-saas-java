# 前端 components 批次2 审查（46文件，10916行）

## P1
```
apps/edu/components/shared/content-list-page.tsx:992-1009 | P1 | 逻辑bug | CSV 导入路径（hasExcel=false）发现重复时 setImportPreview(preview)，但确认弹窗只在 effect 338-344 且 hasExcel 为 true 时打开，导致 isImportConfirmOpen 永不为 true，重复导入确认弹窗永不弹出、导入流程卡死 | 移除 effect 中的 hasExcel 门控，统一在 importPreview 设置时打开确认弹窗
```

## P2（摘要）
```
apps/edu/components/shared/alliance-detail-shell.tsx:47-54 | P2 | 逻辑bug | prevUrlTab 初始值取当前 urlTab，首屏带 ?tab=b 进入时 urlTab === prevUrlTab 不触发同步，activeTab 停留在 defaultTab | 初始化时先校验 urlTab 合法性再作为默认值
apps/edu/components/shared/schedule-grid.tsx:141-153,179-189 | P2 | DOM结构 | onEntryClick 与 onEntryMoveStart 同时存在时卡片内含 button 又被外层 button/a 包裹，非法嵌套 HTML | 外层改 div + 事件委托
apps/edu/components/shared/multi-org-node-picker.tsx:84-96 | P2 | 逻辑bug | 搜索时 expanded 未随 searching 强制展开，折叠节点下匹配子节点被隐藏（对比 org-node-picker.tsx:58 已处理）| 搜索态 expanded 改为 searching || !collapsedIds.has(id)
apps/edu/components/shared/_components/approval-dialogs.tsx:127-138 | P2 | 错误处理 | confirmApprove/confirmReject 无 try/catch：失败无提示、未处理 rejection | 包 try/catch，禁用确认按钮
apps/edu/components/shared/image-list-upload.tsx:42-44,144 | P2 | 稳定性 | 上传失败回退 blob URL 永不 revoke（内存泄漏），随表单保存后 blob URL 失效 | 失败提示并移除项
apps/edu/components/shared/content-list-page.tsx:540-569 | P2 | 数据一致性 | doBatchSubmit 中 itemApi.submit 成功但 approvalApi.create 失败，条目 pending 但无审批单（悬空状态）| create 失败对该条 withdraw 补偿
apps/edu/components/shared/_components/workflow-editor.tsx:26-35 + workflow-config-page.tsx:135-168 | P2 | 表单校验 | buildWorkflowSteps 只过滤空名称，未校验 approverIds 为空，可创建无审批人流程 | 校验每步至少一个审批人
apps/edu/components/shared/batch-group-page.tsx:181-227,344,363 | P2 | 数据一致性 | 创建/编辑/状态切换无 submitting 态可重复创建；code 随机 4 位易碰撞 | 提交中禁用；code 用时间戳+随机
apps/edu/components/shared/knowledge-selector.tsx:340-353,130-138 | P2 | 逻辑bug | positionFilter 有 UI 但完全未参与过滤（死筛选）；SCENE_KNOWLEDGE_MAP 硬编码 kp-1~kp-10 | 实现过滤或移除；场景映射改服务端过滤
apps/edu/components/shared/knowledge-selector.tsx:216-226 | P2 | 数据一致性 | 新建/克隆知识点用本地 kp-custom-${Date.now()} id，与服务端创建结果不一致（重复创建/id 失联）| 由服务端返回 id
apps/edu/components/shared/portal-sidebar-crud-page.tsx:217-226,186 | P2 | 数据一致性 | 服务端分页（items 仅当前页）却做客户端搜索/状态过滤，total 与服务端不一致，搜索跨页失效 | 过滤下沉到服务端
apps/edu/components/shared/resource-preview-modal.tsx:30-34,250 | P2 | 稳定性 | buildKkFileViewUrl 在渲染期对 origin+fileUrl 执行 btoa，含中文文件名非 Latin-1 字符抛异常崩溃 | encodeURIComponent/unescape+btoa
apps/edu/components/shared/org-filter-tree.tsx、org-node-picker.tsx、multi-org-node-picker.tsx、user-selector.tsx | P2 | 性能 | 组织树递归组件均无 memo，大组织树任意 toggle 全量递归重建 | React.memo / 虚拟化
```

## P3（摘要）
```
content-list-page.tsx:241,260,273,587,1423,1429,1369-1418,1461,346-420 | P3 | 死代码/类型/性能/稳定性 | setItems 等只写不读；batchId! 断言；Excel 导出与 CSV 语义不一致；group 视图重复渲染 renderList；loadData 依赖 api 对象引用 | 修正
archive-list-page.tsx:128 | P3 | 逻辑bug | colspan = columns.length + (hasBatchOps?2:1)，实际 +3/+2，loading/empty 行 colspan 恒少 1 | 修正
portal-crud-page.tsx:283-288,350-419 | P3 | DOM结构/组件API | Link 包裹 Button 非法嵌套；提供 body 时分页/页脚静默消失 | 修正
user-selector.tsx:422,213-239 | P3 | 死代码/稳定性 | TableHead 恒空内容；loadUsers 无竞态防护 | 修正
resource-selector.tsx:304,385,348-371,557-601,176 | P3 | 死代码/一致性/逻辑 | fileTypesWithUpload 重复定义；bind 失败资源残留；已选计数与显示不一致；node- 前缀启发式脆弱 | 修正
major-select.tsx:47,68-70 | P3 | 错误处理 | 展示原始 err.message 无重试 | 通用文案+重试
batch-selector.tsx:35-40 | P3 | 稳定性 | 无 cancelled 清理 | 加守卫
workflow-config-page.tsx:166 | P3 | 错误处理 | toast 直接暴露 err.message | 兜底文案
eval-method-config-module.tsx:28-66 | P3 | 类型安全 | Partial 强转全量，下游可能 undefined | 深合并
knowledge-selector.tsx:844-847,30-32,152 | P3 | 类型/一致性 | gl! 非空断言；generateKpCode Date.now().slice(-6) 可碰撞 | 修正
schedule-grid.tsx:168 | P3 | 代码质量 | 单周条目显示"第3-3周" | 第3周
landing-filter-row.tsx:58-61 | P3 | 逻辑bug | overflow 检测只在 items 变化时测量，展开态/缩放后不重测 | ResizeObserver 重测
```

## 无问题文件（20个）
combobox-select、confirm-dialog、error-state、hover-action-bar、import-confirm-dialog、import-wizard-dialog、mixed-tag-editor、status-badge、table-row-actions、theme-provider、form-field-row、page-header-card、pagination-bar、log-table-shell、status-action-bar、eval-method-selector、platform-layout、brand-relation-select、cover-image-upload、landing-pagination

总行数 10916
