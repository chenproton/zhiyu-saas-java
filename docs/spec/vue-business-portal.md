# Vue 业务门户（Java 配套）规格文档 — 知与 SaaS

> 状态（2026-08-21 工程合并）：**portal 业务门户已并入 `plus-ui` 单工程双构建**——门户源码位于 `plus-ui/src-portal`（入口 `plus-ui/portal.html`，构建产物 `plus-ui/dist-portal`），与管理端（`plus-ui/src` → `plus-ui/dist`）共用一份 package.json / lockfile / node_modules，运行时仍是两个独立 SPA；原 `frontend/portal-vue` 目录已删除。下文提到的 `frontend/portal-vue` 路径均为历史写法，对应现路径 `plus-ui/src-portal`（`src/` → `src-portal/`）。
> 状态（2026-08 迁移完成）：**Java + Vue 单栈**。Go 后端与 React 前端（原目录已随迁移删除）已于 2026-08 移除；本仓库仅剩 Java 后端（`ruoyi-*`）+ Vue 前端工程 `plus-ui`（内含业务门户 `src-portal` 与管理端 `src`），共用 MySQL 8.0，统一由 `deploy.sh` 部署（`db/migrations` 纯 mysql 迁移 + Java Maven 构建 + plus-ui（admin+portal）构建 + SeedRunner 种子 + 框架表初始化 + 冒烟）。**业务门户全量迁移完成**：系统管理（组织/角色/专业/行业/用户）+ 岗位/场景/课程/联盟/评价/教务/伙伴/门户 各域列表/详情编辑/批次/归档/审批 + 岗位学习路径与推荐 + 评价（岗位能力认定/考试使用/成绩结果/课程与场景任务评分）+ 教务（教学计划/学生/教师/排课/场地节次/Excel 导入导出）+ 伙伴企业端（共建/就业/合作/学校/任务/账号）+ 门户（学习社区/我的收藏）+ 登录/会话（含多租户选择）+ 工作流/导入导出。**AI 功能已随迁移整体下线**（页面/接口/表已删除）。superadmin 为独立 SaaS 运营平台单列（不在 portal api-client 范围内）。
> 状态（2026-08-19 完成）：**Vue 门户与 React 基线功能对齐实施完成**。M1-M8 全部模块翻译/核对完成，M9 特有页分类落地，M10 验收通过：路由差距清零、`vue-tsc` 类型检查 + `vite build` 通过、`spec-check.sh` 硬约束全部通过；M11 全局布局体系复刻完成。详见 §11。
> **阅读约定**：本文档记录迁移专项，§1–§10 多为**迁移执行期的背景与过程叙述**（其中提到的 Next.js / java-edu / Go 后端 / `/java/` 前缀 / 8083 双栈 / deploy-java.sh 均为历史状态，现已不存在）；**当前形态以本状态头与 §8「部署与验证」为准**。
>
> 范围（历史记录）：当时仅把 **Java 后端配套的业务门户前端**从 Next.js 迁移到 Vue 3.5 / TypeScript / Vite；Go 后端 + Next.js 前端当时作为生产基线不动，现已随 2026-08 单栈迁移删除。

## 1. 背景与目标

### 1.1 背景
- 本仓库原为 Go + Java 双后端并存；Java 后端（`ruoyi-*`，`org.dromara`）等价迁移 13 个业务域，共 635+ 端点，API 契约与 Go 版对齐（`/api/v1/**`、裸 JSON、`{items,total}`、`limit/offset`）。Go 后端已随 2026-08 单栈迁移删除。
- （**迁移前的历史状态，已不成立**）Java 后端曾复用 Next.js 业务门户（通过 `NEXT_PUBLIC_BASE_PATH=/java` 在 `/java/portal` 服务）；现 Java 侧为独立 Vue 门户，Next.js/React 前端已删除。
- 现有 Vue 工程 `plus-ui`（RuoYi-Vue-Plus 管理端，Vue 3.5.40 / Vite 8.1.5 / TS 6.0.3 / Element Plus 2.14.3）已随框架合仓进入仓库，覆盖后台管理控制台（系统管理/工作流/代码生成/监控），并已随单栈化接入 Java：deploy.sh 构建发布 `/plus-ui/`，`/prod-api/` 经容器网关代理到 java-backend（见 §8 与 `deploy/nginx-container/conf.d/zhiyu-site.conf`）。

### 1.2 目标
把 Java 配套的**业务门户**（岗位/场景/课程/联盟/评价/教务等前台页面）从 Next.js 迁移到 Vue 3.5 / TypeScript / Vite，使 Java 具备独立的 Vue 前端体系：

1. 新建独立 Vue 业务门户应用（原 `frontend/portal-vue`，现 `plus-ui/src-portal`），与 plus-ui 管理端并存，均对接 Java 后端。
2. **复用**：Java 后端（零改动）、plus-ui 工程骨架（构建/依赖/权限/请求封装）、shared-types（TS 类型直接移植）。
3. **增量迁移**：按业务域逐域翻译，按域渐进切换，任何时刻既有生产不受影响。
4. 明确边界：**不触碰**既有 Go 后端与 Next.js 前端任何文件（历史约束，现已随单栈迁移自然满足）。

### 1.3 成功指标
- 每个已迁移域：核心页面（列表/详情/增删改/审批/导入导出）在 Vue 端可用，接口返回与 Java 契约一致，权限/租户隔离行为等价。
- 迁移全程不修改既有前端/后端基线（历史验收项，已随单栈迁移自然满足）。
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
- **决策：新建独立应用（原 `frontend/portal-vue`，现并入 plus-ui 为 `src-portal` 第二构建）**，不复用 plus-ui 的「后台管理」布局/路由/菜单体系。
- 理由：业务门户是前台 landing + 卡片导航 + 多角色工作台风格（见 `05-prototype-interaction.md`），与 plus-ui 的后台侧栏布局形态不同；硬塞会导致布局层大改 plus-ui，破坏管理端。
- 但**复用** plus-ui 的：`vite.config.ts`/`tsconfig.json`/`uno.config.ts` 工程配置、权限 store/指令、Element Plus 通用组件（Pagination/DictTag 等）。注意：portal 请求层为**原生 fetch**（`src-portal/api/http.ts`，无 axios 依赖），token 存取也在 `http.ts` 内实现，不复用 plus-ui 的 request/auth utils。

### 2.3 数据边界
- **无数据模型变更**：Java 后端已共享 MySQL 8.0（同一库 `zhiyu_saas`），Vue 门户纯前端，不新增表/迁移/字段。
- 无新 API：全部复用 Java 后端现有 `/api/v1/**`（契约见 `02-api-contract.md`）。

### 2.4 与其他模块的关系
| 模块 | 关系 | 约束 |
|---|---|---|
| Java 后端 | 唯一数据源 | 零改动；Vue 请求层对齐其裸 JSON 契约 |
| plus-ui | 并存（管理端） | 不动其现有页面，仅复用工程配置/组件 |
| 既有 React 门户 | **隔离，不改** | 迁移期基线；Vue 门户全程只新增文件 |
| shared-types / api-client | 移植来源 | 从既有共享包**拷贝**类型/请求逻辑到 Vue 工程，不修改原文件 |

## 3. 核心流程与「React→Vue 翻译模板」

### 3.1 登录与会话
- 复用 Java 后端 Sa-Token Bearer 登录 + `/api/v1/.../me`（或等价 me 端点，见 `02-api-contract.md`），返回用户/角色/权限/菜单。
- token 存取沿用既有 api-client 逻辑：业务门户走根路径 `/api/v1/**`（无 `/java` 前缀），token key 用平台基础 key（`zhiyu-portal-token` 等）；401 跳对应平台登录页。
- 鉴权：前端按 `me.roles.permissions` / 菜单控制导航与按钮（等价既有门户的菜单权限逻辑），后端逐请求校验（Java 已有，无需改）。

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
`library → job → scene → lesson → alliance → evaluation → affairs → partner → superadmin → portal`（试点 library 后按此批推进；依赖关系见 §9）。

## 4. 数据模型
**N/A** —— 本迁移纯前端，无表/字段/迁移变更。数据模型继续以 `04-database-schema.md` 为单一事实源，不新增。

## 5. API 契约
**复用现有契约，不新增/变更端点。** Vue 请求层对齐以下约定（来源 `02-api-contract.md`）：

- 基础路径：`/api/v1/**`，Java 后端 8080。
- 响应：裸 JSON（非 `R<T>`）；错误 `{code, error, message?}`。
- 分页：`{items, total}` + `limit/offset`（maxPageSize 200）。
- 鉴权：`Authorization: Bearer <token>`；401 文本对齐 Go 中间件。
- 关键写操作走 Java 现有租户/权限校验，Vue 端不越权。

> 若翻译中发现某页面调用了 Java 尚未实现的端点，**停下来记录缺口**，不擅自改 Java 也不擅自改契约（见 §9 风险 R3）。

## 6. 后端开发计划（WBS）
**N/A** —— 后端零改动。若后续翻译暴露 Java 端点缺口，另立任务补 Java，不在本规格范围。

## 7. 前端开发计划（WBS）

> 全程只新增门户前端工程（原 `frontend/portal-vue/**`，现 `plus-ui/src-portal/**`）与部署脚本/nginx 增量配置；不修改既有前端/后端基线。

### Phase 0 — 工程基建（一次，依赖：无）
- [x] 门户应用壳（原 `frontend/portal-vue`，现 `plus-ui/src-portal`）：Vite/TS/Element Plus/pinia/vue-router 配置（复用 plus-ui 版本锁定；请求层用原生 fetch，无 axios）。
- [ ] 登录页 + 布局（前台 landing/卡片导航风格）+ 路由守卫 + 权限 store + `v-hasPermi` 指令。
- [ ] 移植 `shared-types`（26 个 .ts）为 `plus-ui/src-portal/types/*`。
- [x] Vue 请求层 `src-portal/api/*`：原生 fetch 封装（`http.ts`）+ `/api/v1` + 401 处理 + token 存取（单栈部署无 `-java` 前缀隔离）。
- [ ] nginx：门户静态资源与 SPA fallback 路由（见 §8）。
- [ ] 冒烟：登录 → me → 空工作台可渲染。

### Phase 1 — 试点域 library（依赖 Phase 0）
- [x] 列表页（资源库列表：搜索 + 类型筛选 + 分页 + 增删改，复用 `el-table`/`el-form`/`el-dialog`）——MVP 完成，`src-portal/views/library/resources.vue` 构建通过。
- [ ] 详情页、标签查询/绑定、批量导入、预览、零引用统计（增量补齐，见 §10 扩展性预留）。
- [ ] 沉淀翻译模板到本 spec §3.2，回填最佳实践（已按模板落地，待正式回填）。
- [ ] 验收：library 核心链路与 Java 契约一致，权限/租户行为等价（待 nginx 接线后部署冒烟）。

### Phase 2 — 批量翻译（依赖 Phase 1，可并行 [P]）
按域分批（每域一个 commit）：`job` [P]、`scene` [P]、`lesson` [P]、`alliance` [P]、`evaluation`、`affairs`、`partner`、`superadmin`、`portal`。
- 每域：列表/详情/写操作 + 权限点 + 关键导入导出（复用 Java 现有 import-export 端点）。

### Phase 3 — 渐进切换与收敛（依赖 Phase 2）
- [ ] 按域切换 nginx 路由到 Vue；未迁移域仍回 Next.js（过渡期）。
- [ ] 清理/归档：Java 不再构建 Next.js 门户（历史动作，已随迁移完成）。

## 8. 部署与验证

### 8.1 部署（单栈现状，无 `/java` 前缀）
- 统一经 `deploy.sh`（**唯一部署入口**）：`db/migrations` 纯 mysql 迁移 + `.` Maven 构建 + `plus-ui`（admin+portal）构建 + SeedRunner 种子 + Java 框架表初始化 + 健康门禁/业务冒烟（详见 `03-development-plan.md` §5）。
- 入口：边缘 nginx :80 **根路径直连**（`deploy/nginx/conf.d/`，单栈配置已注明「无 /java/ 前缀分流」），业务门户/管理端/API/上传全部经容器网关 → `java-backend`。`VITE_API_BASE=/api/v1`。
- 前端：plus-ui 单工程双构建——门户（`src-portal`，根路径 + SPA fallback，产物 `dist-portal`）与管理端（`src`，产物 `dist`）；均由 deploy.sh 构建并发布。
- 登录态：单栈部署 token key 直接用平台基础 key（`zhiyu-portal-token`（portal）/ `zhiyu-token`（saas）/ `zhiyu-partner-token`（partner），见 `plus-ui/src-portal/api/http.ts`），**无 `-java` 后缀隔离**。
- 上传件：`/uploads/` 由 Java 后端统一服务，走 `zhiyu-saas_uploads_data` 卷（容器以 uid 1000 运行）。
- 历史状态（已不存在）：`/java/` 前缀、8083 直连双栈、`deploy-java.sh`、java-edu 容器均已随单栈迁移移除。

### 8.2 质量门禁（每 Phase 提交前）
- `pnpm -C plus-ui build:portal`（vue-tsc 类型检查 + vite build）通过。
- `./scripts/spec-check.sh` 通过（本迁移不引入迁移/后端改动，应无新增阻断项）。
- 本规格 §7 任务与实现同步（spec-first）。

### 8.3 验收标准（DoD 对齐 `spec-standards.md` §四）
1. 每域核心链路（列表/详情/写操作 + 权限 + 租户隔离）在 Vue 端可用，行为与 Java 契约一致。
2. 迁移全程不修改既有前端/后端基线（历史验收项，已随单栈迁移自然满足）。
3. Java 侧生产健康检查持续通过（`docker compose -f deploy/docker-compose.yml ps` 全 healthy、`/health` ok）。
4. 本 spec §3.2 模板在试点域后回填为可复用标准。

## 9. 实施顺序与风险

### 9.1 实施顺序
Phase 0（基建）→ Phase 1（library 试点，验证模板）→ Phase 2（12 域批量，按 §3.3 顺序，独立域可并行）→ Phase 3（渐进切换 + 收敛）。

### 9.2 风险
| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | Vue 与 React 行为漂移（分页/权限/错误分支） | 功能回归 | §3.2 模板逐点对照；每域验收对齐 Java 契约；复用 plus-ui 已验证封装 |
| R2 | 破坏既有前端/后端基线 | 生产事故 | 铁律：不碰既有 React 门户/Go 后端（历史约束，现已删除）；只新增文件；每 Phase `git diff --stat` 校验 |
| R3 | 某域发现 Java 端点缺口 | 卡域 | 记录缺口，另立后端任务，不擅自改契约 |
| R4 | 门户与管理端依赖漂移 | 维护成本 | §2.1 统一沿用 plus-ui 锁定版本（2026-08 已合并为单工程，共享 lockfile，漂移在结构上消除） |
| R5 | 前台 landing/卡片导航 UI 风格复杂，逐页翻译费时 | 进度 | 优先复用 plus-ui 通用组件 + AI 辅助翻译；按域分批不追求一次性全量 |

## 10. 扩展性预留（明确「暂不做」）

- **不重做前端栈切换**：Vue 门户为业务门户唯一实现（历史阶段曾与 React/Go 并行共存，现已单栈化）。
- **不把业务门户塞进 plus-ui 后台布局**：门户（`plus-ui/src-portal`）为前台风格独立应用（独立入口/产物，与管理端互不引用布局）。
- **不新增/变更后端接口**：迁移只消费现有 Java 端点；发现缺口另立任务。
- **不做统一登录/SSO 改造**：沿用现有 token 体系与 Sa-Token 会话。
- **不引入新 UI 库**（如 Ant Design Vue）：统一 Element Plus。

## 11. 与 React 基线功能对齐计划

> 背景：既有 React 门户（历史，已随 2026-08 单栈迁移删除）从 Next.js 迁移为 React SPA 后持续演进；Vue 门户（§1-§10 迁移成果）以旧 Next.js 快照为基准，与 React 现况存在差距。本计划以 **React 为唯一功能/交互基准**，逐页对齐 Vue 门户（已实施完成）。

### 11.1 决策（用户 2026-08-19 拍板）

| 决策点 | 结论 |
|---|---|
| 对齐范围 | **仅 portal 业务门户（`plus-ui/src-portal`）**；superadmin / changelog / plus-ui 管理端不纳入 |
| 视觉一致性 | **功能 + 交互逻辑与 React 一致，视觉沿用 Element Plus 原生风格**（不逐像素对齐） |
| 推进顺序 | **按 React 路由顺序**：affairs → evaluation → job → lesson → library → partner → portal → scene |
| 后端 | Java 端点已对齐（729 个，无缺失），纯前端工作量；偶发缺口按 R3 记录 |

### 11.2 差距基线

- 机器化路由对比明细见历史「前端对齐差异表」（含缺失清单、Vue 特有 46 条分类、每页六项核对标准）。
- 缺口集中：portal 域 61 条（alliance 前台 15 + apps/alliance 28 + apps/system 17 + login 1）；affairs 9 / evaluation 10 / lesson 12 / partner 11 / job 4 / scene 5 / library 1。

### 11.3 批次计划（每模块一个 commit，可并行 [P]）

| 批次 | 模块 | 内容 | 依赖 |
|---|---|---|---|
| M1 | affairs | 9 页重写 + 已有 6 页核对 | 无 |
| M2 | evaluation | 10 页重写 + 已有页核对 | 无 [P] |
| M3 | job | 4 页重写 + 已有页核对 | 无 [P] |
| M4 | lesson | 12 页重写 + 已有页核对 | 无 [P] |
| M5 | library | 1 页核对（resources/:type） | 无 [P] |
| M6 | partner | 11 页重写 + 已有页核对 | 无 [P] |
| M7 | portal | 76 页重写（4 子批：alliance 前台 / apps-alliance / apps-system） | 无 |
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

1. 历史「前端对齐差异表」缺失清单清零（changelog/superadmin 除外），Vue 特有 46 条全部分类落地；
2. 每模块：`pnpm -C plus-ui build:portal`（含 `vue-tsc` 类型检查）通过；`./scripts/spec-check.sh` 通过；
3. 抽样页人工核对六项标准（字段/校验/分页/错误分支/权限点）；
4. 全程不修改既有前端/后端基线（历史验收项，已随单栈迁移自然满足）；
5. 每模块 commit 同步本 spec §11 进度与差异表状态。

### 11.6 风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| A1 | React 页面复杂（studio/品牌多 Tab 编辑等）翻译量大 | 进度 | 按页拆分 commit；子代理并行；复用 §3.2 模板 |
| A2 | Vue 特有页（community/favorites）React 无对应 | 范围争议 | §3.3 逐条与用户确认：删除或保留 |
| A3 | 路径归一化误删 Vue 有用入口 | 功能丢失 | 归一化前核对 React 等价入口，记录迁移映射 |
| A4 | Java 端点缺口（React 新页调用新端点） | 卡页 | 按 R3 记录缺口另立 Java 任务，不擅自改契约 |

### 11.7 全局布局体系复刻（M11，2026-08-19）

> 背景：M1-M10 逐页对齐后，Vue 门户仍缺 React 的**全局布局体系**——顶部导航项与 React 不一致（多「学习社区/我的收藏」），且各管理后台域**无左侧导航**。本节记录布局框架复刻结论（阶段 1：框架先行，不改页面/路由）。

**实现（只新增/修改 `plus-ui/src-portal/layouts/`）**

| 文件 | 职责 | React 对应 |
|---|---|---|
| `layouts/navigation-config.ts` | 11 个域的 `PlatformNavigationConfig`（brandTitle / currentPlatformLabel / sideNavItems 分组与子项 / href / matchers / 图标键）+ 图标映射 + 路径匹配函数 + 路径→域解析 | React 侧 `navigation-config.ts` + 平台壳配置/图标/工具 |
| `layouts/PlatformSideNav.vue` | 左侧域导航（品牌区 + 分组折叠 + matchers 高亮 + 平台切换区 + 移动端抽屉） | React 侧 `PlatformSideNav` |
| `layouts/PortalLayout.vue` | 顶栏（品牌 + 3 项导航 + 当前时间 + 用户区/登录入口）+「左侧导航 + 右侧内容」布局壳 | React 侧 top-nav / PlatformShell / platform-layout |

**行为约定**

1. 顶部导航固定 3 项：门户首页 `/portal`（精确高亮）、我的服务台 `/portal/workspace`（前缀高亮）、应用服务中心 `/portal/apps`（仅主页高亮，平台页不高亮入口）；**「学习社区/我的收藏」入口移除**（路由保留，入口归 workspace，对齐 React）。未登录只显示登录入口（跳 `/portal/login`）。
2. 左侧导航按当前路径解析域：`/job`、`/scene`、`/lesson`、`/evaluation`、`/library`、`/affairs`、`/partner`、`/portal/apps/system`、`/portal/apps/alliance`（另含 Vue 旧短路径 `/system/*`、`/users`、`/alliance/*`）；`/portal/*` 门户页、`/portal/alliance/*` 前台页、顶层 landing 与聚合页（`/approvals`、`/workflows`、`/import-export`）**无侧栏**——与 React 各域 `layout.tsx` 挂载范围等价。
3. React 中 Vue 路由不存在的落点做等价替换并注释：场景管理 `/scene/` → `/scene/scenarios`；Vue 别名路径（如 `/evaluation/job-ability-results`、`/partner/co-build-scenarios`、`/lesson/courses`）以**追加 matcher** 方式保证高亮，不改 React 原有 matcher 语义。

**未复刻项（依赖缺失能力，后续阶段接入）**：菜单权限过滤（Vue 无 `hasMenuPermission` 数据源，侧栏仅过滤 `hidden`）、国际化切换 / 字号缩放 / 移动端扫码 / 多角色切换（React 顶栏依赖 i18n 与角色接口）、顶层 landing 公开页的顶栏（landing 为 `PortalLayout` 之外的顶层路由，接入需改 `router/index.ts`，本阶段禁止）。

**与 React 的已知差异（阶段 1 有意保留，接入页面/路由时再处理）**：

| # | 差异 | 说明 |
|---|---|---|
| 1 | `/partner/*` 复用门户顶栏 | React `app/partner/layout.tsx` 是独立企业服务台 header（logo + 企业名 + 退出）；Vue partner 路由挂在 `PortalLayout` children 下，改挂载需动 `router/index.ts`，本阶段禁止 |
| 2 | 顶栏品牌区为文字 | React 为 logo 图片 + 平台名「场景化数智教学服务平台」；Vue 门户 `public/` 无 logo 资源，按任务约定用文字「知与 SaaS」 |
| 3 | 顶栏溢出降级简化 | React 用 `ResizeObserver` 实测溢出后按优先级逐级隐藏文字；Vue 改为媒体查询（<768px 隐藏时间/用户副信息/导航文字），效果等价、实现更轻 |
| 4 | 顶栏定位 `sticky` 而非 `fixed` | React `fixed` + 内容 `pt-14`；Vue 用 `sticky` 免去内容偏移补偿，视觉一致 |
| 5 | `/job/positions/:id/edit` 无侧栏高亮 | React matchers `['/job/positions$','/job/positions/']` 对子路径实际不生效，Vue 保持同源行为（如需高亮属 React 侧缺陷修复，另立任务） |
| 6 | 顶栏「我的服务台」项无权限过滤 | React 对该项做 `hasMenuPermission('/portal/workspace')` 过滤；Vue 无权限数据源，登录后无条件显示（同「菜单权限过滤」未复刻项） |
| 7 | 侧栏同一时刻只高亮一项 | React 各分组独立判活（理论上可双高亮），Vue 受 `el-menu` 单 activeIndex 限制取全局最长匹配；已核对 11 域 matchers 前缀互不重叠，当前不可复现 |
