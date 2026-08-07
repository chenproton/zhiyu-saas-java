# 前端代码审查报告 — 批次 frontend-app-03

> 范围：`apps/edu/app/portal/alliance/**`（公开联盟页）+ `apps/edu/app/portal/apps/alliance/**`（联盟管理）+ `apps/edu/app/portal/apps/**`（应用中心）+ `apps/edu/app/portal/apps/system/**`（系统管理）
> 共 56 个文件，逐行通读；后端契约已通过 `backend/internal/handler/alliance_crud_handler.go`、`alliance_handler.go`、`store/alliance_*_store.go`、`router/routes.go` 核实。
> 级别：P0 运行时必错 / P1 严重 / P2 重要 / P3 一般

---

## apps/edu/app/portal/alliance/enterprises/[id]/page.tsx
- [P3][i18n] 该文件 150 行总体无逻辑问题，仅有细节：第 134 行 `key={idx}` 用数组下标作 key（照片列表固定内容，可容忍）；第 25 行详情加载失败后仅 reportError，无错误态展示（enterprise 为 null 时显示"企业不存在"，与真实"加载失败"混淆）。
- 无 P0/P1/P2 问题。

## apps/edu/app/portal/alliance/enterprises/page.tsx
- [P3][性能] 第 40 行 `items.filter` 在 useMemo 内每次渲染前对全列表做过滤计算 count，列表量大时轻微浪费；无防抖搜索（PublicListShell 内输入触发全量前端过滤，本页数据量小，可容忍）。
- 无 P0/P1/P2 问题。

## apps/edu/app/portal/alliance/experts/[id]/page.tsx
- [P3][逻辑] 第 67-69 行：`expert.rating ? allianceLabel('expertRating', ...) : allianceLabel('expertStatus', ...)` — rating 为空串时降级显示"状态"徽章，语义混乱（状态正常/停用会与评级并列展示）。
- 无 P0/P1/P2 问题。

## apps/edu/app/portal/alliance/experts/page.tsx
- [P3][性能] 第 53-57 行搜索对 `specialties` 数组做 `some` 扫描，数据量大时有轻微性能开销；无防抖，可容忍。
- 无 P0/P1/P2 问题。

## apps/edu/app/portal/alliance/landing/page.tsx
- [P2][i18n] 第 464 行：`<LandingEmpty title={`暂无${t(cat.title)}`} />` — 模板字符串拼接中文前缀"暂无"，整串未作为翻译 key 传递，切换语言后仍是中文，与全站 t() 约定不一致；最佳实践：`t('暂无{t}', { t: t(cat.title) })`。
- [P2][契约] 第 259 行 `/alliance/public/achievements?sort=latest`：后端 `ListPublicAchievements`（alliance_achievement_store.go:148）固定 `ORDER BY created_at DESC LIMIT 100`，忽略 sort 参数（默认即最新，无实际影响，但参数是无效契约）。
- [P2][契约] 第 40 行（alliance/page.tsx）`/alliance/public/brands?isFeatured=true`：后端 `ListPublicBrands`（alliance_handler.go:722）仅读取 `brandType` 参数，`isFeatured` 被静默忽略；"推荐品牌"实际展示的是最近 12 条且前端再按 `isFeatured || isPublic` 过滤（第 304 行），语义与"推荐"不符。
- [P3][风格] 第 292 行 `const t = useT()` 声明在 useEffect（239-290 行）之后，hooks 调用顺序一致不会崩，但可读性差；第 193-214 行 grid 缩进错乱。
- 无 P0/P1。

## apps/edu/app/portal/alliance/layout.tsx
- 无问题（FULL_WIDTH_PAGES 精确匹配，动态路由详情页走容器布局）。

## apps/edu/app/portal/alliance/page.tsx
- [P2][契约] 第 40 行 `?isFeatured=true` 参数被后端忽略（见 landing 条），"品牌展示"实际是最近 6 条。
- [P3][冗余] 第 137 行 `key={i}` 下标作 key；`data.brands.data` 字段用 `as any` 数组断言，与 shared-types 类型不完全一致。
- 无 P0/P1。

## apps/edu/app/portal/alliance/projects/[id]/page.tsx
- 无问题（loading/空态/错误处理完整，`project.type` 直接展示原文而非 label，属业务展示细节）。

## apps/edu/app/portal/alliance/projects/page.tsx
- 无问题（与 enterprises 公开列表同构，契约字段 `phase` 与后端一致）。

## apps/edu/app/portal/apps/alliance/achievements/[id]/edit/page.tsx
- [P2][契约] 第 89-91 行：`(item as any).enterpriseIds / projectIds / secondaryColleges` — 依赖后端返回这些字段；已核实后端 `ScanAchievementRows`（alliance_achievement_store.go:26-43）返回 enterprise_ids/project_ids/secondary_colleges，运行时 OK，但类型层面 shared-types 的 `AllianceAchievement` 缺 `secondaryColleges` 之外的字段声明，全靠 `as any` 绕过。
- [P3][类型] 第 87 行 `setField(field: string, value: any)` 全 any；第 74 行 update 全量回传（含 relatedPositions 等未编辑字段）依赖后端无 ValidateUpdateExisting 时全列覆盖语义 — 当前安全，但语义脆弱。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx
- [P1][契约/静默失败] 第 49 行：`portalRequest<{ items: RelatedRef[] }>('/career/positions?limit=200')` — 后端**不存在** `/career/*` 路由（岗位 CRUD 注册于 `/job/positions`，routes_job.go:6），该请求必然 404，且被 `.catch(() => ({ items: [] }))` 静默吞掉 → "关联职业岗位" 选择器永远为空、该功能完全不可用且无任何错误提示。最佳实践：改用 `/job/positions?limit=200`。
- [P2][契约] 第 116-118 行与第 73-91 行：`relatedPositions/relatedScenes/relatedCourses` 运行时为 `[{id,name}]` 对象数组，但 shared-types `AllianceAchievement.relatedPositions?: string[]`（alliance.ts:116）类型声明错误；若历史数据为字符串数组（导入/旧数据），`ref.name`/`removeItem` 的 `x.id` 过滤将失效。建议修正 shared-types 类型为 `RelatedRef[]`。
- [P3][类型] 第 91、124、144 行大量 `as any`；第 102-118 行 addItem/removeItem 未受 `saving` 互斥保护（双击可重复提交）；第 98 行 `achievements.filter(a => a.type === typeKey)` 依赖 list limit 200 截断，超大库时可选场景/课程不全。
- 无 P0。

## apps/edu/app/portal/apps/alliance/achievements/new/page.tsx
- [P2][契约] 第 83 行 `allianceAchievementApi.create(item)` 中 `enterpriseIds/projectIds/secondaryColleges` 随 item 提交，后端支持；但第 48-57 行初始 item 未含 `relatedPositions` 等字段，创建后这些字段为空，与编辑页字段集不一致（编辑页可维护关联，新建后需二次编辑）— 功能缺口。
- [P3][校验] 第 111 行"成果名称"标 required 但 handleSave 无前端校验，后端 ValidateCreate（alliance_crud_handler.go:347）兜底返回 400，体验略差。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/achievements/page.tsx
- [P3][冗余] 第 132-146 行 `createDefault` 含 `enabled/viewCount/status` 等冗余字段；第 84-131 行 renderTableRow 全 `any`。
- 无 P0/P1/P2（第 219-223 行 onToggleEnabled 全量回传的注释与后端全列覆盖语义一致，正确）。

## apps/edu/app/portal/apps/alliance/agreements/[id]/edit/page.tsx
- [P2][数据丢失] 第 55-79 行：加载失败（网络瞬时错误）时 `item` 保持初始空值且 `loading=false`，页面渲染空表单而非错误/不存在提示（对比 achievements/[id]/edit 有 `if (!item)` 空态分支，本页缺失）；用户误以为是新建表单，填写保存后 PUT 全列覆盖（协议无 ValidateUpdateExisting 兜底）→ 原记录内容被替换。最佳实践：加载失败后区分错误/空态，`item` 为空时禁用保存。
- [P3][类型] 第 81 行 `value: any`；第 191-197 行 `ImageListUpload` 的 attachments 与后端 string[] 契约一致。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/agreements/[id]/page.tsx
- 无问题（结构完整，加载失败有 toast，notFound 分支正确）。

## apps/edu/app/portal/apps/alliance/agreements/new/page.tsx
- [P3][校验] 第 110 行"协议名称"required 有校验；无其他问题。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/agreements/page.tsx
- [P3][契约] 第 163-168 行模态编辑表单中"协议类型"为自由文本 Input，而专用 new/edit 页为 AGREEMENT_TYPES 下拉，两处维护口径不一致（模态保存任意文本）。
- [P3][冗余] 第 228 行 `onToggleEnabled={async () => {}}` 空实现（表中无 Switch，属于占位死代码）。
- [P3][逻辑] 第 85-90 行 `expiring` IIFE：`new Date(item.endDate)` 若为非法日期字符串将得到 NaN → `days >= 0 && days <= 90` 为 false，显示正常（安全），无崩溃。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/culture/page.tsx
- [P3][重复代码] 与 talent/employer/job/major/teacher 五个页面几乎逐行相同（仅 brandType、label、关联字段、fetchUrl 不同），共 6×206 行重复；最佳实践：抽公共 `BrandCrudPage` 组件按品牌类型配置化渲染。
- [P3][契约] 第 180 行 `fetchUrl="/majors?limit=200"` 经 portalRequest 走 `/api/v1/majors` — 需确认后端存在该路由（其他页面同样使用，属全局模式，未逐一核实）。
- [P3][冗余] 第 203 行 `onToggleEnabled={async () => {}}` 空实现。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/employer/page.tsx
- [P3][重复代码] 同 culture 页（6 页重复模板）；第 180 行 `fetchUrl="/alliance/enterprises?limit=200"` 为管理端路由，契约正确。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/[id]/page.tsx
- [P3][逻辑] 第 38-45 行关联对象仅展示原始 ID（Badge 显示 uuid），无名称解析，可读性差。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/job/page.tsx
- [P3][重复代码] 同前；第 180 行 `fetchUrl="/job/positions?limit=200"` 契约正确。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/major/page.tsx
- [P3][重复代码] 同前。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/page.tsx
- [P3][契约] 第 66 行 `allianceBrandApi.list()` 未按品牌类型过滤，前端自行按 `brandType` 计数 — 契约正确但全量拉取（数据量大时可传 brandType 分组请求）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/talent/page.tsx
- [P3][重复代码] 同前；第 180 行 `fetchUrl="/users?role=student&limit=200"` — 依赖后端 users 列表支持 role 查询参数（usePortalUsers 走 portalUserManagementApi 同源，契约待确认）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/brands/teacher/page.tsx
- [P3][重复代码] 同前；第 180 行 `fetchUrl="/users?role=teacher&limit=200"`、第 189 行 `/alliance/experts?limit=200` 契约正确。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/dictionaries/page.tsx
- [P3][死代码] 第 33 行 `const [, setDeleting] = useState(false)` — deleting 状态从未被读取（删除按钮无 loading 态）。
- [P3][逻辑] 第 49-55 行：`if (authLoading || !tenantId) return` 后 loading 初始为 true，若 tenantId 一直为空则表格永久显示"加载中"（正常流程 tenantId 必有，边缘可容忍）。
- [P3][校验] 第 194 行编辑时 code 禁改但无唯一性提示（后端返回后 toast）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/enterprises/[id]/edit/page.tsx
- [P3][类型] 第 79 行 `value: any`；第 112 行 `(item as any)` 系列（unifiedSocialCreditCode/establishedYear/employeeCount 等字段 shared-types 缺失，运行时由后端返回，OK）。
- 无 P0/P1/P2（第 60 行 effect deps `[tenantId, id, toast, t]` — toast 为模块级函数引用、t 为 useCallback，均稳定，不会循环重载）。

## apps/edu/app/portal/apps/alliance/enterprises/[id]/page.tsx
- [P1][数据不一致] 第 135-148 行 `unlinkAgreement`：对"仅关联了本企业"的协议，`enterpriseIds` 过滤后为 `[]` 仍随完整对象 PUT — 协议更新**没有** ValidateUpdateExisting 兜底（alliance_crud_handler.go:415-448 无此钩子），store.UpdateAgreement 全列覆盖写 `[]`，unlink 可正常生效 — 但需注意与 project 的兜底语义不一致（见 projects/[id] 的 P1），两处同为"取消关联最后一个"却行为不同，属易错点。
- [P2][截断] 第 72-87 行 `allianceAgreementApi.list({limit:200})` 等 200 截断：超过 200 条协议/项目/成果时，已关联项在详情页"合作协议/合作项目/合作成果"Tab 中缺失（过滤基于截断列表）。
- [P3][类型] 第 188 行起大量 `(enterprise as any)`；第 237-292 行三次重复的 `img` 列表渲染（可抽公共组件）。
- 无 P0。

## apps/edu/app/portal/apps/alliance/enterprises/new/page.tsx
- [P3][校验] 第 106 行名称 required 有校验；无其他问题。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/enterprises/page.tsx
- [P3][类型] 第 59 行 `countBy` 泛型 any；第 174-197 行 createDefault 含冗余字段。
- 无 P0/P1/P2（第 330 行 onToggleEnabled 调 `togglePublic` 部分更新 — 后端 enterprise ValidateUpdateExisting 兜底其余字段，安全）。

## apps/edu/app/portal/apps/alliance/experts/[id]/edit/page.tsx
- [P3][功能缺口] 第 51-78 行 item 状态含 `photos/expertType/professionalFields/positionDirection/rating` 字段但表单无对应控件（仅加载保留旧值）；新建页（new/page.tsx）连这些字段都没有，编辑页与新建页字段集不一致。
- [P3][逻辑] 第 136-140 行：cooperation 来源未选企业时 `payload.organization = ''`，会清空原 organization 值。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/experts/[id]/page.tsx
- [P3][截断] 第 26 行 `allianceEnterpriseApi.list({ limit: 200 })` 后 `.find(x => x.id === e.enterpriseId)`：企业超 200 条时关联企业匹配失败，详情页"所属机构"回退显示 organization（若为空则 '-'）。
- [P3][冗余] 第 128-135 行 `img` 用 eslint-disable 而非 next/image（详情页展示，可接受）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/experts/new/page.tsx
- [P3][类型] 第 87 行 `value: any`；无其他问题。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/experts/page.tsx
- [P3][契约] 第 114-124 行 createDefault 缺少 `title/position/industry/city/rating/introduction` 等字段，但模态编辑以列表行完整对象为初值（portal-crud-page.tsx:201-205 openEditDialog(item)），创建时仅提交表单字段 — 创建出的专家缺 organization 等字段，需二次编辑，功能缺口。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/layout.tsx
- [P1][权限控制遗漏] 第 9-45 行：联盟管理布局**仅过滤侧边导航**（`hasMenuPermission` 传给 PlatformSideNav），**没有像 system/layout.tsx:169-175 那样对页面内容做 `permitted` 拦截** — 任何已登录的 portal 用户（学生/教师）直接输入 URL 即可渲染联盟管理页面；后端 `canManageAlliance` 会拒绝 API 调用（alliance_crud_handler.go:18），数据安全无虞，但前端守卫缺失、与 system 模块行为不一致，未授权角色会看到空白/报错页面而非统一"暂无权限"提示。最佳实践：与 system/layout.tsx 对齐，增加 `permitted` 内容守卫。
- [P3][性能] 第 14-36 行 useMemo 依赖仅 `[t]`，t 变化时全量重建导航配置（正常）。

## apps/edu/app/portal/apps/alliance/permissions/page.tsx
- [P2][逻辑] 第 53-56 行 `p.accountName.toLowerCase()` — 若后端返回 accountName 为 null（空账号名）会抛 TypeError 导致整行渲染崩溃；后端 create 校验 accountName 非空（alliance_handler.go:460），风险低，但建议 `(p.accountName || '')` 防御。
- [P3][冗余] 第 98-108 行 createDefault 含 enabled 冗余字段；第 131-145 行 BrandRelationSelect 两分支重复。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/projects/[id]/edit/page.tsx
- [P3][逻辑] 第 262 行：已发布项目隐藏"发布项目"按钮但"保存草稿"仍可用且不会改变发布状态（publishStatus 保留）— 语义正确。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/projects/[id]/page.tsx
- [P1][静默失败] 第 120-132 行 `unlinkAgr`：取消关联**最后一个**协议时发送 `agreementIds: []`，后端 project `ValidateUpdateExisting`（alliance_crud_handler.go:318-320 `len(t.AgreementIDs) == 0 → 回退 existing`）将空数组回退为原值 → 关联并未解除，但前端 toast"已取消关联"并 reload，用户看到关联仍存在，静默失效。最佳实践：后端对"显式清空"提供可区分语义（如字段指针/布尔标志），或前端在空数组场景走专门接口。
- [P2][契约] 第 107、121、142 行 `(project as any).agreementIds` — shared-types `AllianceProject`（alliance.ts:67-85）**未声明 agreementIds 字段**，全靠 `as any`；后端实际返回/写入 agreement_ids（alliance_project_store.go:103），运行时 OK，但类型契约缺失。
- [P3][截断] 第 87 行 `allianceAgreementApi.list({limit:200})` 截断导致协议 Tab 中已关联协议显示不全。
- 无 P0。

## apps/edu/app/portal/apps/alliance/projects/new/page.tsx
- [P3][校验] 第 120 行"项目名称"required 无前端校验，后端 ValidateCreate（alliance_crud_handler.go:270）兜底。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/alliance/projects/page.tsx
- [P2][性能] 第 40-48 行：对每个项目**串行** `await allianceProjectApi.listMilestones(p.id)`（N+1 请求链），项目数多时列表加载极慢；最佳实践：改为 `Promise.all` 并发，或后端一次性返回里程碑统计。
- [P2][i18n] 第 171-177 行阶段下拉直接渲染原始枚举值 `{v}`（archived/terminated 等显示英文），未走 `t()` 翻译，与第 163-167 行 `allianceLabel` 显示不一致。
- [P3][脆弱依赖] 第 220-224 行 `onToggleEnabled` 部分更新 `{ isPublic }` 依赖后端 ValidateUpdateExisting 兜底（当前安全），但注意同机制导致"无法清空 enterpriseIds/agreementIds"（见 projects/[id] P1），约定脆弱。
- 无 P0/P1。

## apps/edu/app/portal/apps/alliance/school/page.tsx
- [P2][数据覆盖] 第 155-156 行：租户原省份/城市为空时，编辑表单默认填入 `北京 / 东城区`，用户不修改直接保存会把原本无地区的数据覆盖为"北京/东城区"（数据污染边缘）；最佳实践：默认留空，未选择不提交。
- [P3][冗余] 第 452-456 行电话输入同时写入 `phone` 与 `contactPhone` 两个字段（后端均接收，恒相等）；第 293 行 `${tenant.contact} / ...` 当 contact 为 '-' 时显示 "- / xxx"；第 564 行 `v === '- -'` 特殊判断脆弱。
- [P3][类型] 第 127 行 `icon: any`、第 167 行 `(formData as any).secondaryColleges`、第 491 行 `setF('secondaryColleges' as any, v as any)` 类型绕过。
- 无 P0/P1。

## apps/edu/app/portal/apps/page.tsx
- [P3][性能] 第 190 行 `useMemo(() => getServiceClickCounts(), [])` 依赖模块级 localStorage 读取（try/catch 保护，SSR 安全）；第 250-262 行"常用服务"每次 render 重算排序（数据量小）。
- [P3][逻辑] 第 196 行：无点击记录时仅显示 quickAccess 前 6 条；第 203-228 行 scroll 监听依赖 `allModules` 重建（正常）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/layout.tsx
- [P3][风格] 第 26-30 行 render 期 setState 守卫模式（`if (pathname !== prevPath) { setPrevPath(...); setMobileOpen(false) }`）— React 官方认可的"调整 state 以响应 prop 变化"模式，可行但易被误读；对比其它页面用 useEffect 更常规。
- [P3][边界] 第 169 行 `loading ? null : permitted ? children : ...` — 认证加载期间渲染空白（无骨架屏）。
- 无 P0/P1/P2（第 32 行 `permitted` 内容守卫是正确的权限拦截范例）。

## apps/edu/app/portal/apps/system/logs/login/page.tsx
- [P2][性能] 第 34-39 行：搜索时 `limit: 10000` 全量拉取，且 `loadLogs` 随 `searchTerm` 每次击键变化 → useEffect 重新执行，**无防抖**，快速输入触发多次万级记录请求；最佳实践：输入防抖（300ms）。
- [P3][冗余] 第 76-79 行：搜索态 `displayLogs` 再做一次 slice 分页（数据已全量在前端，逻辑正确）；第 131 行"批量导出"disabled 占位。
- 无 P0/P1。

## apps/edu/app/portal/apps/system/logs/operation/page.tsx
- [P2][性能] 同 login 页第 34-39 行：搜索无防抖 + limit 10000 全量拉取。
- [P3][逻辑] 第 73 行 `log.action.includes(keyword)` — `action` 在 shared-types backend.ts:123 为必填字段，契约安全；若后端异常返回缺字段会抛错（低风险）。
- 无 P0/P1。

## apps/edu/app/portal/apps/system/org-user/accounts/page.tsx
- [P3][性能] 第 36-39 行 usePortalUsers 的 search 直接进依赖，无防抖。
- [P3][逻辑] 第 87-100 行 toggleStatus 与删除按钮均无 loading/禁用互斥，连点可重复请求（幂等，可容忍）。
- [P3][细节] 第 188 行 JSX 缩进错乱（视觉）。
- 无 P0/P1/P2（第 41 行 useOrgTree 契约：orgMap/orgTypeMap 已在 hooks/use-org-tree 验证存在）。

## apps/edu/app/portal/apps/system/org-user/fields/page.tsx
- [P3][类型] 第 127-133 行 createDefault 返回全字段对象但 renderForm 只编辑 name/roleCodes（未显示字段保留原值 — 因编辑初值为列表行完整对象，安全）。
- [P3][契约] 第 79 行 update 仅提交 `{isEnabled}` 部分字段 — 后端 update 需确认部分更新语义（全局模式，未在本批次核实后端实现）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/graduates/page.tsx
- [P2][分页缺失] 第 61-65 行：`usePortalUsers` 仅解构 `users/loading/error/refetch`，未取 `total/page/pageSize/setPage`，且 PortalCrudPage 未传 `pagination` → 毕业学生超过默认 20 条时**只能看到第一页、无法翻页**（对比 accounts 页第 168 行正确传了 pagination，属功能缺口）。
- [P3][逻辑] 第 165-177 行 `handleReEnroll` 仅 `updateStatus(id, 'active')`，不清理毕业年份等学籍字段，恢复入学后"毕业年份"残留（后端语义待确认）。
- 无 P0/P1/P2（第 134-149 行 update 全字段回传契约完整）。

## apps/edu/app/portal/apps/system/org-user/org-structure/page.tsx
- [P3][截断] 第 480-491 行 `confirmGraduate` 拉取 `limit: 1000`，超 1000 人的班级批量毕业会漏人。
- [P3][逻辑] 第 522-529 行 `mounted` 守卫为多余防闪烁（首次渲染直接返回 Spinner，可去掉）；第 62-69 行 `countByType` 递归统计与 `totalMembers`（第 93-95 行仅统计顶层 memberCount，不累加子树）语义不一致 — 若后端 memberCount 为节点直属人数，总人数统计偏低。
- [P3][状态] 第 234 行 `nodeRefs` 中已删除节点引用不清理（内存极小，可容忍）；第 316-324 行 highlight 定时器正常清理。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/org-types/page.tsx
- [P3][契约] 第 162 行 `categoryColors[type.category]` — 若后端 category 返回未知值（undefined）→ `categoryColors[undefined]` 为 undefined className（不崩，仅样式丢失）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/positions/page.tsx
- [P3][逻辑] 第 193 行 `new Date(position.createdAt).toLocaleString('zh-CN')` — 若 createdAt 为空/非法，显示 "Invalid Date"（不崩）。
- [P3][契约] 第 89 行 `portalUserManagementApi.list({ titleId: position.id, ... })` 依赖后端按 title_ids 过滤（注释已说明），契约合理。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/relations/page.tsx
- [P2][状态不同步] 第 66-82 行 `handleCreate` 成功后仅 `setSearchText('')`：若搜索框本就为空，`setSearchText('')` 状态不变 → `useAsync` deps（第 63 行 `[searchText]`）不触发 → **新建的关系不会出现在列表中**，需手动刷新；最佳实践：创建成功后显式 `refresh()`。
- [P3][契约] 第 60 行 `portalUserRelationApi.list({ search })` 每次击键触发后端全量搜索（无防抖）。
- 无 P0/P1。

## apps/edu/app/portal/apps/system/org-user/roles/page.tsx
- [P2][权限语义] 第 307-310 行：`perms.menus` 缺失（学校管理员/平台管理员等"不限菜单"角色）时回显为全选；一旦在权限弹窗点保存，`savePermissions`（第 346-355 行）会把全量 `menus` 写入，将"不限制"变成显式白名单 — 后续新增页面/菜单不会自动可见，权限语义发生不可逆变化。最佳实践：menus 缺失时提示"当前角色不限制菜单"并禁止一键保存，或保存时剔除全选集合。
- [P3][冗余] 第 463-470 行 批量导出/导入 disabled 占位；第 397-420 行 `saveRole` 编辑时全量回传 `item as unknown as Role`（含 userCount 等多余字段）。
- [P3][性能] 第 210-213 行 menuTree 全量构建 + 每次渲染 SystemCard 内 collectPages 递归（第 88-98 行 useMemo 依赖 `[node]`，正常）。
- 无 P0/P1。

## apps/edu/app/portal/apps/system/org-user/students/page.tsx
- [P3][逻辑] 第 249-275 行 三个状态按钮始终可点（已是目标状态时点击幂等空转）；第 455-463 行创建时 `role: 'school'` 与 roleCode 分离的契约（依赖后端实现，注释无）。
- [P3][截断] 第 61-65 行 usePortalUsers 分页正常传递（本页正确）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/org-user/teachers/page.tsx
- [P3][契约] 第 100 行 `positions: u.titleIds ?? []` — 教师列表渲染依赖后端返回 title_ids（已在 positions 页契约确认）。
- [P3][逻辑] 第 88-106 行 useEffect deps `[users, institution, orgMap]` 缺 orgTypeMap（本页未使用，安全）。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/page.tsx
- 无问题（redirect 到 /portal/apps/system/tenant，该目录存在）。

## apps/edu/app/portal/apps/system/resource/codes/page.tsx
- [P3][契约] 第 33 行 `code.name.includes(searchTerm)` — name 为必填字段，安全；无其他问题。
- 无 P0/P1/P2。

## apps/edu/app/portal/apps/system/resource/industries/page.tsx
- [P3][逻辑] 第 219-228 行 `onToggleEnabled` 全量回传依赖 PortalCrudPage 的 onRetry 刷新（portal-crud-page.tsx:225-237 已处理）— 安全；但候选父级行业（第 165 行）未排除自身子孙，可把子行业设为父级的父级形成环（前端未校验，后端若也不校验会成环）。
- 无 P0/P1/P2。

---

## 汇总

- **审查文件数**：56
- **问题总数**：约 62 条（P1×3、P2×15、P3×44）
- **P0**：0

### P1 摘要
1. `apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx:49` — `/career/positions` 后端无此路由（应为 `/job/positions`），404 被 catch 吞掉，"关联职业岗位"功能永久不可用且无提示。
2. `apps/edu/app/portal/apps/alliance/projects/[id]/page.tsx:120-132` — 取消关联最后一个协议时 `agreementIds: []` 被后端 ValidateUpdateExisting 回退为原值，静默失败（提示成功但关联未解除）。
3. `apps/edu/app/portal/apps/alliance/layout.tsx:9-45` — 联盟管理布局缺前端内容守卫（对照 system/layout.tsx 的 permitted 拦截），未授权角色可直达管理页面，权限控制遗漏。

### P2 摘要（主要）
- `agreements/[id]/edit/page.tsx:55-79` — 加载失败渲染空表单，保存会全列覆盖原协议（数据丢失风险）。
- `projects/page.tsx:40-48` — 里程碑 N+1 串行请求，列表性能差。
- `login/page.tsx:34-39` / `operation/page.tsx:34-39` — 搜索无防抖 + 每次击键全量拉取 10000 条。
- `relations/page.tsx:66-82` — 新建关系后列表不刷新。
- `graduates/page.tsx` — 未传分页组件，毕业学生超 20 人无法翻页。
- `landing/page.tsx:464` — `暂无{t}` 模板拼接 i18n 残留。
- `alliance/page.tsx:40`、`landing/page.tsx:259` — isFeatured/sort 查询参数被后端忽略（契约不一致）。
- `school/page.tsx:155-156` — 无地区数据时默认北京/东城区，保存造成数据覆盖。
- `roles/page.tsx:307-310` — menus 缺失角色回显全选，保存后"不限菜单"转为显式白名单。
- `projects/page.tsx:171-177` — 阶段下拉枚举值未翻译。
- `enterprises/[id]/page.tsx:72-87` — limit 200 截断导致关联 Tab 数据缺失。
- `achievements/[id]/page.tsx:116-118` — relatedPositions 运行时为对象数组但 shared-types 声明 string[]。
- `permissions/page.tsx:53-56` — accountName 可能为 null 时 filter 崩溃（低概率）。
