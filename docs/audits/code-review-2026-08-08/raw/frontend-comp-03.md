# 前端 components 层复查（2026-08-08）

- 审查范围：apps/edu/components/shared/ 下 42 个文件 + components/ 下 2 个文件（含上次修复的 portal-sidebar-crud-page、resource-selector、image-list-upload 上传队列、major-select/user-selector fetchAllPages 应用）
- 已修项回归结论：tenantId 传递（portal-sidebar-crud-page.tsx:168/579）、绑定失败提示（resource-selector.tsx:362-375）、上传队列（image-list-upload.tsx:39-99）、fetchAllPages 应用（major-select.tsx:48、user-selector.tsx:227）均完好，无回归。
- P0：0 | P1：0 | P2：19 | P3：15

## apps/edu/components/shared/exam-grading/question-grading-card.tsx
- [P2][状态管理] question-grading-card.tsx:150 — localScore 仅以 useState(score.toString()) 初始化，父组件 score 变化（如切换考生/重新加载）不会回写，编辑框可能显示过期分数；最佳实践：localScore 派生自 props 时用 useEffect 同步或 key 重建
- [P3][契约不符] question-grading-card.tsx:318/341/347 — t(getAnswerLabel(answer)) 把学生答案/正确答案文本透传给 i18n 翻译器，若答案恰好命中翻译 key 会被替换；最佳实践：答案文本不应走 t()
- [P3][死代码] question-grading-card.tsx:57-60 — isAutoQuestion 中 'judge'/'judgment' 双分支枚举冗余（与 isAnswerCorrect 一致但可接受）

## apps/edu/components/shared/favorite-button.tsx
- 无问题（cancelled 守卫、loading 防抖、错误提示齐全）

## apps/edu/components/shared/form-field-row.tsx
- 无问题

## apps/edu/components/shared/hover-action-bar.tsx
- 无问题（纯 re-export）

## apps/edu/components/shared/image-editor-dialog.tsx
- 无问题（offline 配置、blob 类型兜底正确）

## apps/edu/components/shared/image-list-upload.tsx
- [P3][内存泄漏] image-list-upload.tsx:50-56 — uploadFile 失败时降级 URL.createObjectURL 产生的对象 URL 永不 revoke 且被存入 value 持久化；最佳实践：失败时仅提示不上传，或卸载时统一 revoke
- [P3][内存泄漏] image-list-upload.tsx:199-202 — SingleImageUpload 同样存在失败降级 objectURL 泄漏
- [P3][风格] image-list-upload.tsx:47-62 — uploadAndAppend 中 setUploading(true/false) 在多文件队列场景会闪烁；功能正确，可接受

## apps/edu/components/shared/image-upload-utils.ts
- 无问题

## apps/edu/components/shared/import-confirm-dialog.tsx
- 无问题（纯 re-export）

## apps/edu/components/shared/import-wizard-dialog.tsx
- 无问题（纯 re-export）

## apps/edu/components/shared/knowledge-selector.tsx
- [P2][契约不符] knowledge-selector.tsx:165-167 — 搜索走后端接口但 limit 固定 200 无分页，注释声称"可命中全部知识点"与实际不符，超过 200 条命中静默截断；最佳实践：复用 fetchAllPages 分页拉全
- [P2][useEffect] knowledge-selector.tsx:132-139 — 岗位/场景全量拉取无 cancelled/seq 守卫，组件卸载或 tenantId 切换后可能 setState；最佳实践：加 cancelled 标志（参照同文件 142-155 的写法）
- [P2][状态管理] knowledge-selector.tsx:343-358 — 编辑知识点仅更新 selected 列表，searchResults/allKps 中同名条目保留旧值，关闭弹窗后列表表格显示过期名称/描述；最佳实践：编辑后同步更新 searchResults 或失效搜索缓存
- [P3][死代码] knowledge-selector.tsx:50-63 — 本地实现 fetchAllPages 与 @/lib/fetch-all 重复（仅签名不同）；最佳实践：统一到 lib/fetch-all 或抽象带 params 签名版本

## apps/edu/components/shared/landing-filter-row.tsx
- [P3][useEffect] landing-filter-row.tsx:89-92 — overflow 判定仅依赖 items，不随窗口 resize 重算；最佳实践：补 resize 监听或改用 CSS 容器查询

## apps/edu/components/shared/landing-pagination.tsx
- 无问题

## apps/edu/components/shared/landing-shell.tsx
- 无问题

## apps/edu/components/shared/log-table-shell.tsx
- 无问题

## apps/edu/components/shared/major-select.tsx
- [P2][竞态] major-select.tsx:39-63 — loadMajors 无请求序号/取消守卫，tenantId 快速切换时旧租户响应可能覆盖新租户数据；最佳实践：effect 内 cancelled 标志或 seqRef 比对（参照 knowledge-selector.tsx:84-86 模式）

## apps/edu/components/shared/mobile-tab-dropdown.tsx
- 无问题（文档点击关闭、aria 齐全）

## apps/edu/components/shared/multi-org-node-picker.tsx
- [P3][风格] multi-org-node-picker.tsx:247 — `n.has(id) ? n.delete(id) : n.add(id)` 三元表达式作为语句，eslint no-unused-expressions 风格隐患；最佳实践：改写为 if/else

## apps/edu/components/shared/org-node-picker.tsx
- 无问题

## apps/edu/components/shared/page-header-card.tsx
- 无问题

## apps/edu/components/shared/pagination-bar.tsx
- 无问题

## apps/edu/components/shared/platform-layout.tsx
- 无问题

## apps/edu/components/shared/portal-crud-page.tsx
- [P2][错误被吞] portal-crud-page.tsx:207-223 — onSave 成功后 await onRetry() 置于 try 内，列表刷新失败会误报"保存失败"（实际已保存）；confirmDelete(239-256)、handleToggleEnabled(225-237) 同样模式；最佳实践：refetch 移出 try 或 catch 中区分错误来源
- [P2][状态管理] portal-crud-page.tsx:268-270 — allSelected 以"已选数 === 当前筛选页条数"判定，跨页选择时表头全选态与实际不符（选中 20 条中 10 条会被判为全选）；最佳实践：以"当前页可见项是否全部选中"判定
- [P3][契约不符] portal-crud-page.tsx:156-157 — searchValue 受控时若无 onSearchChange，搜索框输入无效；调用方契约依赖，可接受

## apps/edu/components/shared/portal-sidebar-crud-page.tsx
- [P2][数据一致性] portal-sidebar-crud-page.tsx:227-237/273-287 — selectedIds 在删除成功/refetch 后不清理，已删除 id 残留，批量导出/批量加入会把无效 id 发给后端；最佳实践：refetch 后按新 items 过滤 selectedIds
- [P2][状态管理] portal-sidebar-crud-page.tsx:227-233 — toggleSelectAll 全选/取消以"已选数 === 当前筛选数"判定，跨页勾选后点表头会把跨页选择静默替换为当前页；最佳实践：以当前页可见项是否全选决定清空或全选
- [P2][契约不符] portal-sidebar-crud-page.tsx:216-225/185 — 搜索/状态/组织筛选只过滤当前页 items，而 total 与分页基于服务端总数，筛选后"共 N 条"与表格内容不一致（筛选到空页时 totalPages 仍为服务端值）；最佳实践：筛选走服务端参数或提示仅限当前页
- [P3][契约不符] portal-sidebar-crud-page.tsx:463 — onResetPwd 用 `(item as any).name` 强转获取姓名，契约不明确；最佳实践：config 增加 getName 回调
- [P3][死代码] portal-sidebar-crud-page.tsx:203-209 — useEffect 内 async IIFE 仅包裹同步 setState，无异步操作；最佳实践：直接 setState（参照 portal-crud-page.tsx:182-186 的 queueMicrotask 写法）
- [P3][风格] portal-sidebar-crud-page.tsx:429-434 — 表头全选框无 indeterminate 态，部分选中时显示未选中；最佳实践：参照 portal-crud-page.tsx:370 的 'indeterminate' 写法

## apps/edu/components/shared/reset-password-dialog.tsx
- [P3][死代码] reset-password-dialog.tsx:43-55 — useEffect 内 async IIFE 仅包含同步 setState，cancelled 标志无实际作用；最佳实践：直接同步执行

## apps/edu/components/shared/resource-preview-modal.tsx
- [P3][死代码] resource-preview-modal.tsx:91-95/97-112 — 两处 useEffect 用 async IIFE 包裹纯同步 setState，无意义；最佳实践：直接同步执行
- [P3][内存泄漏] resource-preview-modal.tsx:200 — mounted 置 true 后不再复位，组件卸载重挂载场景可接受

## apps/edu/components/shared/resource-selector.tsx
- [P2][数据丢失] resource-selector.tsx:681-777/342-361 — venue/facility/software 类型的表单字段（场地地址/开放时间/容纳人数/联系人/位置/数量/版本/授权）全部收集但创建资源时未随 resourceLibraryApi.create 提交，保存后丢失；最佳实践：要么在 create 载荷中带上并请求后端支持，要么移除这些表单字段
- [P2][数据丢失] resource-selector.tsx:342-379/576-578 — loadResources 失败（apiAvailable=false）时上传走本地 id（res-<ts>）路径，该资源不进入 mergedPool，选中后右侧"已选资源"与顶部徽章均不可见、无法取消选择，保存时向后端提交本地假 id 产生悬挂引用；最佳实践：本地资源也塞入 mergedPool，或失败时禁用上传
- [P2][契约不符] resource-selector.tsx:171-196 — resourceLibraryApi.list 固定 limit 1000 无分页，资源库超过 1000 条静默截断；最佳实践：改用 fetchAllPages
- [P3][死代码] resource-selector.tsx:298-307 vs 390-399 — fileTypes 与 fileTypesWithUpload 为完全相同的常量重复定义；最佳实践：提取单一常量
- [P3][风格] resource-selector.tsx:550 — 已选中资源的按钮文案为"已选择"但点击实际执行取消选择（toggleResource），文案误导；最佳实践：改为"移除"或拆分两个动作

## apps/edu/components/shared/schedule-grid.tsx
- [P3][契约不符] schedule-grid.tsx:243-258 — 目标格子已有条目时不可放置/不可点击（无替换语义），属设计限制；可接受

## apps/edu/components/shared/status-action-bar.tsx
- 无问题

## apps/edu/components/shared/status-badge.tsx
- 无问题（纯 re-export）

## apps/edu/components/shared/table-row-actions.tsx
- 无问题（纯 re-export）

## apps/edu/components/shared/tag-badge.tsx
- 无问题

## apps/edu/components/shared/tag-filter-bar.tsx
- [P2][状态管理] tag-filter-bar.tsx:24/47 — 依赖 useTags 的 loading（useTags.ts:37 仅初始化时取 cachedTags===null），标签管理页 reload 清缓存后 loading 不置 true，筛选栏闪现"暂无标签，请先在标签管理页创建"误导文案；最佳实践：useTags reload 时同步置 loading 或基于 cachedTags===null 派生
- [P3][useEffect] tag-filter-bar.tsx:31-38 — 行高/溢出测量仅依赖 tags.length，窗口 resize 不重算；最佳实践：补 resize 监听

## apps/edu/components/shared/tag-picker.tsx
- 无问题（同受 useTags loading 影响，但 emptyText 文案可接受）

## apps/edu/components/shared/theme-color-picker.tsx
- 无问题

## apps/edu/components/shared/uncited-resources-dialog.tsx
- [P2][边界] uncited-resources-dialog.tsx:142-149 — 天数输入经 Math.max(0, Math.floor(Number(value))) 后 NaN 未被过滤（如输入 "-" 或非法数字），NaN 传入 addDays 生成 Invalid Date，format 抛 RangeError 被 catch 吞掉并误报"加载失败"；最佳实践：Number.isFinite 校验后再 setState
- [P2][数据一致性] uncited-resources-dialog.tsx:176-197 — 批量删除用 Promise.all，任一失败则整体 catch，已删除项计入 total/selected 导致后续页码计算错误且无部分成功提示；最佳实践：allSettled 后按成功数刷新并提示部分失败
- [P3][useEffect] uncited-resources-dialog.tsx:125-133 — 筛选变化通过 load 引用变化触发 effect 重载，功能正确但依赖隐式；可接受

## apps/edu/components/shared/user-selector.tsx
- [P2][竞态] user-selector.tsx:216-253 — loadUsers 无请求序号/取消守卫，防抖后快速切换组织或连续输入时旧响应可能后到并覆盖新结果（显示过期用户列表）；最佳实践：seqRef 比对（参照 knowledge-selector.tsx:84-86）
- [P2][useEffect] user-selector.tsx:194-208 — loadOrgTree 无 cancelled 守卫，组件卸载后可能 setState；最佳实践：effect 内 cancelled 标志
- [P2][状态管理] user-selector.tsx:292-294 — 弹窗打开期间父组件 value 变化（引用变化即触发）会 queueMicrotask 重置 selectedIds，覆盖用户进行中的勾选；最佳实践：仅在打开瞬间同步一次
- [P3][死代码] user-selector.tsx:438 — `<TableHead className="w-10">{multiple ? '' : ''}</TableHead>` 两个分支均为空字符串，纯死代码；最佳实践：直接输出空表头
- [P3][风格] user-selector.tsx:296-302 — 三元表达式作语句（同 multi-org-node-picker.tsx:247）

## apps/edu/components/shared/use-tag-bindings.ts
- [P2][竞态] use-tag-bindings.ts:16-36 — loadBindings 无请求序号守卫，快速翻页时旧页响应可能覆盖新页标签映射，列表展示标签错位；最佳实践：seqRef 比对或 AbortController

## apps/edu/components/shared/use-tags.ts
- [P2][性能] use-tags.ts:39-61 — reload() 置 cachedTags=null 并 emitChange 后，所有订阅方 effect 同时重新发起 tagApi.list()（N 份重复请求）；最佳实践：模块级 inflight 去重或缓存失效只触发一次拉取

## apps/edu/components/shared/workflow-config-page.tsx
- [P3][契约不符] workflow-config-page.tsx:77 — workflowApi.list limit 1000 无分页，超过 1000 条静默截断；最佳实践：fetchAllPages
- [P3][风格] workflow-config-page.tsx:99-108 — 初始加载用 cancelled 标志但 loadWorkflows/loadMajors 内部已 setState，卸载竞态未根除但影响小；可接受

## apps/edu/components/shared/zip-preview.test.ts
- 无问题（测试构造与断言正确）

## apps/edu/components/shared/zip-preview.tsx
- [P2][死代码] zip-preview.tsx:116-121 — 已核实 fflate@0.8.3 源码：unzipSync 的错误码 13 仅产生 'invalid zip data'，错误消息从不包含 'encrypted'，加密包判断恒为 false，加密压缩包只显示通用"解压失败"而非"已加密"提示；最佳实践：改为解析本地 header 的加密标志位（general purpose bit 0）判定
- [P3][契约不符] zip-preview.tsx:241-244 — 文本文件按 strFromU8 默认 utf-8 解码，GBK 编码文本显示乱码；最佳实践：加编码探测或用户切换

## apps/edu/components/theme-brand-sync.tsx
- 无问题（缓存先行 + 存储事件同步 + 防重复应用）

## apps/edu/components/theme-provider.tsx
- 无问题

---

## 汇总

- 审查文件数：44（42 个 shared 组件 + theme-brand-sync/theme-provider）
- 问题总数：34（P0: 0 / P1: 0 / P2: 19 / P3: 15）
- P0/P1 摘要：无必崩与硬性逻辑错误；上轮修复项全部回归通过。P2 集中在：① 列表/选择器类接口的竞态守卫缺失（major-select、user-selector、use-tag-bindings、knowledge-selector）；② resource-selector 两类数据丢失（venue/facility/software 字段未提交、API 失败路径本地 id 不可见）；③ portal-crud-page 保存成功后 refetch 失败误报；④ portal-sidebar-crud-page 删除后 selectedIds 残留与跨页选择覆盖；⑤ use-tags reload 重复请求与 loading 假阴性；⑥ zip-preview 加密包判定死代码；⑦ uncited-resources-dialog NaN 日期输入。建议下轮优先处理 P2 中①②③④。
