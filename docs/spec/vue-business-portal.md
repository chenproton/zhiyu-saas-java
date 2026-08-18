# Vue 业务门户（Java 配套）规格文档 — 知与 SaaS

> 状态：实施完成（2026-08-18）：Phase 0 基建 + 部署接线完成，Vue 门户上线于 java-nginx `http://<host>:8083/java/portal/`，`/java/portal` 301 收敛到 Vue。**业务门户全量迁移完成**：系统管理（组织/角色/专业/行业/用户）+ 岗位/场景/课程/联盟/评价/教务/伙伴/AI/门户 各域列表/详情编辑/批次/归档/审批 + 岗位学习路径与推荐 + 评价（岗位能力认定/考试使用/成绩结果/课程与场景任务评分）+ 教务（教学计划/学生/教师/排课/场地节次/Excel 导入导出）+ 伙伴企业端（共建/就业/合作/学校/任务/账号）+ AI（广场/智能体/知识库/对话/内容管理/审核/外部服务）+ 门户（学习社区/我的收藏）+ 登录/会话（含多租户选择）+ 工作流/导入导出。**Java 部署 100% Vue**（deploy-java.sh 不再构建 Next.js，java-edu 容器与 Dockerfile 已移除）。superadmin 为独立 SaaS 运营平台单列（不在 portal api-client 范围内）。
> 状态（2026-08-19）：**启动「Vue 门户与 React 基线功能对齐」**。`frontend/edu` 已由 Next.js 迁移为 React SPA（见 `docs/decisions/0009`）并持续演进，Vue 门户停留在迁移时快照，两侧差距随时间扩大。经逐路由对比（`docs/前端对齐差异表.md`）：React ~139 页面路由 vs Vue 89 条，**React 有而 Vue 缺失 ~128 页**（portal 域 76 页为主：alliance 43 + apps/ai 15 + apps/system 17 + login 1），另有 46 条 Vue 特有路由待分类。用户决策：仅对齐 portal-vue 业务门户（不含 superadmin/changelog/plus-ui）、视觉沿用 Element Plus（功能与交互以 React 为唯一基准）、按 React 路由顺序推进。详见 §11。
> 状态（2026-08-19 完成）：**对齐实施完成**。M1-M8 全部模块翻译/核对完成，M9 特有页分类落地，M10 验收通过：路由差距清零（React 174 vs Vue 226，缺失仅 changelog 已按决策排除）、`pnpm typecheck` + `vite build` 通过、`spec-check.sh` 12 项硬约束全部通过。共 16 个 commit、~93,000 行新增（分支 feat/portal-vue-react-alignment）。详见 §11 与 `docs/前端对齐差异表.md`。
> 范围：仅把 **Java 后端配套的业务门户前端**从 Next.js 迁移到 Vue 3.5 / TypeScript / Vite；**Go 后端 + Next.js 前端（`backend/go`、`frontend/edu`、`frontend/packages`、Go 部署路径）一律不改**，作为生产基线持续运行。

## 1. 背景与目标

### 1.1 背景
- 本仓库为 Go + Java 双后端并存。Java 后端（`backend/java/ruoyi-*`，`org.dromara`）已按 `docs/backend-go-to-java-migration.md` 等价迁移 13 个业务域，共 635+ 端点，API 契约与 Go 版对齐（`/api/v1/**`、裸 JSON、`{items,total}`、`limit/offset`）。
- 当前 Java 后端**复用** Next.js 业务门户（`frontend/edu`，通过 `NEXT_PUBLIC_BASE_PATH=/java` 在 `/java/portal` 服务），与 Go 共用同一套 React 代码。
- 现有 Vue 工程 `frontend/plus-ui`（RuoYi-Vue-Plus 管理端，Vue 3.5.40 / Vite 8.1.5 / TS 6.0.3 / Element Plus 2.14.3）已随框架合仓进入仓库，但**仅覆盖后台管理控制台**（系统管理/工作流/代码生成/监控），且当前未接线 Java。

### 1.2 目标
把 Java 配套的**业务门户**（岗位/场景/课程/联盟/评价/教务/图书馆/AI 中心等前台页面）从 Next.js 迁移到 Vue 3.5 / TypeScript / Vite，使 Java 具备独立的 Vue 前端体系：

1. 新建独立 Vue 业务门户应用（暂定 `frontend/portal-vue`），与 plus-ui 管理端并存，均对接 Java 后端。
2. **复用**：Java 后端（零改动）、plus-ui 工程骨架（构建/依赖/权限/请求封装）、`frontend/packages/shared-types`（TS 类型直接移植）。
3. **增量迁移**：按业务域逐域翻译，双栈并行、按域渐进切换，任何时刻 Go + Next.js 生产不受影响。
4. 明确边界：**不触碰** Go 后端与 Next.js 前端任何文件。

### 1.3 成功指标
- 每个已迁移域：核心页面（列表/详情/增删改/审批/导入导出）在 Vue 端可用，接口返回与 Go/Java 契约一致，权限/租户隔离行为等价。
- 迁移全程 `frontend/edu`（Next.js）与 `backend/go` 无任何 diff；生产（Go + Next.js）健康检查持续通过。
- 最终：Java 具备「Vue 业务门户 + Vue 管理端」双前端，不再依赖 Next.js 构建产物。

## 2. 平台级架构决策

### 2.1 技术选型（复用 plus-ui 既有依赖版本，不引入新栈）
| 维度 | 选型 | 理由（回链需求） |
|---|---|---|
| 框架 | Vue 3.5.40 | 与 plus-ui 一致，满足「Vue 3.5」要求 |
| 构建 | Vite 8.1.5 | 与 plus-ui 一致，满足「Vite」要求 |
| 语言 | TypeScript 6.0.3 | 与 plus-ui 一致，且 shared-types 为 TS，可直接移植 |
| UI | Element Plus 2.14.3 | 与 plus-ui 一致；表格/表单/弹窗覆盖业务门户需求 |
| 状态 | Pinia 4.0.2 | 与 plus-ui 一致 |
| 路由 | Vue Router 5.2.0 | 与 plus-ui 一致 |
| HTTP | 原生 `fetch`（移植 `api-client` 的 `request<T>`） | 与业务门户现有请求层逐字等价，避免 axios 重写错误分支（R2 漂移） |

> 决策：**不**另起炉灶用 Vite 6.x 或其它版本，统一沿用 plus-ui 的锁定版本，避免双 Vue 工程依赖漂移。

### 2.2 独立应用 vs 塞进 plus-ui
- **决策：新建独立应用 `frontend/portal-vue`**，不复用 plus-ui 的「后台管理」布局/路由/菜单体系。
- 理由：业务门户是前台 landing + 卡片导航 + 多角色工作台风格（见 `05-prototype-interaction.md`），与 plus-ui 的后台侧栏布局形态不同；硬塞会导致布局层大改 plus-ui，破坏管理端。
- 但**复用** plus-ui 的：`vite.config.ts`/`tsconfig.json`/`uno.config.ts` 工程配置、`utils/request.ts`（axios 封装）、`utils/auth.ts`（token 存取）、权限 store/指令、Element Plus 通用组件（Pagination/DictTag 等）。

### 2.3 数据边界
- **无数据模型变更**：Java 后端已共享 PostgreSQL（同一库 `zhiyu_saas`），Vue 门户纯前端，不新增表/迁移/字段。
- 无新 API：全部复用 Java 后端现有 `/api/v1/**`（契约见 `02-api-contract.md` 与 `docs/backend-go-to-java-migration.md` §7 适配记录）。

### 2.4 与其他模块的关系
| 模块 | 关系 | 约束 |
|---|---|---|
| Java 后端 | 唯一数据源 | 零改动；Vue 请求层对齐其裸 JSON 契约 |
| plus-ui | 并存（管理端） | 不动其现有页面，仅复用工程配置/组件 |
| Go 后端 + Next.js | **隔离，不改** | 生产基线；Vue 门户全程只新增文件 |
| shared-types / api-client | 移植来源 | 从 `frontend/packages/*` **拷贝**类型/请求逻辑到 Vue 工程，不修改原文件 |

## 3. 核心流程与「React→Vue 翻译模板」

### 3.1 登录与会话
- 复用 Java 后端 Sa-Token Bearer 登录 + `/api/v1/.../me`（或等价 me 端点，见 `02-api-contract.md`），返回用户/角色/权限/菜单。
- token 存取对齐 `frontend/packages/api-client/src/api-helpers.ts` 的 Go/Java 隔离逻辑：业务门户统一走 Java 路径（`/java/` 前缀），token key 用 `-java` 后缀；401 跳 `/java/portal/login`。
- 鉴权：前端按 `me.roles.permissions` / 菜单控制导航与按钮（等价 Next.js 的 `lib/menu-permissions.ts`），后端逐请求校验（Java 已有，无需改）。

### 3.2 翻译模板（React → Vue，逐页套用）
每个 Next.js 页面按下列 5 个映射点翻译，保证行为等价：

| # | Next.js（现状） | Vue（目标） | 备注 |
|---|---|---|---|
| 1 | 数据获取：`api-client` 的 `getXxx/list` + React `useEffect`/`useSWR` | pinia store 或页面内 `onMounted` + `fetch`（移植 `api-client` 的 `request<T>`/`createCrudApi`，封装成 `@/api/*`） | 接口路径/参数/返回结构**照抄**，不重写 |
| 2 | 列表：自定义 Table 组件 | `el-table` + plus-ui `Pagination` | 分页参数 `limit/offset`、返回 `{items,total}` |
| 3 | 表单：自定义 Form/Dialog | `el-form` + `el-dialog` | 字段/校验规则照抄 shared-types |
| 4 | 权限：`RequireMenu`/按钮级显隐 | Vue 权限指令 `v-hasPermi`（plus-ui 已有） | 权限点字符串照抄 |
| 5 | 路由：Next.js 文件路由 | Vue Router 静态路由（按域分模块） | 路径保持与 Next.js 一致（去掉 `/java` 由 base 处理） |

#### 3.2.1 对齐实践要点（2026-08-19 M1 沉淀，React SPA 为基准）

| # | 场景 | 做法 |
|---|---|---|
| a | Vue `@/api/*` 缺 React api-client 的方法 | 按 React 端点路径补（如 `PUT /affairs/teaching-plans/entries/{id}` → `teachingPlanApi.updateEntry`）；类型同步补进 `@/types/*`。Java 端点已全覆盖，补方法即可 |
| b | 分组表格（如教学计划按 startWeek 分组） | 数据拍平（分组行 + 条目行）+ `el-table :span-method` 跨列 |
| c | 行内批量编辑保存 | `Promise.allSettled` 并行提交（React 同款），失败条目保留编辑态供重试并提示失败项 |
| d | 状态操作（提交审批/撤回/发布） | 复用 `createContentApi` 的 `submit/withdraw/publish` + `approvalApi.create({targetType,targetId,workflowId})`（从批次取 workflowId） |
| e | 别名转发页（React `export {default} from ...` 复用他域页面） | Vue 用**同一组件注册多条路由**（如 `/affairs/majors` 与 `/system/majors` 共用 `system/majors.vue`） |
| f | 聚合页 vs 分域页（approvals/workflows/import-export） | Vue 聚合页保留，M9 统一核对补名称映射/详情跳转；导入导出实体选项按 React 使用面补齐（如 `affairs-config`） |

### 3.3 域清单（迁移顺序）
`library → job → scene → lesson → alliance → evaluation → affairs → partner → superadmin → portal/ai`（试点 library 后按此批推进；依赖关系见 §9）。

## 4. 数据模型
**N/A** —— 本迁移纯前端，无表/字段/迁移变更。数据模型继续以 `04-database-schema.md` 为单一事实源，不新增。

## 5. API 契约
**复用现有契约，不新增/变更端点。** Vue 请求层对齐以下约定（来源 `docs/backend-go-to-java-migration.md` §7 与 `02-api-contract.md`）：

- 基础路径：`/api/v1/**`，Java 后端 8080。
- 响应：裸 JSON（非 `R<T>`）；错误 `{code, error, message?}`。
- 分页：`{items, total}` + `limit/offset`（maxPageSize 200）。
- 鉴权：`Authorization: Bearer <token>`；401 文本对齐 Go 中间件。
- 关键写操作走 Java 现有租户/权限校验，Vue 端不越权。

> 若翻译中发现某页面调用了 Java 尚未实现的端点，**停下来记录缺口**，不擅自改 Java 也不擅自改契约（见 §9 风险 R3）。

## 6. 后端开发计划（WBS）
**N/A** —— 后端零改动。若后续翻译暴露 Java 端点缺口，另立任务补 Java，不在本规格范围。

## 7. 前端开发计划（WBS）

> 全程只新增 `frontend/portal-vue/**` 与部署脚本/nginx 增量配置；不修改 `frontend/edu`、`frontend/packages`、`backend/go`。

### Phase 0 — 工程基建（一次，依赖：无）
- [ ] `frontend/portal-vue` 应用壳：Vite/TS/Element Plus/pinia/vue-router/axios 配置（复用 plus-ui 版本锁定）。
- [ ] 登录页 + 布局（前台 landing/卡片导航风格）+ 路由守卫 + 权限 store + `v-hasPermi` 指令。
- [ ] 移植 `shared-types`（26 个 .ts）为 `frontend/portal-vue/src/types/*`。
- [ ] Vue 请求层 `src/api/*`：axios 实例 + `/api/v1` + 401 处理 + token 存取（对齐 `-java` 隔离）。
- [ ] nginx：`/java/portal/**` → portal-vue 静态资源；`/java/` 其余路径策略（见 §8）。
- [ ] 冒烟：登录 → me → 空工作台可渲染。

### Phase 1 — 试点域 library（依赖 Phase 0）
- [x] 列表页（资源库列表：搜索 + 类型筛选 + 分页 + 增删改，复用 `el-table`/`el-form`/`el-dialog`）——MVP 完成，`src/views/library/resources.vue` 构建通过。
- [ ] 详情页、标签查询/绑定、批量导入、预览、零引用统计（增量补齐，见 §10 扩展性预留）。
- [ ] 沉淀翻译模板到本 spec §3.2，回填最佳实践（已按模板落地，待正式回填）。
- [ ] 验收：library 核心链路与 Java 契约一致，权限/租户行为等价（待 nginx 接线后部署冒烟）。

### Phase 2 — 批量翻译（依赖 Phase 1，可并行 [P]）
按域分批（每域一个 commit）：`job` [P]、`scene` [P]、`lesson` [P]、`alliance` [P]、`evaluation`、`affairs`、`partner`、`superadmin`、`portal/ai`。
- 每域：列表/详情/写操作 + 权限点 + 关键导入导出（复用 Java 现有 import-export 端点）。

### Phase 3 — 渐进切换与收敛（依赖 Phase 2）
- [ ] 按域切换 nginx 路由到 Vue；未迁移域仍回 Next.js（过渡期）。
- [ ] 全量迁移后评估 Go 是否切 Vue（**本期明确不做**，见 §10）。
- [ ] 清理/归档：Java 不再构建 Next.js（`deploy-java.sh` 去掉 `frontend/edu` 构建分支）。

## 8. 部署与验证

### 8.1 部署（已确认的 URL 布局）
- Java 部署**直连 java-nginx 8083**（非边缘网关 `/java/` 剥离路径；实测 `/java/portal`→200、`/api/v1/auth/me`→401）。
- 前端：Vue 门户 base=`/java/portal/`，java-nginx `location /java/portal/` → 静态 `dist/`（挂载 `/usr/share/nginx/html/java/portal`）+ `try_files … /java/portal/index.html` SPA fallback。
- API：`VITE_API_BASE=/api/v1`（绝对路径），java-nginx `location /api/` → `java-backend:8080`。
- 管理端：`/java/` 其余路径暂回落到旧 Next.js `java-edu`（`location /`），plus-ui 管理端后续接入。
- `deploy-java.sh`：新增 `frontend/portal-vue` 的 `pnpm install + pnpm build` 步骤；`docker-compose-java.yml` java-nginx 挂载 `../../frontend/portal-vue/dist`。
- 渐进切换期：`/java/portal`（无斜杠）仍走 Next.js，`/java/portal/`（有斜杠）走 Vue；Phase 3 全量完成后统一重定向并移除 Next.js。

### 8.2 质量门禁（每 Phase 提交前）
- `pnpm --filter portal-vue build`（vite build）通过；`vue-tsc` 类型检查通过。
- `./scripts/spec-check.sh` 通过（本迁移不引入迁移/后端改动，应无新增阻断项）。
- 本规格 §7 任务与实现同步（spec-first）。

### 8.3 验收标准（DoD 对齐 `spec-standards.md` §四）
1. 每域核心链路（列表/详情/写操作 + 权限 + 租户隔离）在 Vue 端可用，行为与 Java 契约一致。
2. `frontend/edu`、`backend/go`、`frontend/packages` 全程零 diff（`git diff` 无改动）。
3. Go + Next.js 生产健康检查持续通过（`docker compose ps` 全 healthy、`/health` ok）。
4. 本 spec §3.2 模板在试点域后回填为可复用标准。
5. 涉及跨角色/跨页面端到端链路的域，在 `06-acceptance-flows.md` 补对应 flow（复用 Java 侧链路）。

## 9. 实施顺序与风险

### 9.1 实施顺序
Phase 0（基建）→ Phase 1（library 试点，验证模板）→ Phase 2（12 域批量，按 §3.3 顺序，独立域可并行）→ Phase 3（渐进切换 + 收敛）。

### 9.2 风险
| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | Vue 与 React 行为漂移（分页/权限/错误分支） | 功能回归 | §3.2 模板逐点对照；每域验收对齐 Java 契约；复用 plus-ui 已验证封装 |
| R2 | 破坏 Go+Next.js | 生产事故 | 铁律：不碰 `frontend/edu`/`backend/go`/`frontend/packages`；只新增文件；每 Phase `git diff --stat` 校验 |
| R3 | 某域发现 Java 端点缺口 | 卡域 | 记录缺口，另立后端任务，不擅自改契约 |
| R4 | portal-vue 与 plus-ui 依赖漂移 | 维护成本 | §2.1 统一沿用 plus-ui 锁定版本 |
| R5 | 前台 landing/卡片导航 UI 风格复杂，逐页翻译费时 | 进度 | 优先复用 plus-ui 通用组件 + AI 辅助翻译；按域分批不追求一次性全量 |

## 10. 扩展性预留（明确「暂不做」）

- **不重写、不切换 Go + Next.js**：Go 生产基线保持不动；Java 的 Vue 门户与其并行共存。
- **不把业务门户塞进 plus-ui 后台布局**：portal-vue 独立成前台风格应用。
- **不新增/变更后端接口**：迁移只消费现有 Java 端点；发现缺口另立任务。
- **不做统一登录/SSO 改造**：沿用现有 token 隔离（`-java` 后缀）与 Sa-Token 会话。
- **不做 Go 切 Vue**：本期只做 Java 配套门户；Go 是否切 Vue 留待后续独立决策。
- **不引入新 UI 库**（如 Ant Design Vue）：统一 Element Plus。

## 11. 与 React 基线（frontend/edu）功能对齐计划

> 背景：`frontend/edu` 已从 Next.js 迁移为 React SPA（`docs/decisions/0009`，行为不变重构），并新增/演进页面；Vue 门户（§1-§10 迁移成果）以旧 Next.js 快照为基准，与 React 现况存在差距。本计划以 **React 为唯一功能/交互基准**，逐页对齐 Vue 门户。

### 11.1 决策（用户 2026-08-19 拍板）

| 决策点 | 结论 |
|---|---|
| 对齐范围 | **仅 portal-vue 业务门户**；superadmin / changelog / plus-ui 不纳入 |
| 视觉一致性 | **功能 + 交互逻辑与 React 一致，视觉沿用 Element Plus 原生风格**（不逐像素对齐） |
| 推进顺序 | **按 React 路由顺序**：affairs → evaluation → job → lesson → library → partner → portal → scene |
| 后端 | Java 端点已对齐（729 vs Go 666，无缺失），纯前端工作量；偶发缺口按 R3 记录 |

### 11.2 差距基线

- 机器化路由对比明细见 `docs/前端对齐差异表.md`（含缺失 128 条清单、Vue 特有 46 条分类、每页六项核对标准）。
- 缺口集中：portal 域 76 条（alliance 前台 15 + apps/ai 15 + apps/alliance 28 + apps/system 17 + login 1）；affairs 9 / evaluation 10 / lesson 12 / partner 11 / job 4 / scene 5 / library 1。

### 11.3 批次计划（每模块一个 commit，可并行 [P]）

| 批次 | 模块 | 内容 | 依赖 |
|---|---|---|---|
| M1 | affairs | 9 页重写 + 已有 6 页核对 | 无 |
| M2 | evaluation | 10 页重写 + 已有页核对 | 无 [P] |
| M3 | job | 4 页重写 + 已有页核对 | 无 [P] |
| M4 | lesson | 12 页重写 + 已有页核对 | 无 [P] |
| M5 | library | 1 页核对（resources/:type） | 无 [P] |
| M6 | partner | 11 页重写 + 已有页核对 | 无 [P] |
| M7 | portal | 76 页重写（4 子批：alliance 前台 / apps-ai / apps-alliance / apps-system） | 无 |
| M8 | scene | 5 页重写 + 已有页核对 | 无 [P] |
| M9 | 特有页处理 | 46 条分类落地（路径归一化/等价核对/删除决策） | M1-M8 |
| M10 | 验收收敛 | 路由 diff 清零 + vue-tsc/lint/build + spec_check + spec_analyze + 更新差异表/本 spec | M9 |

### 11.4 每页对齐核对标准（六项）

1. **路由**：路径与 React 一致（含动态段），嵌套 layout 等价；
2. **字段**：表单字段、列表列、筛选条件与 React 完全一致（字段名/标签/顺序）；
3. **校验**：必填、格式、长度、唯一性校验规则一致；
4. **分页**：`limit/offset` 参数、`{items,total}` 返回、空态/加载态一致；
5. **错误分支**：失败提示、401 跳转、403 权限提示与 React 一致；
6. **权限点**：按钮级显隐权限字符串与 React（`RequireMenu`/菜单权限）一致。

### 11.5 验收标准（DoD）

1. `docs/前端对齐差异表.md` 缺失清单清零（changelog/superadmin 除外），Vue 特有 46 条全部分类落地；
2. 每模块：`pnpm --filter portal-vue build` + `vue-tsc` 类型检查通过；`./scripts/spec-check.sh` 通过；
3. 抽样页人工核对六项标准（字段/校验/分页/错误分支/权限点）；
4. 全程不修改 `frontend/edu`、`frontend/packages`、`backend/go`（git diff 校验）；
5. 每模块 commit 同步本 spec §11 进度与差异表状态。

### 11.6 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| A1 | React 页面复杂（studio/品牌多 Tab 编辑等）翻译量大 | 进度 | 按页拆分 commit；子代理并行；复用 §3.2 模板 |
| A2 | Vue 特有页（community/favorites/ai-chat）React 无对应 | 范围争议 | §3.3 逐条与用户确认：删除或保留 |
| A3 | 路径归一化误删 Vue 有用入口 | 功能丢失 | 归一化前核对 React 等价入口，记录迁移映射 |
| A4 | Java 端点缺口（React 新页调用新端点） | 卡页 | 按 R3 记录缺口另立 Java 任务，不擅自改契约 |
