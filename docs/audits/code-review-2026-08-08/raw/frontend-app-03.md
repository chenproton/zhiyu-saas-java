# 前端代码审查报告（复查）— 批次 frontend-app-03

> 范围：`apps/edu/app/portal/alliance/**`（公开联盟页）+ `apps/edu/app/portal/apps/alliance/**`（联盟管理）+ `apps/edu/app/portal/apps/**`（应用中心）+ `apps/edu/app/portal/apps/system/**`（系统管理）
> 共 58 个文件，逐行通读。本批为 2026-08-07 全量审查后的**复查**：已修项回归确认、上轮遗漏、新问题。后端契约已核实：`backend/internal/handler/alliance_crud_handler.go`、`user_extension_field_handler.go`、`store/alliance_agreement_store.go`、`store/user_extension_fields.go`、`packages/api-client/src/api/alliance.ts`。
> 级别：P0 运行时必错 / P1 严重 / P2 重要 / P3 一般。`✅ 已修复` 为回归确认项。

---

## apps/edu/app/portal/alliance/enterprises/[id]/page.tsx
- [P3][i18n] 该文件 150 行总体无逻辑问题：第 134 行 `key={idx}` 下标作 key（照片固定内容，可容忍）；第 25-30 行详情加载失败仅 reportError，enterprise 为 null 时显示"企业不存在"，与真实"加载失败"混淆（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/alliance/enterprises/page.tsx
- 无问题（上轮 P3 列表过滤开销轻微，可容忍，未修）。

## apps/edu/app/portal/alliance/experts/[id]/page.tsx
- [P3][逻辑] 该文件 179 行：第 67-69 行 `expert.rating ? allianceLabel('expertRating', ...) : allianceLabel('expertStatus', ...)` — rating 为空时降级显示"状态"徽章，语义混乱（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/alliance/experts/page.tsx
- 无问题（上轮 P3 specialties 扫描开销轻微，未修，可容忍）。

## apps/edu/app/portal/alliance/landing/page.tsx
- [P2][i18n] 第 464 行：`<LandingEmpty title={`暂无${t(cat.title)}`} />` — 模板串拼接中文"暂无"，整串未作翻译 key，切语言后仍是中文；最佳实践：`t('暂无{t}', { t: t(cat.title) })`（上轮已报，未修）。
- [P2][契约] 第 259 行 `/alliance/public/achievements?sort=latest`：后端 `ListPublicAchievements` 固定 `ORDER BY created_at DESC LIMIT 100`，sort 参数被静默忽略（默认即最新，无实际影响，参数无效）（上轮已报，未修）。
- [P2][契约] 第 304 行 `data.brands.filter((b) => b.isFeatured || b.isPublic)`："推荐品牌"语义与后端"最近 12 条"不符（上轮已报，未修）。
- [P3][风格] 第 292 行 `const t = useT()` 声明在 useEffect（239-290 行）之后，hooks 顺序稳定不崩但可读性差；第 193-214 行 grid 缩进错乱（上轮已报，未修）。
- 无 P0/P1。

## apps/edu/app/portal/alliance/layout.tsx
- 无问题（FULL_WIDTH_PAGES 精确匹配，详情页走容器布局，符合预期）。

## apps/edu/app/portal/alliance/page.tsx
- [P2][契约] 第 40 行 `/alliance/public/brands?isFeatured=true`：后端 `ListPublicBrands` 仅读 `brandType`，`isFeatured` 被忽略，"品牌展示"实际是最近 6 条（上轮已报，未修）。
- [P3][冗余] 第 137 行 `key={i}` 下标作 key；第 125-143 行 `brand.data` 经 any 断言与 shared-types 不完全一致（上轮已报，未修）。
- 无 P0/P1。

## apps/edu/app/portal/alliance/projects/[id]/page.tsx
- 无问题。

## apps/edu/app/portal/alliance/projects/page.tsx
- 无问题（上轮 P3 搜索无防抖，数据量小可容忍）。

## apps/edu/app/portal/apps/alliance/achievements/[id]/edit/page.tsx
- [P3][类型] 第 87 行 `setField(field: string, value: any)` 全 any；第 89-91 行 `(item as any).enterpriseIds/projectIds/secondaryColleges` 依赖后端返回字段，运行时安全（上轮已报，未修）。
- ✅ 已修复：第 74 行 update 全量回传 item（含关联字段），与后端全列覆盖契约一致。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx
- [P2][类型] 第 91、124、144 行：`relatedPositions/relatedScenes/relatedCourses` 运行时为 `[{id,name}]` 对象数组，shared-types `AllianceAchievement.relatedPositions?: string[]` 类型声明错误，全靠 `as any` 绕过；若历史数据为字符串数组，`removeItem` 的 `x.id` 过滤将失效；最佳实践：修正 shared-types 为 `RelatedRef[]`（上轮已报，未修）。
- [P3][竞态] 第 102-118 行 addItem/removeItem 未受 `saving` 互斥保护（双击可重复提交）；第 98 行 `achievements.filter(a => a.type === typeKey)` 依赖 list limit 200 截断（上轮已报，未修）。
- ✅ 已修复：第 49 行 `/career/positions?limit=200` → `/job/positions?limit=200`，岗位选择器可用（上轮 P1）。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/achievements/new/page.tsx
- [P2][功能缺口] 第 48-57 行初始 item 未含 `relatedPositions` 等关联字段，创建后需二次编辑补充（上轮已报，未修）。
- [P3][校验] 第 111 行"成果名称"标 required 但 handleSave 无前端校验，后端兜底 400（上轮已报，未修）。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/achievements/page.tsx
- 无问题。✅ 已修复：第 219-223 行 onToggleEnabled 全量回传（`{...item, isPublic}`）避免部分字段被清空（与后端全列覆盖契约一致）；PortalCrudPage 在 toggle 后自动 `onRetry()` 刷新。
- [P3][冗余] 第 132-146 行 createDefault 含 enabled/viewCount 等冗余字段（上轮已报，未修）。

## apps/edu/app/portal/apps/alliance/agreements/[id]/edit/page.tsx
- [P2][数据丢失] 第 55-79 行：加载失败时 `item` 保持初始空值且 `loading=false`，页面渲染空表单而非错误/空态（对比 achievements/[id]/edit 有 `if (!item)` 分支）；用户填写保存后 PUT 全列覆盖（协议更新**无** ValidateUpdateExisting 兜底，已核实 alliance_crud_handler.go:416-449）→ 原记录被替换；最佳实践：加载失败后禁用保存并提示（上轮已报，未修）。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/agreements/[id]/page.tsx
- 无问题。

## apps/edu/app/portal/apps/alliance/agreements/new/page.tsx
- 无问题。

## apps/edu/app/portal/apps/alliance/agreements/page.tsx
- [P3][契约] 第 163-168 行模态编辑"协议类型"为自由文本 Input，与专用 new/edit 页 AGREEMENT_TYPES 下拉口径不一致（上轮已报，未修）。
- [P3][冗余] 第 228 行 `onToggleEnabled={async () => {}}` 空实现（表中无 Switch，占位死代码）（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/culture/page.tsx
- [P3][重复代码] 与 talent/employer/job/major/teacher 五页几乎逐行相同（仅 brandType/label/关联字段/fetchUrl 不同），共 6×206 行重复；最佳实践：抽 `BrandCrudPage` 配置化组件（上轮已报，未修）。
- [P3][冗余] 第 203 行 `onToggleEnabled={async () => {}}` 空实现（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/employer/page.tsx
- [P3][重复代码] 同 culture 页模板（上轮已报，未修）；第 180 行 `fetchUrl="/alliance/enterprises?limit=200"` 契约正确。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/job/page.tsx
- [P3][重复代码] 同前（上轮已报，未修）；第 180 行 `/job/positions` 契约正确。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/major/page.tsx
- [P3][重复代码] 同前（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/talent/page.tsx
- [P3][重复代码] 同前（上轮已报，未修）；第 180 行 `fetchUrl="/users?role=student&limit=200"` 依赖后端 users 列表 role 参数（契约待确认）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/teacher/page.tsx
- [P3][重复代码] 同前（上轮已报，未修）；第 189 行 `/alliance/experts?limit=200` 契约正确。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/[id]/page.tsx
- [P3][逻辑] 第 38-45 行关联对象仅展示原始 ID（Badge 显示 uuid），无名称解析，可读性差（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/page.tsx
- [P3][契约] 第 66 行 `allianceBrandApi.list()` 未按品牌类型过滤，全量拉取后前端计数（数据量大时可分组请求）（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/dictionaries/page.tsx
- [P3][死代码] 第 93 行 `finally { }` 空块；第 102 行新项 `sortOrder: items.length` 与删除后编号语义无关（可容忍）。
- ✅ 已修复：上轮 P3 死状态 `const [, setDeleting] = useState(false)` 已删除。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/enterprises/[id]/edit/page.tsx
- [P3][类型] 第 79 行 `value: any`；第 112 行起 `(item as any)` 系列（unifiedSocialCreditCode/establishedYear/employeeCount 等字段 shared-types 缺失，运行时后端返回，OK）（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/enterprises/[id]/page.tsx
- [P2][截断] 第 72-87 行 `list({limit:200})` 三路截断：协议/项目/成果超 200 条时详情页各 Tab 过滤基于截断列表，已关联项缺失（上轮已报，未修）。
- [P3][类型] 第 188 行起大量 `(enterprise as any)`；第 237-292 行三次重复 img 列表渲染（可抽公共组件）（上轮已报，未修）。
- ✅ 已修复：unlinkAgreement 对"仅关联本企业"的协议写 `enterpriseIds: []` 正常生效（后端协议更新无回退钩子，直接写空数组，行为正确）；projects 侧已由后端 nil/空数组区分语义兜底，两处"取消最后一个关联"现均正确。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/enterprises/new/page.tsx
- 无问题（名称必填有前端校验）。

## apps/edu/app/portal/apps/alliance/enterprises/page.tsx
- 无问题。✅ 已修复：第 329-332 行 onToggleEnabled 走 `togglePublic`（后端企业有 ValidateUpdateExisting 兜底，部分更新安全）；toggle 后 PortalCrudPage 自动 refresh。
- [P3][类型] 第 59 行 countBy 泛型 any（上轮已报，未修）。

## apps/edu/app/portal/apps/alliance/experts/[id]/edit/page.tsx
- [P3][逻辑] 第 135-140 行：cooperation 来源未选企业时 `payload.organization = ''`，保存会清空原 organization 值（上轮已报，未修）。
- [P3][功能缺口] 第 51-78 行 item 含 `photos/expertType/professionalFields/positionDirection/rating` 但表单无控件，编辑页与新建页字段集不一致（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/experts/[id]/page.tsx
- [P3][截断] 第 26 行 `list({limit:200})` 后 `.find(x => x.id === e.enterpriseId)`：企业超 200 条时关联企业匹配失败（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/experts/new/page.tsx
- 无问题（名称必填有校验；下拉加载失败有 toast 提示）。

## apps/edu/app/portal/apps/alliance/experts/page.tsx
- [P3][契约] 第 114-124 行 createDefault 缺少 `title/position/industry/city/rating/introduction/organization` 等字段，模态创建仅提交表单字段，创建的专家缺字段需二次编辑（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/layout.tsx
- ✅ 已修复（上轮 P1）：第 46-52 行新增 `permitted = hasMenuPermission(pathname)` 内容级拦截，未授权角色显示统一"暂无权限"提示，与 system/layout 对齐。
- 无问题。

## apps/edu/app/portal/apps/alliance/permissions/page.tsx
- [P2][逻辑] 第 54 行 `p.accountName.toLowerCase()` 无空值防御 — 若后端返回 null accountName 会抛 TypeError 整行崩溃（后端 create 校验非空，风险低）；最佳实践：`(p.accountName || '')`（上轮已报，未修）。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/projects/[id]/edit/page.tsx
- 无问题（第 262 行已发布项目隐藏"发布项目"按钮，语义正确）。

## apps/edu/app/portal/apps/alliance/projects/[id]/page.tsx
- ✅ 已修复（上轮 P1）：unlinkAgr 取消最后一个协议写 `agreementIds: []`，后端 project ValidateUpdateExisting 已改为 **nil 才回退**（alliance_crud_handler.go:320-323 "显式传空数组表示清空关联"），空数组正常写入，关联解除生效。
- [P2][类型] 第 106-108、123-125、142-144 行 `(project as any).agreementIds` — shared-types `AllianceProject` 未声明 agreementIds，全靠 as any（上轮已报，未修）。
- [P3][截断] 第 87 行 `allianceAgreementApi.list({limit:200})` 截断导致协议 Tab 显示不全（上轮已报，未修）。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/projects/new/page.tsx
- [P3][校验] 第 120 行"项目名称"required 无前端校验，后端 ValidateCreate 兜底 400（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/projects/page.tsx
- [P2][i18n] 第 172-178 行阶段下拉直接渲染原始枚举值 `{v}`（archived/terminated 等显示英文），未走 `t()` 翻译，与第 121 行 `allianceLabel('projectPhase', ...)` 显示口径不一致（上轮已报，未修）。
- ✅ 已修复（上轮 P2）：第 42-46 行里程碑拉取改为 `Promise.all` 并行，消除 N+1 串行请求。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/school/page.tsx
- [P2][数据覆盖] 第 155-156 行：租户省份/城市不在 CHINA_REGION 或为空时，编辑表单默认回填 `北京 / 东城区`，用户不修改直接保存会把原地区覆盖为"北京/东城区"（数据污染）；最佳实践：默认留空，未选择不提交（上轮已报，未修）。
- [P3][冗余] 第 452-456 行电话同时写 `phone` 与 `contactPhone` 两字段（恒相等）；第 293 行 contact 为 '-' 时显示 "- / xxx"；第 564 行 `v === '- -'` 特殊判断脆弱（上轮已报，未修）。
- 无 P0/P1。

## apps/edu/app/portal/apps/page.tsx
- [P3][性能] 第 190 行 `getServiceClickCounts()` 每次挂载读 localStorage（受 try/catch 保护）；第 250-262 行"常用服务"每次 render 重算排序（数据量小）（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/layout.tsx
- [P3][风格] 第 26-30 行 render 期 setState 守卫模式（官方认可但易误读）；第 169 行认证加载期间渲染空白（无骨架屏）（上轮已报，未修）。
- ✅ 已修复（上轮 P1）：第 32、169-175 行 `permitted` 内容级守卫已存在，与 alliance layout 对齐。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/logs/login/page.tsx
- ✅ 已修复（上轮 P2）：第 30-33 行搜索 300ms 防抖已加（debouncedSearch），快速输入不再触发万级全量请求。
- [P3][竞态] 第 35-57、59-63 行：搜索输入时 `setPage(1)` 与 `setDebouncedSearch` 各自触发一次 loadLogs，两次并发请求先发后至可能互相覆盖（非搜索态分页请求晚到时覆盖搜索结果）；最佳实践：请求序号守卫或合并状态源。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/logs/operation/page.tsx
- ✅ 已修复（上轮 P2）：第 30-33 行搜索 300ms 防抖已加。
- [P3][竞态] 同 login 页：搜索与翻页并发请求可能覆盖（第 35-63 行）。
- [P3][逻辑] 第 80 行 `log.action.includes(keyword)` — action 为必填字段契约安全（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/accounts/page.tsx
- [P3][i18n] 第 134 行 `new Date(user.lastLoginAt).toLocaleString('zh-CN')` 硬编码中文区域，与全站 t() 约定不一致（新发现）；最佳实践：走 i18n 日期格式化。
- [P3][性能] 第 36-39 行 usePortalUsers search 无防抖（上轮已报，未修）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/fields/page.tsx
- [P1][契约/功能失效] 第 75-88 行 `handleToggle` 调用 `update(field.id, { isEnabled: !field.enabled })` — 后端 `UpdateUserExtensionFieldRequest` 校验 `FieldName == "" → 400 缺少必填字段`（user_extension_field_handler.go:65-67），store 更新为全列覆盖（user_extension_fields.go:60-63 写 field_name/is_enabled/is_required/applicable_role_codes）。**开关切换必然 400 失败**，且 `IsRequired` 零值 false 会连带改坏该字段；最佳实践：toggle 时回传完整字段（fieldName/isEnabled/isRequired/applicableRoleCodes），或后端改为部分更新语义（上轮仅标 P3"待确认"，本轮确认升级）。
- [P1][数据丢失] 第 90-96 行 `handleSave` 提交 `{ fieldName, applicableRoleCodes }` 缺 `isEnabled`/`isRequired` — Go 零值 false 被 store 无条件写入，**编辑字段名称/适用角色后该字段被静默禁用**（is_enabled 翻转为 false）且不可逆；最佳实践：提交完整对象（含原 isEnabled/isRequired）或后端按字段指针区分未携带。
- 无 P0。

## apps/edu/app/portal/apps/system/org-user/graduates/page.tsx
- [P2][分页缺失] 第 61-65 行：`usePortalUsers` 仅解构 `users/loading/error/refetch`，未取 `total/page/pageSize/setPage`，PortalCrudPage 也未传 `pagination` → 毕业学生超过默认 20 条时**只能看第一页、无法翻页**（对比 accounts 页第 168 行正确传了 pagination）（上轮已报，**未修**，回归确认）。
- 无 P0/P1。

## apps/edu/app/portal/apps/system/org-user/org-structure/page.tsx
- [P3][截断] 第 480-485 行批量毕业 `portalUserManagementApi.list({ limit: 1000 })` 后按返回 userIds 毕业，班级学生超 1000 时截断（新发现）。
- [P3][展示] 第 543 行 stats 仅展示前 5 种组织类型计数（新发现）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/org-types/page.tsx
- 无问题。

## apps/edu/app/portal/apps/system/org-user/positions/page.tsx
- [P3][i18n] 第 193 行 `new Date(position.createdAt).toLocaleString('zh-CN')` 硬编码中文区域（新发现）；最佳实践：走 i18n 日期格式化。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/relations/page.tsx
- [P3][性能] 第 58-64 行 `useAsync` deps `[searchText]` 无防抖，每击键触发一次服务端搜索请求（新发现）；最佳实践：300ms 防抖或前端过滤。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/roles/page.tsx
- 无问题（权限配置保存逻辑已核实：菜单/操作权限读写一致，未订阅模块的操作权限不保留）。

## apps/edu/app/portal/apps/system/org-user/students/page.tsx
- [P3][安全/风格] 第 395 行新建学生密码输入 `type="text"` 明文可见（新发现）；最佳实践：`type="password"` 或加显隐切换。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/teachers/page.tsx
- 无问题（创建/编辑均回传完整字段；职位多选与 titleIds 契约一致）。

## apps/edu/app/portal/apps/system/page.tsx
- 无问题（redirect 目标 `/portal/apps/system/tenant` 存在）。

## apps/edu/app/portal/apps/system/resource/codes/page.tsx
- 无问题。

## apps/edu/app/portal/apps/system/resource/industries/page.tsx
- [P3][死代码] 第 61 行 `hideCreate` 但第 204-214 行保留 create 分支，onSave 创建路径永不触发（新发现）。
- 无 P0/P1/P2。✅ onToggleEnabled 第 219-228 行全量回传字段，无部分更新清空风险。

---

# 汇总

- 审查文件数：58（逐行通读）
- 问题总数：33（P1×2、P2×11、P3×20）
- 已修复回归确认：8 项（alliance layout 权限守卫、/career→/job 岗位选择、日志防抖×2、projects N+1 并行、projects unlink 空数组语义、enterprises toggle 安全、dictionaries 死状态删除）

## P1 摘要
1. `org-user/fields/page.tsx:75-88` — 字段启用开关提交 `{isEnabled}` 缺 fieldName，后端 400 必填校验，开关**永远失败**（上轮 P3 待确认，本轮核实后端后升级）。
2. `org-user/fields/page.tsx:90-96` — 字段编辑保存缺 isEnabled/isRequired，Go 零值 false 全列覆盖写入 → **编辑后字段被静默禁用**（数据丢失）。

## P2 摘要（均为上轮已报、本轮确认未修）
- 回归未修 4 项：graduates 分页缺失（projects page 已修、此页漏修）；projects 阶段下拉枚举未 t()；permissions accountName 空值防御；school 省份默认北京覆盖数据。
- 未修 7 项：landing 暂无{t} i18n 拼接、landing/alliance sort 与 isFeatured 无效契约参数、agreements/[id]/edit 加载失败空表单覆盖、achievements 关联字段类型契约、achievements/new 创建后关联字段缺口、enterprises/[id] 200 截断。
- 本轮无新增 P2。
