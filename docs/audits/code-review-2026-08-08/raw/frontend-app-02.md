# 前端审查批次（复查）：apps/edu/app（job / layout / lesson 全部 / library 全部 / not-found / alliance）

复查日期：2026-08-08
范围：`/tmp/opencode/a2-ab` 文件列表 62 个文件，逐文件完整通读。
基准：2026-08-07 全量审查（docs/audits/code-review-2026-08-07/raw/frontend-app-02.md）已修项回归验证 + 新问题。
结论先行：上轮 5 条 P1 中 4 条已修复（拓扑排序、batchSave 抛错、ap-custom 真实 ID、positions 保存跳转）；本轮新发现 1 条 P1、P2 若干。

---

## apps/edu/app/job/layout.tsx
无问题。

## apps/edu/app/job/learn-roads/page.tsx
- [P2][截断] 行 512-517 — `positionApi.list({ limit: 1000 })` 与 `batchApi.list({ limit: 1000 })` 仍为单次全量拉取，超过后端 maxPageSize（200）时列表被截断，超量岗位无法进入学习路径编辑（页面无截断提示）。最佳实践：改用 `fetchAllPages` 或服务端分页。
- [P3][稳定性] 行 130 — orphan 场景 ID 仍用 `Math.random()` 每次编辑态重新生成（上轮已标记未修）；行 697 `setTimeout(() => setSaved(false), 2000)` 无卸载清理。容忍。
- [已修复确认] 行 606-647 — `handleEdit` 已加 `editSeqRef` 请求序号守卫，快速连点岗位时先发后至响应被丢弃，上轮 P2 竞态已解决。

## apps/edu/app/job/positions/[id]/edit/page.tsx
- [P3][死代码] 行 55-57 — `setBatches`/`setMajorMap`/`setIndustryMap` 三个 setter 仍被丢弃（`const [, setX]`），行 181-192 的专业/行业字典拉取结果无人消费，纯浪费请求（上轮已标记未修）。最佳实践：删除该 effect 与对应 state。
- [P3][边缘] 行 233-235 — `saveFull` 成功但 `saveDraft`（status!=='draft' 时）失败：hasSavedRef 未置位且整体报"保存失败"，此时数据实际已落库；仅当 `isNewPosition && 初始 status!=='draft'` 时 onBack 会误删已保存的岗位，概率极低。容忍。
- [已修复确认] 行 251-256 — `handleFinish` 改为 `const ok = await handleSave()` 仅成功时跳转，上轮 P1（保存失败仍跳转）已修复。

## apps/edu/app/job/positions/page.tsx
无问题。

## apps/edu/app/job/recommend/page.tsx
- [P2][部分失败] 行 96-112 — `handleMove` 仍用 `Promise.all` 并发更新全部推荐顺序，中途某个 update 失败则其余已生效，无回滚补偿（上轮已标记未修）。最佳实践：串行逐个更新或失败时反向补偿。
- [P3][健壮性] 行 330 — `POSITION_TYPE_LABELS[rec.positionType]` 无 fallback，未知类型渲染 undefined；行 307 每行 `positions.find` O(n²)（数据量小，容忍）。

## apps/edu/app/job/workflows/page.tsx
无问题。

## apps/edu/app/layout.tsx
无问题。

## apps/edu/app/lesson/admin/approvals/page.tsx
- [P3][生命周期] 行 48-55 — 课程/批次字典加载 Promise 无取消守卫，卸载后可能 setState（React 18 无害）；行 37 `history?: any[]` 字段赋值后无人消费，行 114 `mapRecord(a: any)` 未收敛类型。容忍。

## apps/edu/app/lesson/admin/archive/page.tsx
无问题。

## apps/edu/app/lesson/admin/batches/page.tsx
无问题。

## apps/edu/app/lesson/admin/_components/ability/ability-point-selector.tsx
- [P3][语义] 行 30-31 — `onChange`/`onAddCustom` 均可选且无互斥校验，两者都不传时组件可渲染但完全不可交互（死交互）。容忍。

## apps/edu/app/lesson/admin/_components/assessment/evaluation-method-selector.tsx
- [P3][兼容性] 行 23-27 — `COURSE_METHOD_KEYS` 仅 4 类，旧数据残留 `exam` 键时不可见且 `toggleMethod` 不会清除（上轮已标记未修）。容忍。

## apps/edu/app/lesson/admin/_components/common/rich-text-editor.tsx
- [P3][i18n] 行 73-94 — `defaultPlaceholder` 为长段中文模板整段包 `t()`，字典缺 key 时英文环境回退显示中文。容忍。

## apps/edu/app/lesson/admin/_components/courses/course-admin-page.tsx
- [P3][硬编码] 行 41-44 — creator 显示"杭州知与未来科技有限公司"硬编码公司名；行 34 `lessonCount: 0` 恒为 0。容忍（上轮已标记未修）。

## apps/edu/app/lesson/admin/_components/courses/course-list.tsx
无问题。

## apps/edu/app/lesson/admin/_components/knowledge/knowledge-selector.tsx
无问题。

## apps/edu/app/lesson/admin/_components/resources/resource-selector.tsx
无问题。

## apps/edu/app/lesson/admin/granular/add/page.tsx
- [P2][状态陈旧] 行 100-111 — 上轮问题未修：effect 内先 `setCustomKnowledgePointIds(new Set())` 再逐条 functional update，随后同步读 `customKnowledgePointIds.has(k.id)`（行 111）用的是本次渲染的空集合快照，池内全部课程自定义知识点 `linked` 恒为 true，自定义标识在复选框中不生效。最佳实践：effect 内先构建完整 Set 局部变量一次 setState。
- [P2][数据完整性] 行 274-289 — 上轮问题未修：新建课程（editId 为 null）时自定义知识点 `knowledgeApi.create({ sourceId: editId })` 写入 sourceId=null，保存后 `router.replace` 带真实 id 重新加载，`k.sourceId === editId` 匹配不到 → 这些知识点不再被识别为课程自定义，后续编辑改名/描述不再同步。最佳实践：创建课程拿到真实 id 后补一次 update 回填 sourceId。
- [P2][部分失败] 行 374-387 — 上轮问题未修：新建课程 `courseApi.create` 成功后 `persistNewResources` 失败走 catch，课程已创建但 URL 未替换，用户重试保存会再创建一门重复课程。最佳实践：create 成功后先 replace URL 再持久化资源。
- [P2][状态管理] 行 363 vs 374-387 — **新发现**：编辑分支第 363 行置 `hasSavedRef.current = true`，但新建分支（374-387）成功后**未置位**，`handleFinish`（行 395-399）首次点击"完成配置"保存成功后 `if (!hasSavedRef.current) return` 不跳转，用户需点两次才能离开（且 toast 重复提示）。最佳实践：新建分支成功路径同样置位 hasSavedRef。
- [P3][死代码] 行 70-73 — `detailedDescription`/`background`/`estimatedHours` 三个 state 只有初始值无 setter 无输入，payload 中恒为 undefined。容忍。

## apps/edu/app/lesson/admin/granular/page.tsx
无问题。

## apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx
- [P2][陈旧闭包] 行 310-329 — 上轮问题未修：`AttachmentListEditor.handleFileChange` 上传完成回填时读取闭包 `items` 做 `findIndex`，若上传期间该附件被删除则 idx=-1 静默丢弃（文件已上传 CDN 成孤儿）；若被追加条目不受影响。最佳实践：上传开始记录 itemId，回填前校验仍存在，失败提示。
- [P3][截断] 行 584-585 — `resourceLibraryApi.list({ limit: 1000 })` 超后端上限被截断，ResourceModuleEditor 资源池不完整。容忍（与全项目同类）。
- [P3][重复定义] 行 239 — `POST_REVIEW_DEFAULT`（'请输入课后总结内容'）与 module-serialize.ts:7 重复定义两处（上轮已标记未修）。

## apps/edu/app/lesson/admin/hybrid/add/_components/module-preview.tsx
- [P2][契约不一致] 行 219 — `const mode = data.moduleModes?.[moduleKey] ?? 'online'` 默认显示"线上"，而序列化端 module-serialize.ts:81 `mode: d.moduleModes?.[key] || 'offline'` 默认落库 offline：用户从未切换过开关的模块，编辑弹窗显示"线上"但保存后实际为线下，且刷新后开关翻转为"线下"。**新发现**。最佳实践：两处默认值统一（线上 or 线下），或序列化前归一化默认。

## apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.test.ts
无问题。

## apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.ts
- [P3][重复定义] 行 7 — `POST_REVIEW_DEFAULT` 与 atomic-modules.tsx:239 重复，将来只改一处会导致判空逻辑（行 71）失效（上轮已标记未修）。容忍。

## apps/edu/app/lesson/admin/hybrid/add/page.tsx
- [P2][重复加载覆盖] 行 190-323 — 上轮问题未修：加载 effect 依赖 `abilityPool`（行 323），能力池拉取完成触发 effect 重跑，编辑模式重新拉取课程/节点/模块并整体覆盖 `nodeDataMap`/`moduleAssignments`/`selectedNodeId`（会重置用户已选节点），新建模式则重置 nodes（若用户在该窗口内已添加节点会丢失）；`setAbilityPoints` 在第二次运行才拿得到池内名称（首次显示裸 UUID 名称）。最佳实践：去掉 abilityPool 依赖，改为首次加载后单独 setAbilityPoints。
- [P2][字段丢失] 行 691-692 — `buildCoursePayload` 使用 `existing?.semester`/`existing?.className`，`courseForm.semester` 的用户修改永不生效（表单无该输入项，属死字段，上轮已标记未修）。建议删除或打通 UI。
- [P3][孤儿数据] 行 1033-1055 — 自定义能力点改为先 `abilityApi.create` 换真实 ID（修复正确），但用户随后在弹窗内移除该能力点时无删除/回收路径，产生孤儿能力点记录。容忍。
- [P3][i18n] 行 151-153 — `claimSessionNames` 拼接"第 N 周 · ..."未包 t()。
- [已修复确认] 行 723-739 — saveNodes 已按 parentId 拓扑排序（DFS 父先子后），上轮 P1（多根节点子树外键死锁）已修复。
- [已修复确认] 行 772-782 — 第二遍模块保存 `await hybridModuleApi.batchSave(...)` 无 try/catch 包裹，失败向上抛错走 handleSave catch，上轮 P1（模块保存静默丢失）已修复。
- [已修复确认] 行 1033-1055 — `onAddCustom` 先 `abilityApi.create` 换真实 ID 再入 abilityPointIds，上轮 P1（ap-custom 假 ID 入库）已修复。
- [已修复确认] 行 852-857 — `handleFinish` 以 handleSave 返回值判断跳转，且 hasSavedRef 在 create/update 分支均置位，保存失败不跳转。

## apps/edu/app/lesson/admin/hybrid/page.tsx
无问题。

## apps/edu/app/lesson/admin/layout.tsx
- [P3][权限 UX] 行 29-44 — "遮罩式"权限守卫，无权限时 children 仍挂载渲染到 DOM（上轮已标记未修）。后端有鉴权，容忍。

## apps/edu/app/lesson/admin/system/add/_components/CourseNodeTree.tsx
无问题（拖拽高频 getBoundingClientRect 与 dragleave contains 判断属边缘交互瑕疵，容忍）。

## apps/edu/app/lesson/admin/system/add/_components/lesson-save-roundtrip.test.ts
无问题。

## apps/edu/app/lesson/admin/system/add/_components/lesson-save-utils.ts
- [P2][运算符优先级] 行 141-144 — 上轮问题未修：`draft?.estimatedHours || node.estimatedHours ? parseFloat(...) : undefined` 实为 `(a || b) ? c : d`：用户清空 estimatedHours（draft=''）而 node 原值存在时回退用旧值，**无法清空该字段**；parseFloat 无 NaN 兜底。最佳实践：显式 `const v = draft?.estimatedHours; const eh = v !== undefined && v !== '' ? parseFloat(v) : node.estimatedHours`。

## apps/edu/app/lesson/admin/system/add/_components/PublishCheckPanel.tsx
无问题。

## apps/edu/app/lesson/admin/system/add/page.tsx
- [P1][数据丢失/误导] 行 768 + 796-800 — **新发现**：`hasSavedRef.current = true` 在 `saveNodes`（行 772）**之前**置位，而 `handleSave` 无返回值（catch 吞掉仅 toast）；`handleFinish` 仅检查 hasSavedRef。当课程 create/update 成功但节点树保存失败（外键/网络/超时任一）时，用户点"完成配置"仍跳转列表页，节点数据静默部分丢失且用户不知情（hybrid 版同结构但靠返回值 `ok` 兜底，system 版无此兜底）。最佳实践：saveNodes 成功后再置 hasSavedRef，或 handleSave 返回 boolean（参照 hybrid 852-857）。
- [P2][状态丢失] 行 724-732 — **新发现**：保存后 `setNodes(refreshedNodes)` 替换为真实 ID 列表，但**未重映射 `selectedNodeId`**（hybrid 版行 802-805 已做映射），选中节点 id（temp）不再存在于 nodes → 选中态清空、表单重置为未选状态，用户每次保存后必须重新点选节点；nodeDrafts 中旧 temp id 条目残留。最佳实践：按 `idMapping` 同步重映射 selectedNodeId 并迁移 drafts key。
- [P2][静默丢失] 行 657-672 — 上轮问题未修：自定义知识点 `knowledgeApi.create` 失败仅 `reportError` 继续，`resolveKnowledgePointIds`（lesson-save-utils.ts:72）随后把 `kp-custom-*` 过滤掉 → 该知识点从保存中静默消失。最佳实践：创建失败即中止保存并 toast。
- [P2][截断] 行 388 — `knowledgeApi.list({ limit: 200 })` 被后端上限截断，超过 200 个知识点的租户其池内缺项；行 181 `nodeResourceApi.list({ courseId, limit: 200 })` 同样截断，resourcePool 不完整导致已绑定资源无法解析展示。最佳实践：fetchAllPages 分页合并。
- [P2][竞态] 行 172-238 — 上轮问题未修：加载 effect 依赖 `abilityPool`（行 238），池加载完成触发重跑并整体重置 courseName/nodes/selectedNodeId 等状态，存在覆盖用户编辑窗口。
- [P2][竞态] 行 529-591 — `handleGrainConfirm` 已加 `confirmNodeId !== selectedNodeIdRef.current` 守卫（行 556、586，修复正确），但行 591 `setNodeEvalRuleConfig(undefined)` 在 try/catch **之外**无条件执行：异步拉取期间用户切换节点 → 早期 return 后仍会清空**当前节点**的评价配置 UI 状态（数据层因 buildEvalDataForSave 回退不丢，仅 UI 显示为空）。**新发现**。最佳实践：切换守卫后同样跳过 591 行。
- [P3][hack] 行 555、564 — `courseApi.get(\`${grain.id}?_t=${Date.now()}\`)` 与 `resourceLibraryApi.list({ _nocache: Date.now() })` 伪造参数绕过缓存（上轮已标记未修）。
- [P3][数据展示] 行 534-543 + lesson-save-utils.ts:119-150 — 引用（quote）节点经 `handleGrainConfirm` 设置的 duration/difficulty/teachingGoals 因 `buildNodeSavePayload` 的 `if (!isQuoteNode)` 分支**不随节点保存**，保存刷新后引用节点课时显示 0、难度/目标回退默认（仅展示层问题，引用语义下或可接受）。**新发现**。若引用节点需展示颗粒课信息，应在列表接口 JOIN 或按 sourceId 回读。
- [已修复确认] 行 626-641 — saveNodes 已按 parentId 拓扑排序，上轮 P1（保存死锁）已修复。
- [已修复确认] 行 997-1018 — `onAddCustom` 先 `abilityApi.create` 换真实 ID（且同步加入 abilityPool），上轮 P1（ap-custom 假 ID 入库）已修复。
- [已修复确认] 行 544-556/586-589 — `handleGrainConfirm` 异步回填前校验节点未切换，上轮 P2 竞态已修复。

## apps/edu/app/lesson/admin/system/page.tsx
无问题。

## apps/edu/app/lesson/admin/workflows/page.tsx
无问题。

## apps/edu/app/lesson/landing/[id]/learn/page.tsx
- [P2][跨节点状态残留] 行 281/330、716-722 与 288/349、638 — 上轮问题未修：`submittedMethodKeys`/`hybridSubmittedKeys` 以 methodKey 为键、**切换节点不重置**；节点 B 与节点 A 配置相同 methodKey 时，切到 B 后卡片直接显示"已提交/pending"（`overriddenResult` 短路），用户误以为已提交。最佳实践：提交键带上 nodeId 或在 activeNodeId 变化时清空。
- [P2][竞态] 行 116-132（course 加载）与 134-158（nodes/hybrid modules 加载）— 上轮问题未修：两 effect 无取消/序号守卫，快速切换课程 id 时旧响应可覆盖新数据。最佳实践：cancelled 标志或 AbortController。
- [P3][静默失败] 行 352-362 — `handleFileUpload` catch 后返回 null，失败原因无提示（上轮已标记未修）。
- [P3][截断] 行 204-206 — `knowledgeApi.list({ limit: 1000 })`/`courseApi.list({ type:'granular', limit: 1000 })` 被后端上限截断，知识点详情弹窗的关联颗粒课/知识图谱缺项。
- [已修复确认] 行 99、184-199 — 节点测评结果加载已加 `nodeResultSeqRef` 序号守卫，上轮 P2 竞态已修复。

## apps/edu/app/lesson/landing/[id]/page.tsx
- [P2][崩溃风险] 行 649 — `course.creatorId.slice(0, 8)`：creatorId 为 null/undefined（老数据）时 TypeError 整页崩溃（上轮已标记未修）。最佳实践：`(course.creatorId || '').slice(0, 8)`。
- [P2][截断] 行 140-143 — `courseResourceApi.list({ courseId: id, limit: 10000 })` 超过后端 maxPageSize 被截断，资源中心数据不完整且无提示（上轮已标记未修）。最佳实践：fetchAllPages 分页合并。
- [P2][竞态] 行 132-153 — 三个并行拉取无取消守卫，切换课程 id 时旧数据可覆盖（上轮已标记未修）。
- [P3][重复渲染] 行 197-216 — `getNodeEvalMethods` 对混合课 preQuiz/inClassQuiz/homework 三个子规则不做去重，同一 methodKey 重复 push → 徽章列表 key 冲突且同一方法展示多次。容忍。

## apps/edu/app/lesson/landing/layout.tsx
无问题。

## apps/edu/app/lesson/landing/page.tsx
- [P2][截断] 行 123 — `courseApi.list({ status:'published', limit:1000 })` 客户端全量拉取，课程超上限时列表/筛选/统计不完整（上轮已标记未修）。容忍（含 P3：CourseCard index prop 未使用）。

## apps/edu/app/lesson/layout.tsx
无问题。

## apps/edu/app/library/ability/page.tsx
- [P2][部分成功误导] 行 114-141 — 上轮问题未修：实体 create/update 成功后才 `saveTags`，标签保存失败整体 catch 并 toast"保存失败"，实体实际已保存 → 用户重试会重复创建。最佳实践：标签失败单独 toast 且不阻止关闭弹窗。
- [P2][竞态] 行 54-59 — `loadItems` 无取消/序号守卫（见 use-library-crud 条目）。

## apps/edu/app/library/certificates/page.tsx
- [P2][部分成功误导] 行 124-150 — 与 ability 页相同（create/update 成功后 saveTags 失败误报"保存失败"，重试重复创建；上轮已标记未修）。
- [P3][风格] 行 30 — `import { useEffect } from 'react'` 与其它 import 分离在文件末尾（上轮已标记未修）。

## apps/edu/app/library/_components/library-page-shell.tsx
无问题。

## apps/edu/app/library/_components/use-library-crud.ts
- [P2][竞态] 行 55-82 — **新发现（重构引入）**：`loadItems` 无请求序号/取消守卫，连续输入搜索词（每次 keystroke 触发一次拉取）或快速翻页时，先发请求可能后返回覆盖后发结果，列表显示与当前关键字不匹配的陈旧数据。最佳实践：保存请求序号，响应返回时校验仍为最新（参照 learn-roads editSeqRef 模式）。
- [P3][边界] 行 66-70 — `page > totalPages` 时 `setPage(totalPages)` 后直接 return，items 仍为旧页数据直至重载；瞬时闪烁可接受。

## apps/edu/app/library/knowledge/_components/granular-lesson-select-dialog.tsx
无问题。

## apps/edu/app/library/knowledge/_components/knowledge-point-form-dialog.tsx
无问题。

## apps/edu/app/library/knowledge/page.tsx
- [P2][部分成功误导] 行 112-143 — 与 ability/certificates 相同：实体保存成功、saveTags 失败误报"保存失败"（重试重复创建）。
- [P2][截断] 行 63 — `courseApi.list({ type: 'granular', limit: 1000 })` 超过后端上限被截断，颗粒课选择弹窗缺项。
- [P3][一致性] 行 151 — `category: t('专业基础')` 与 COURSE_CATEGORIES 枚举（'专业基础课程'，atomic-modules.tsx:38-45）不一致，混合课编辑器回填时分类回退默认值（上轮已标记未修）。
- [P3][误导] 行 162-171 — 编辑态创建颗粒课成功后 `knowledgeApi.update` 失败会走外层 catch 提示"创建颗粒课失败"，实际颗粒课已创建（上轮已标记未修）。

## apps/edu/app/library/landing/layout.tsx
无问题。

## apps/edu/app/library/landing/page.tsx
- [P2][截断] 行 232 — `resourceLibraryApi.list({ limit: 500 })` 客户端全量拉取被后端上限截断，统计卡片、类型/院系/专业筛选、列表均不完整且无提示（上轮已标记未修）。
- [P3][性能] 行 281 — `useState(() => Date.now())` 固定挂载时间，"近一周/一月"随时间静默失效（上轮已标记未修）。容忍。

## apps/edu/app/library/layout.tsx
- [P3][权限 UX] 行 37-47 — "遮罩式"守卫，children 仍挂载（上轮已标记未修）。容忍。

## apps/edu/app/library/my-resources/page.tsx
- [P3][状态] 行 102 — `truncated` 一旦置 true 永不重置，切 tab 后横幅常驻（上轮已标记未修）。容忍。
- [P3][截断] 行 120-132 等 — 各列表 limit 200 截断已有横幅兜底（行 241-245），按条件筛选可看全量。容忍。

## apps/edu/app/library/questions/page.tsx
- [P2][截断] 行 47 — `limit: 9999` 超后端 maxPageSize 被截断为 200，`totalPages = ceil(total/9999) = 1` 无分页，只展示前 200 条无提示（上轮已标记未修）。最佳实践：limit 传 200 并用服务端分页（其余 library 页已改造）。
- [P3][类型] 行 60、96、192、248 — `editing: any`/`item: any`/`majors: any[]` 未收敛类型。
- [P2][部分成功误导] 行 120-146 — saveTags 失败误报"保存失败"（同 ability/certificates 模式）。

## apps/edu/app/library/resources/_components/resource-batch-import-dialog.tsx
- [P3][重名探测] 行 178-196 — `previewImport` 返回子集（可能受 limit 限制）之外的重复名直接创建（mode 'skip' 拦截不到），产生重复资源（上轮已标记未修）。容忍。
- [P3][容错] 行 106-151 — 单文件失败仅计数，失败文件名不可见。容忍。

## apps/edu/app/library/resources/_components/resources-page.tsx
- [P3][计数语义] 行 159 — `statCount = total`（当前搜索/筛选下总数）与类型统计卡（stats 接口）口径不同（上轮已标记未修）。容忍。

## apps/edu/app/library/resources/_components/resource-upload-zone.tsx
无问题。

## apps/edu/app/library/resources/_components/use-resource-crud.ts
- [P2][部分成功误导] 行 186-213 — 上轮问题未修：实体保存成功、`tagApi.setBindings` 失败 → toast"保存失败"且弹窗不关闭，重试会重复创建（新建路径无幂等）；行 162-175 上传成功但 create 失败的 CDN 孤儿文件无清理。最佳实践：标签失败单独提示；上传完成即视为"已提交"语义或幂等重试。
- [P2][竞态] 行 38-65 — `loadItems` 无请求序号守卫（同 use-library-crud）。

## apps/edu/app/library/resources/page.tsx
无问题。

## apps/edu/app/library/resources/[type]/page.tsx
无问题。

## apps/edu/app/library/tags/page.tsx
无问题。

## apps/edu/app/not-found.tsx
无问题。

## apps/edu/app/portal/alliance/achievements/[id]/page.tsx
- [P3][静默失败] 行 23-31 — 拉取失败仅 `reportError`，UI 显示"成果不存在"（网络错误与 404 同文案，轻微误导）。容忍。

## apps/edu/app/portal/alliance/achievements/page.tsx
无问题。

## apps/edu/app/portal/alliance/brands/major/[id]/page.tsx
无问题。

## apps/edu/app/portal/alliance/brands/page.tsx
- [P3][i18n] 行 41 — `label: allianceLabel('brandType', type)` 返回的中文标签未包 `t()`，英文环境 tab 名仍为中文（上轮已标记未修）。最佳实践：统一走 i18n。

---

## 汇总统计
- 审查文件数：62
- 总问题数：38（P0: 0，P1: 1，P2: 21，P3: 16）

### P1 摘要（1 条，新发现）
1. `apps/edu/app/lesson/admin/system/add/page.tsx:768,796-800` — `hasSavedRef` 在 `saveNodes` 之前置位且 `handleSave` 无返回值：课程保存成功但节点树保存失败时，`handleFinish` 仍跳转列表页，节点数据静默部分丢失且用户不知情（同页拓扑排序修复后此路径仅剩兜底缺陷；hybrid 版靠 handleSave 返回值已规避，system 版未做）。

### 上轮 P1 回归验证（5 条）
| 上轮问题 | 状态 |
|---|---|
| system/hybrid saveNodes 全局按 order 创建节点（外键死锁） | ✅ 已修复（两处均改为 parentId 拓扑排序） |
| hybrid batchSave 异常被吞、静默丢内容 | ✅ 已修复（改为向上抛错） |
| hybrid/system ap-custom-* 假 ID 入库 | ✅ 已修复（onAddCustom 先 create 换真实 ID） |
| positions/[id]/edit 保存失败仍跳转 | ✅ 已修复（handleFinish 仅成功跳转） |
| handleGrainConfirm 异步回填无节点守卫 | ✅ 已修复（confirmNodeId 校验，见 P2 备注 591 行遗留） |

### P2 摘要（21 条）
- system/add：hasSavedRef 顺序（P1 同源）、selectedNodeId 保存后未重映射、kp 创建失败静默丢失、knowledgeApi/nodeResourceApi limit 200 截断、加载 effect 依赖 abilityPool 重跑、handleGrainConfirm 591 行节点切换后仍清空评价配置
- hybrid/add：加载 effect 依赖 abilityPool 重跑、buildCoursePayload semester/className 死字段
- module-preview：mode 默认值（online）与 serializer（offline）契约不一致
- granular/add：customKnowledgePointIds 陈旧闭包 linked 恒 true、新建课程 sourceId=null 自定义知识点失联、新建资源持久化失败重试重复建课、新建分支 hasSavedRef 未置位需点两次
- lesson-save-utils：estimatedHours 运算符优先级无法清空
- learn/page：submittedMethodKeys 跨节点残留、加载 effect 竞态
- landing/[id]：creatorId.slice 崩溃、limit 10000 截断、加载竞态
- recommend：handleMove 部分失败无补偿
- use-library-crud / use-resource-crud：loadItems 请求序号缺失（快速搜索竞态，重构新引入）
- library ability/certificates/knowledge/questions：saveTags 部分成功误导（4 页）
- learn-roads：positionApi/batchApi limit 1000 截断

### P3 摘要（16 条）
死代码（positions edit 字典拉取、granular 死 state）、i18n（hybrid claimSessionNames、brands tab）、硬编码公司名、POST_REVIEW_DEFAULT 重复定义、孤儿数据（hybrid 自定义能力点无回收路径、batch 导入孤儿文件）、截断类若干、类型 any、import 顺序等，均为可容忍项。
