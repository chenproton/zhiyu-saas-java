# 前端审查批次：apps/edu/app（job 后半 / layout / lesson 全部 / library 全部 / not-found / alliance）

审查日期：2026-08-08
文件数：70
总问题数：见文末统计

---

## apps/edu/app/job/layout.tsx
无问题（薄封装 PlatformLayout，无逻辑）。

## apps/edu/app/job/learn-roads/page.tsx
- [P3][代码健壮性] 行 130 — orphan 场景 ID 使用 `Math.random()` 生成，每次进入编辑态 ID 不同；`scenesToSteps`（行 150）以 `orphan-` 前缀判定是否回写 scenarioId，若真实场景 id 恰好以 `orphan-` 开头会被误判为孤儿（真实 UUID 前缀不冲突，风险极低）。最佳实践：改用序号 `orphan-${index}` 保证稳定且不依赖随机。
- [P3][重复代码] 行 262 与 352、434 — `t('{n} 任务 · {h} 课时')` 文案重复出现三处；行 576-581 场景任务两次并行全量拉取（scenarioApi.list + 每场景 taskApi.list）。可接受，不强制。
- [P2][竞态] 行 610-613 — `handleEdit` 中 `loadPositionScenes` 与 `learnRoadApi.list` 并行，若用户快速连续点击两个岗位（按钮仅由 `editLoading` 禁用，点击第二行时第一行的 loading 尚未 setState 生效），先发起的请求可能后返回覆盖后发起的场景数据。最佳实践：保存请求序号或用 `editLoading` 同步阻塞 + 校验 `editingPosition.id` 是否仍为当前。
- [P3][边缘] 行 672-683 — 创建成功后 `update` 失败时已创建 road 留存，但 `learnRoadId` 已设置，重试走更新路径，可自愈。容忍。

## apps/edu/app/job/positions/[id]/edit/page.tsx
- [P1][数据丢失] 行 249-252 — `handleFinish` 先 `await handleSave()`（内部 try/catch 吞掉错误仅 toast），随后**无条件** `router.push('/job/positions')`；保存失败时仍跳转，用户误以为已保存，数据丢失。最佳实践：`handleSave` 改为返回 boolean 或在组件内保存失败标记，`handleFinish` 仅在成功时跳转（参照 granular/add 的 `hasSavedRef` 模式）。
- [P3][死代码] 行 55-57 — `setBatches`、`setMajorMap`、`setIndustryMap` 的 setter 全部丢弃（`const [, setBatches]`），fetch 结果无人消费；major/industry 字典拉取（行 181-192）纯属浪费请求。最佳实践：删除未使用的拉取，或真正传入子组件。
- [P2][竞态] 行 181-192 — 字典加载 Promise 无 cancelled 守卫，卸载后 setState（React 18 无警告但属隐患）；且该结果未被任何地方使用（同上）。
- [P3][稳定性] 行 295-306 — 返回删除草稿使用 `positionApi.delete`，若 position 为 undefined 会抛错（前置 `if (!position)` return 已挡住，安全）。容忍。

## apps/edu/app/job/positions/page.tsx
无问题（ContentListPage 配置式页面）。

## apps/edu/app/job/recommend/page.tsx
- [P2][一致性] 行 95-112 — `handleMove` 用 `Promise.all` 并发更新全部推荐顺序；若中途某个 update 失败，其余已成功更新，列表出现**部分排序生效**且无回滚（随后 refresh 拉回服务端状态，视觉上"排序失败"但服务端已部分变更）。最佳实践：串行逐个更新或失败时反向补偿。
- [P3][性能] 行 307 — 每行 `positions.find` O(n²)（n≤1000，可接受）；行 335 `formatDate(position?.createdAt)` 未判空（position 可能为 undefined，formatDate 需容忍 null）。
- [P3][健壮性] 行 330 — `POSITION_TYPE_LABELS[rec.positionType]` 无 fallback，未知类型渲染 undefined。

## apps/edu/app/job/workflows/page.tsx
无问题。

## apps/edu/app/layout.tsx
无问题（head 内联脚本均有 try/catch 守卫，Provider 层级正确）。

## apps/edu/app/lesson/admin/approvals/page.tsx
- [P2][内存/生命周期] 行 48-55 — 课程/批次字典加载无取消守卫，组件卸载后可能 setState。轻微。
- [P3][类型] 行 114 — `mapRecord(a: any)` 未用 ApprovalRecord 类型；行 37 `history?: any[]` 未消费。

## apps/edu/app/lesson/admin/archive/page.tsx
无问题。

## apps/edu/app/lesson/admin/batches/page.tsx
无问题。

## apps/edu/app/lesson/admin/_components/ability/ability-point-selector.tsx
- [P3][语义] 行 30-31 — `onChange`/`onAddCustom` 均可选，若两者都未传则组件完全不可用但 UI 正常渲染（死交互）。最佳实践：要求至少一个 prop 或禁用按钮。

## apps/edu/app/lesson/admin/_components/assessment/evaluation-method-selector.tsx
- [P3][兼容性] 行 23-27 — `COURSE_METHOD_KEYS` 只含 paper/question_bank/quiz/homework；旧数据中 `exam` 键的已选方法不会出现在可选项里，`selectedKeys` 中残留 `exam` 时静默不可见且保存时被保留（`toggleMethod` 只处理可见项）。轻微。

## apps/edu/app/lesson/admin/_components/common/rich-text-editor.tsx
- [P3][i18n] 行 73-94 — `defaultPlaceholder` 为长段硬编码中文模板（`t()` 包裹，字典缺失时 fallback 到原文）。若英文环境字典未收录该整段 key，会显示中文模板。建议改为结构化的短占位符。

## apps/edu/app/lesson/admin/_components/courses/course-admin-page.tsx
- [P3][硬编码] 行 42-44 — 当 `creatorId === currentUserId` 时 creator 显示"杭州知与未来科技有限公司"硬编码公司名，多租户/多学校场景不成立。建议后端返回 creatorName（courseListSelectColumns 已有 `creator_name`）。
- [P3][死代码] 行 34 — `lessonCount: 0` 硬编码恒为 0，列表未使用该字段。

## apps/edu/app/lesson/admin/_components/courses/course-list.tsx
- [P3][UX] 行 61 — `courses.length === 0` 直接 return null，空态依赖 ContentListPage 统一处理（需确认上游有空态）。无问题。

## apps/edu/app/lesson/admin/_components/knowledge/knowledge-selector.tsx
无问题（re-export）。

## apps/edu/app/lesson/admin/_components/resources/resource-selector.tsx
无问题（re-export）。

## apps/edu/app/lesson/admin/granular/add/page.tsx
- [P2][状态陈旧] 行 97-111 — `customKnowledgePointIds` 在 effect 内先 `setCustomKnowledgePointIds(new Set())` 再逐条 functional update，随后**同步**读取 `customKnowledgePointIds.has(k.id)`（行 108）用的是本次渲染的陈旧空集合快照，导致池中所有课程自定义知识点 `linked` 恒为 true，自定义标识在复选框中不生效。最佳实践：在 effect 内先构建完整 Set 局部变量，一次 setState。
- [P2][数据完整性] 行 275-283 — 新建课程（editId 为 null）时自定义知识点 `knowledgeApi.create({ sourceId: editId })` 写入 sourceId=null；保存后 `router.replace` 带新课程 id，再次加载时 `k.sourceId === editId` 匹配不到这些知识点 → 不再被识别为"课程自定义"，后续编辑改名/描述**静默不再同步**（仅保留绑定关系）。最佳实践：创建课程拿到真实 id 后补一次 `knowledgeApi.update` 回填 sourceId。
- [P2][部分失败] 行 354-381 — 新课程 `courseApi.create` 成功后 `persistNewResources` 失败会走 catch，此时课程已创建但 URL 未替换（router.replace 未执行），用户重试保存会**再创建一门重复课程**。最佳实践：create 成功后先 replace URL 再持久化资源。
- [P2][跨类型] 行 143 — `setHours(String(c.onlineHours ?? c.offlineHours ?? ''))`，混合课程线上/线下小时语义混用，仅用于展示，轻微。

## apps/edu/app/lesson/admin/granular/page.tsx
无问题。

## apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx
- [P2][陈旧闭包] 行 310-329 — `AttachmentListEditor.handleFileChange` 上传完成回填时读取闭包中的 `items`，若上传期间用户新增/删除/编辑了其他附件，`items.findIndex` 定位到旧索引，回填位置错位或丢失。最佳实践：上传开始时记录 itemId 对应的最新 index（或用 functional update 按 id 更新）。
- [P3][数据冗余] 行 141-168 — `NodeModuleData.lectureContent` 在 `LectureModule`（行 691-756）中从未被编辑，仅序列化时透传；`createDefaultNodeModuleData` 未初始化 `teachingDesignGroups` 时 undefined（行 1088 等处有 `?.` 保护）。轻微。

## apps/edu/app/lesson/admin/hybrid/add/_components/module-preview.tsx
无问题。

## apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.test.ts
无问题（测试文件）。

## apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.ts
- [P3][重复定义] 行 7 — `POST_REVIEW_DEFAULT`（'请输入课后总结内容'）与 atomic-modules.tsx 行 239 的默认文案重复定义两处，将来只改一处会导致"用户未修改课后总结"的判空逻辑失效（行 71 `!== POST_REVIEW_DEFAULT`）。最佳实践：从同一常量文件导出。

## apps/edu/app/lesson/admin/hybrid/add/page.tsx
- [P1][静默失败] 行 765-769 — `saveNodes` 第二遍保存节点模块时 `hybridModuleApi.batchSave` 的异常被 `reportError` 吞掉不向上抛，`handleSave` 继续执行并 toast"草稿已保存"——节点模块（课前预习/任务/测验等全部教学内容）保存失败用户无感知，**静默数据丢失**。最佳实践：模块保存失败应抛错中止并提示，或至少汇总失败数量 toast。
- [P1][保存死锁] 行 723-754 — `saveNodes` 按 `order` **全局**排序创建节点；当存在多个根节点且后面的根节点带子节点时（如 A(1)、A1(1)、B(2)、B1(1)），排序结果为 A、A1、B1、B——子节点 B1 先于父节点 B 创建，`idMapping.get(node.parentId)` 取不到，回退传临时 parentId → 后端 `system_course_nodes_parent_id_fkey` 外键失败（已核实 backend/migrations/001_baseline.up.sql:2157）→ 保存报错；失败路径不刷新节点，重试顺序不变，**该节点及其子树永远无法保存**。最佳实践：按 parentId 拓扑排序（父先子后），或对临时父节点递归先建父。
- [P1][脏数据] 行 699-704（buildCoursePayload）— 自定义能力点 id（`ap-custom-*`）直接进入 `abilityPointIds` 提交；后端 `jsonSliceToUUIDSlice`（backend/internal/handler/common.go:342）只过滤 `kp-custom-` 前缀，`ap-custom-*` 会**原样写入 courses.ability_point_ids**，刷新后无对应能力点记录（前端回填显示裸 ID 为名称），能力汇聚聚合失效。最佳实践：保存前将自定义能力点先 `abilityApi.create` 换取真实 ID，或后端过滤/校验该前缀。
- [P2][重复加载覆盖] 行 190-323 — 加载 effect 依赖 `abilityPool`（行 323），首次渲染 abilityPool=[] 触发加载，ability 拉取完成后 abilityPool 变化 → effect **重跑**，编辑模式下重新拉取课程/节点/模块并整体覆盖 `nodeDataMap`/`moduleAssignments`/`selectedNodeId`——若用户在两次加载窗口内已编辑（毫秒级，概率低），编辑内容被静默覆盖。最佳实践：去掉 abilityPool 依赖或仅在未加载过时跑一次。
- [P2][字段丢失] 行 691-692 — `buildCoursePayload` 使用 `existing?.semester`/`existing?.className`，用户对 `courseForm.semester` 的修改（表单初始化即持有该字段）永远不生效。若该字段无 UI 输入则为死字段，建议删除或打通。
- [P3][i18n] 行 151-153 — `claimSessionNames` 拼接"第 N 周 · ..."未包 t()。轻微。

## apps/edu/app/lesson/admin/hybrid/page.tsx
无问题。

## apps/edu/app/lesson/admin/layout.tsx
- [P3][权限 UX] 行 29-44 — 无权限时 `children` 仍被渲染（被遮罩层盖住），数据已加载到 DOM；前端路由守卫属"遮罩式"而非"拦截式"。考虑到后端接口有鉴权，风险可控。最佳实践：可选改为直接渲染权限提示不挂载 children。

## apps/edu/app/lesson/admin/system/add/_components/CourseNodeTree.tsx
- [P3][拖拽] 行 160-171 — `getBoundingClientRect` 每次 dragover 触发（高频），性能可接受；行 173-178 dragleave 判断依赖 `contains(relatedTarget)`，浏览器差异下偶发指示不消失。均为边缘交互瑕疵，容忍。

## apps/edu/app/lesson/admin/system/add/_components/lesson-save-roundtrip.test.ts
无问题（测试文件）。

## apps/edu/app/lesson/admin/system/add/_components/lesson-save-utils.ts
- [P2][运算符优先级] 行 141-144 — `draft?.estimatedHours || node.estimatedHours ? parseFloat(...) : undefined` 实际解析为 `(a || b) ? c : d`：当用户**清空** estimatedHours（draft=''）而 node 原值存在时，回退用旧值，**用户无法清空该字段**；且 draft='2.5' 之类字符串直接 parseFloat，无 NaN 兜底（parseFloat('')=NaN）。最佳实践：显式 `const v = draft?.estimatedHours; const eh = v !== undefined && v !== '' ? parseFloat(v) : node.estimatedHours`。

## apps/edu/app/lesson/admin/system/add/_components/PublishCheckPanel.tsx
无问题。

## apps/edu/app/lesson/admin/system/add/page.tsx
- [P1][保存死锁] 行 616-697 — 与 hybrid/add 相同：`saveNodes` 全局按 order 排序创建节点，多根节点下子节点可能先于父节点创建 → 后端外键失败（001_baseline.up.sql:2157），失败不刷新、重试顺序不变，**子树永远无法保存**。修复同 hybrid（按 parentId 拓扑排序）。
- [P1][脏数据] 行 729 — 自定义能力点 `ap-custom-*` 假 ID 随 abilityPointIds 入库（后端仅过滤 `kp-custom-`，common.go:342）。修复同 hybrid。
- [P2][重复加载覆盖] 行 167-233 — 编辑加载 effect 依赖 `abilityPool`（行 233），abilityPool 首次填充后 effect 重跑，重复拉取并重置 courseName/nodes/selectedNodeId 等全部状态，存在覆盖用户编辑窗口。修复同 hybrid（去依赖或一次加载）。
- [P2][引用节点资源绑定] 行 678-696 — quote 节点（refType=original）在 `buildNodeSavePayload` 中不携带 resourceIds，但**本地资源上传循环对所有真实节点执行**：引用模式下选中的颗粒课资源（handleGrainConfirm 行 552-554 已 setSelectedResourceIds）若命中 `res-`/本地池资源，会被 `nodeResourceApi.create+bind` 绑到引用节点上，与"引用不可编辑"语义冲突。最佳实践：引用节点跳过资源持久化。
- [P2][静默丢失] 行 632-647 — 自定义知识点 `knowledgeApi.create` 失败仅 reportError 继续，后续 `resolveKnowledgePointIds` 把 `kp-custom-*` 过滤掉 → 该知识点从保存中**静默消失**，用户只看到一条控制台错误。最佳实践：失败即中止保存并 toast。
- [P2][竞态] 行 524-590 — `handleGrainConfirm` 异步拉取颗粒课详情后 setKnowledgePoints/setSelectedResourceIds 无守卫，期间切换节点会把颗粒课数据写入错误节点。最佳实践：回填前校验 selectedNodeId 未变化。
- [P3][hack] 行 548、556 — `courseApi.get(\`${grain.id}?_t=${Date.now()}\`)` 与 `resourceLibraryApi.list({ _nocache: Date.now() })` 通过伪造查询参数绕过缓存，属脆弱 hack。最佳实践：api client 支持显式 cache-bust 参数。

## apps/edu/app/lesson/admin/system/page.tsx
无问题。

## apps/edu/app/lesson/admin/workflows/page.tsx
无问题。

## apps/edu/app/lesson/landing/[id]/learn/page.tsx
- [P2][跨节点状态残留] 行 273/280、322/341 — `submittedMethodKeys`/`hybridSubmittedKeys` 以 methodKey 为键、**切换节点不重置**；若节点 B 与节点 A 配置了相同 methodKey，切到 B 后卡片直接显示"已提交/pending"（`overriddenResult` 行 708-714 短路），用户误以为已提交。最佳实践：提交键带上 nodeId，或在 activeNodeId 变化时清空。
- [P2][竞态] 行 182-191 — `nodeEvaluationResultApi.list` 无取消/序号守卫，快速切换节点时旧响应可能覆盖新节点结果。最佳实践：引入 cancelled 标志或 AbortController。
- [P2][竞态] 行 132-156 — 节点/混合模块加载 effect 依赖 `[id, course, targetNodeId]`，无 cancelled 守卫，切换 id 时旧响应可覆盖。最佳实践：加取消标志。
- [P3][静默失败] 行 344-354 — `handleFileUpload` catch 后返回 null，失败原因无提示（对话框内 EvalMethodSubmitDialog 是否有错误提示取决于其实现）。轻微。
- [P3][类型] 行 287 — `toEvalMethodView(m: any)` 未收敛类型。

## apps/edu/app/lesson/landing/[id]/page.tsx
- [P2][崩溃风险] 行 649 — `course.creatorId.slice(0, 8)`：creatorId 为 null/undefined（老数据或异常记录）时 TypeError 整页崩溃。行 655/745/751 等 `course.nodeCount`/`onlineHours` 亦有 undefined 渲染风险（显示空白，不崩）。最佳实践：`(course.creatorId || '').slice(0, 8)`。
- [P2][截断] 行 141 — `courseResourceApi.list({ courseId, limit: 10000 })` 超过后端 maxPageSize（200）被截断，资源中心数据不完整且无提示。最佳实践：分页拉取或多页合并。
- [P2][竞态] 行 132-153 — 三个并行拉取均无取消守卫，切换课程 id 时旧数据可覆盖。轻微。

## apps/edu/app/lesson/landing/layout.tsx
无问题。

## apps/edu/app/lesson/landing/page.tsx
- [P2][截断] 行 123 — `courseApi.list({ status:'published', limit:1000 })` 客户端全量拉取；课程数超后端上限时列表/筛选/统计不完整且无提示。最佳实践：服务端分页或至少展示截断提示。
- [P3][死代码] 行 22 — CourseCard 的 `index` prop 未使用。

## apps/edu/app/lesson/layout.tsx
无问题（登录守卫正确，landing 豁免）。

## apps/edu/app/library/ability/page.tsx
- [P2][部分成功误导] 行 115-139 — 实体 create/update 成功后才 `saveTags`，标签保存失败会整体 catch 并 toast"保存失败"，但实体实际已保存——用户重试会**重复创建**。最佳实践：标签失败单独 toast 且不阻止关闭弹窗。

## apps/edu/app/library/certificates/page.tsx
- [P2][部分成功误导] 行 124-149 — 与 ability 页相同问题（create/update 成功后 saveTags 失败被误报"保存失败"）。
- [P3][风格] 行 30 — `import { useEffect } from 'react'` 与其它 import 分离在文件末尾，lint/风格不一致。

## apps/edu/app/library/_components/library-page-shell.tsx
无问题。

## apps/edu/app/library/_components/use-library-crud.ts
- [P3][重复请求] 行 84-87 — `handleSearchChange` 同时 setSearchQuery + setPage(1)，loadItems 依赖两者变化会触发两次请求（最终状态一致，仅浪费）。轻微。

## apps/edu/app/library/knowledge/_components/granular-lesson-select-dialog.tsx
无问题。

## apps/edu/app/library/knowledge/_components/knowledge-point-form-dialog.tsx
- [P3][一致性] 行 70 — 编辑模式 `code` 初始来自 `initialValues?.code ?? ''`；若 initialValues 延迟到达（异步编辑对象），effect 依赖 [open, initialValues, mode] 已覆盖。无问题。

## apps/edu/app/library/knowledge/page.tsx
- [P3][数据一致性] 行 151 — 创建颗粒课 `category: t('专业基础')` 与 atomic-modules.tsx 的 `COURSE_CATEGORIES` 枚举（'专业基础课程'）不一致，混合课编辑器回填时该分类会回退到默认值。
- [P3][误导] 行 162-171 — 编辑态创建颗粒课成功后 `knowledgeApi.update` 失败会走外层 catch 提示"创建颗粒课失败"，实际颗粒课已创建。轻微。

## apps/edu/app/library/landing/layout.tsx
无问题。

## apps/edu/app/library/landing/page.tsx
- [P2][截断] 行 232 — `resourceLibraryApi.list({ limit: 500 })` 客户端全量拉取，资源超过后端上限时统计卡片、类型/院系/专业筛选、列表均不完整且无提示。最佳实践：统计用 stats 接口、列表分页。
- [P3][性能] 行 281 — `const [now] = useState(() => Date.now())` 固定挂载时间，"近一周/一月"随时间推移静默失效（页面长期挂着时）。轻微。

## apps/edu/app/library/layout.tsx
- [P3][权限 UX] 行 37-47 — 与 lesson/admin/layout 相同的"遮罩式"权限守卫，children 仍挂载。可接受。

## apps/edu/app/library/my-resources/page.tsx
- [P3][状态] 行 102/126 等 — `truncated` 一旦置 true 永不重置，切 tab 后横幅常驻。轻微。
- [P3][截断] 行 120 — 代码自带 TODO 注释承认 limit 200 截断问题，已有横幅提示。容忍。

## apps/edu/app/library/questions/page.tsx
- [P2][截断] 行 47 — `limit: 9999` 超后端 maxPageSize 被截断为 200，且 `totalPages = ceil(total/9999) = 1`，**只展示前 200 条、无分页也无截断提示**。最佳实践：limit 传 200 并用服务端分页。
- [P3][类型] 行 60、96、192 — `editing: any`、`item: any`、`majors: any[]` 未收敛类型。

## apps/edu/app/library/resources/_components/resource-batch-import-dialog.tsx
- [P3][竞态] 行 115-151 — 逐文件串行上传（大文件列表时慢，但进度反馈完整）；单文件失败仅计数不中断，失败详情不可见。容忍。
- [P3][重名探测] 行 183-195 — `previewImport` 返回的子集（可能受 limit 限制）之外的重复名会直接创建（mode 'skip' 也无法拦截），产生重复资源。轻微。

## apps/edu/app/library/resources/_components/resources-page.tsx
- [P3][计数语义] 行 159 — `statCount = total`（当前搜索/筛选下的总数）用于"资源总数"统计卡，与类型统计卡（stats 接口）口径不同。可接受，建议标注。

## apps/edu/app/library/resources/_components/resource-upload-zone.tsx
无问题。

## apps/edu/app/library/resources/_components/use-resource-crud.ts
- [P2][部分成功误导] 行 186-212 — 与 ability/certificates 相同：实体保存成功、标签绑定失败 → toast"保存失败"且弹窗不关闭，重试会重复创建（无幂等）。最佳实践：标签失败单独提示。
- [P3][垃圾文件] 行 162-175 — 文件上传成功后 create 失败，CDN 产生孤儿文件（无清理机制）。轻微。

## apps/edu/app/library/resources/page.tsx
无问题。

## apps/edu/app/library/resources/[type]/page.tsx
无问题。

## apps/edu/app/library/tags/page.tsx
无问题。

## apps/edu/app/not-found.tsx
无问题。

## apps/edu/app/portal/alliance/achievements/[id]/page.tsx
无问题。

## apps/edu/app/portal/alliance/achievements/page.tsx
无问题。

## apps/edu/app/portal/alliance/brands/major/[id]/page.tsx
无问题。

## apps/edu/app/portal/alliance/brands/page.tsx
- [P3][i18n] 行 39-43 — `allianceLabel('brandType', type)` 返回的中文标签未包 `t()`，英文环境下 tab 名仍为中文（achievements 页的 `t(tab.label)` 已正确包裹）。建议统一走 i18n。

---

## 汇总统计
- 审查文件数：70
- 总问题数：49（P0: 0，P1: 5，P2: 23，P3: 21）

### P1 摘要（按严重级）
1. `apps/edu/app/lesson/admin/system/add/page.tsx:616-697` 与 `apps/edu/app/lesson/admin/hybrid/add/page.tsx:723-754` — saveNodes 全局按 order 排序创建节点，多根节点场景子节点先于父节点创建，后端 parent_id 外键失败且重试顺序不变，节点子树永久无法保存
2. `apps/edu/app/lesson/admin/hybrid/add/page.tsx:765-769` — 节点模块 batchSave 异常被 reportError 吞掉，handleSave 仍提示"草稿已保存"，模块教学内容静默丢失
3. `apps/edu/app/lesson/admin/hybrid/add/page.tsx:699-704` 与 `apps/edu/app/lesson/admin/system/add/page.tsx:729` — 自定义能力点 `ap-custom-*` 假 ID 直接入库（后端仅过滤 kp-custom- 前缀），刷新后显示裸 ID、能力汇聚失效
4. `apps/edu/app/job/positions/[id]/edit/page.tsx:249-252` — 保存失败仍无条件跳转列表页，用户误以为已保存，数据丢失

（P0 无。）
