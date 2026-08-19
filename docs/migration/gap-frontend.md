# 前端（React SPA → Vue 门户）对比差距报告

> 源/基准：React SPA `frontend/edu`（`src/routes.tsx` 路由表 + `packages/api-client/src/api/*.ts` 集中式 API）。
> 复制/对齐目标：Vue `frontend/portal-vue`（`src/router/index.ts` + `src/api/*.ts` + 分散在 `views/**` 的本地 API）。
> 范围：plus-ui（RuoYi 管理端）不在本域对齐范围内。
> 方法：逐路由比对 routes.tsx vs router/index.ts；逐 API 对象/方法比对 api-client 与 portal-vue/src/api，并对每个"疑似缺失"端点用 `grep -rlF` 全库扫描 `portal-vue/src` 确认"真缺失"还是"分散在 view 级文件"。

---

## 1. 接口/路由差距

### Java 缺失（React 有、Vue 无）

**整页缺失（无任何路由/组件对应）：**

| 路径 | React 依据 | 说明 |
|---|---|---|
| `/changelog` | `app/changelog/page.tsx` | 静态更新日志页，Vue 全库无 `changelog` |
| `/superadmin` | `app/superadmin/page.tsx` + `layout.tsx` | 超级管理员控制台（租户/套餐/租户级 AI 配置），Vue 全库无 `superadmin` |

**URL 别名缺口（React 深链在 Vue 会误入错误页面/404）：**

| React 路径 | Vue 现状 | 影响 |
|---|---|---|
| `/partner/employment-jobs/new` | 仅 `/partner/employment-jobs/new/edit`（`:id/edit` 复用），无 `new` 别名 | React 深链 `/partner/employment-jobs/new` 会命中 `partner/employment-jobs/:id`（id=new）→ 详情页报错 |
| `/partner/experts/new` | 仅 `/partner/experts/new/edit`，无 `new` 别名 | 同上 |
| `/partner`（index → workspace） | 无裸 `/partner` 路由（仅 `/partner/login` 顶层 + `partner/workspace` 子路由） | `/partner` 落入 404 兜底重定向 `/portal` |

### Java 多出（Vue 有、React 无）

以下多数是**别名/重构**或**把 React 页内 Tab 拆成独立路由**，非功能缺口，仅列示供复核：

- `/login`（门户登录别名，React 仅 `/portal/login`/`/partner/login`）
- `/portal/community`、`/portal/favorites`（React 为 `portal/workspace` 内 Tab：`community-tab.tsx`/`career-tab.tsx`；Vue 拆成独立路由）
- `/users`（用户管理，React 对应 `portal/apps/system/org-user/accounts`）
- `affairs/archive`、`evaluation/archive`（React affairs/evaluation 域无归档页，仅 job/scene/lesson 有）
- 短路径别名（Vue 独有，均复用同一组件）：`system/organizations|roles|majors|industries|org-types`、`alliance/projects|agreements|achievements|brands`、`ai/agents|kbs|chat|square|admin/*`（重定向）、`evaluation/job-ability-results`、`evaluation/exam-usage-results`、`evaluation/job-ability-config/:id`、`partner/co-build-positions`、`partner/co-build-scenarios`、`affairs/scheduling-config`、`lesson/batches`、`lesson/archive` 等

---

## 2. 文件/实体覆盖差距（API 客户端层）

React `packages/api-client/src/api/` 共 18 个业务文件；Vue `portal-vue/src/api/` 共 15 个（含 infra 的 `http.ts`、框架特有的 `approval.ts`）。

### React 文件 → Vue 无直接同名对应（已折叠/分散）

| React 文件 | Vue 去向 | 状态 |
|---|---|---|
| `ai-center.ts`（AI 中心：kb 文档/协作者、agent 会话、v2.2 asks/yiknow、preview） | 折叠进 `src/api/ai.ts`（部分）+ `views/ai/ai-api.ts`（`aiAgentExt`/`aiKbExt`/`aiSquareExt`/`aiV22Ext`） | 分散，功能基本覆盖 |
| `alliance-employment.ts`（就业项目/岗位/报名） | 折叠进 `src/api/partner.ts`（`partnerEmploymentApi`）+ `views/portal/apps/alliance/employmentjob.vue` 等 view 内直连 | 分散，部分缺失（见 §3） |
| `favorites.ts`（`favoriteApi`） | 折叠进 `src/api/portal.ts` | 已覆盖 |
| `honors.ts`（`studentHonorApi` 学生荣誉） | 分散到 `views/portal/workspace/workspace-api.ts` + `ProfileTab.vue` | 已覆盖 |
| `partner-cobuild.ts`（共建岗位/场景深编辑：职责/证书/能力绑定、任务/权重、学校侧数据源） | 折叠进 `src/api/partner.ts`（仅基础 CRUD）+ `views/partner/co-build-*.vue` 内直连 | 分散，深编辑能力部分缺失（见 §3） |

### Vue 多出文件（无 React 直接对应）

- `src/api/approval.ts`（审批，React 的 `approvalApi` 在 `system.ts` 内，等价）
- `src/api/http.ts`（基础设施：token/request/createCrudApi，React 对应 `api-helpers.ts`+`api-factory.ts`）

---

## 3. 字段/方法级差距（抽查，已按"全库缺失 vs 分散"标注）

> 标注规则：**全库缺失** = `grep -rlF <endpoint> portal-vue/src` 无命中；**分散** = 端点存在于 `views/**` 本地 API 文件而非 `src/api/*.ts`。

### 3.1 确认被 React 页面使用、Vue 缺失的功能（高置信，重点）

| 域 | React 方法/端点 | Vue 现状 | 影响 |
|---|---|---|---|
| partner 就业 | `partnerEmploymentApi.listApplications/getApplication` → `/partner/employment-applications`（`app/partner/employment-jobs/[id]/page.tsx:77` 已用） | **全库缺失**；`partner.ts` 无，端点全库无 | 企业无法查看岗位报名/申请人 |
| partner 就业 | `getProject`/`getJob`/`setJobStatus`（发布/关闭岗位） | 部分 view 内直连（`/partner/employment-projects/:id`、`/partner/employment-jobs/:id`），但 `setJobStatus` 未见 | 岗位发布/关闭状态操作缺失或需核对 |
| 认证规则 | `certApi.putPointTaskWeights`（任务级权重，独立端点 `/evaluation/certifications/positions/{pid}/points/{pointId}/task-weights`，`position-weight-config.tsx:203` 已用） | Vue `certApi` 无该方法；`job-ability-config.vue` 把 `taskWeights` 塞进 `putPositionWeights` payload | 任务级权重保存契约与 React/Go 不一致，可能无法正确持久化 |
| 考试 | `examApi.publish`（`POST /evaluation/exams/:id/publish`） | **全库缺失**（仅 `exam-usages/:id/publish`） | 无法发布草稿试卷（只能发布考试场次） |
| 题库 | `questionApi.batchCreate`（`POST /evaluation/questions/batch`） | **全库缺失** | 题库批量导题缺失 |
| 评测结果 | `evaluationResultApi.submit`、`batchGrade`（`POST /evaluation/results/batch-grade`） | **全库缺失**（Vue `evaluationResultApi` 仅 list/get/grade） | 结果批量评分/提交缺失 |

### 3.2 React 定义了但 Vue 缺失（React 侧疑似未接线，优先级低）

| 域 | 缺失内容 |
|---|---|
| 学生能力画像 | `portraitApi`（`/evaluation/portraits` + archives/generate），React app 内无页面引用，疑似遗留接口 |
| 认证规则明细 CRUD | `certApi.listItems/upsertItem/updateItem/deleteItem/listPoints/updatePoint/deletePoint/createTask/updateTask/deleteTask/getFullRule/putFullRule`（`/evaluation/certifications/items|points|tasks`），React 页面只用权重/等级相关方法 |
| 抽题 | `randomDrawQuestionApi`（`/evaluation/random-draw-questions`）—— Vue 已在 `views/library/questions.vue` 等直连 |
| 教务 | `periodSlotApi.replace`（`/affairs/period-slots/replace`）、`programApi.publish/clone`、`teachingPlanApi.deleteEntry`、`affairsBatchApi.updateStatus` |
| 岗位 | `positionApi.getSnapshot`、`abilityApi.citationStats/uncited`（`citationStats` Vue 已在 `views/library/ability.vue` 直连，`uncited` 全库缺失） |
| 课程 | `courseApi.clone/getSnapshot`、`knowledgeApi.citationStats/uncited`、`nodeResourceApi`/`courseResourceApi`（Vue 在 `views/lesson/*.vue` 直连）、`hybridModuleApi`（Vue 在 `course-hybrid-edit.vue` 直连）、`nodeEvaluationResultApi.submit` |
| 场景 | `scenarioApi.clone/getSnapshot`、`scenarioWeightApi`（Vue 在 `scenario-tasks.vue` 直连 `/scene/weights`）、`taskResourceApi`（`/scene/task-resources`，Vue 改用 task `resourceIds` 字段）、`taskEvaluationApi` 模板部分（Vue 在 `views/scene/evaluation-rules/api.ts` 直连） |
| 资源库 | `resourceLibraryApi.citationStats/uncited/previewImport`（Vue 在 `views/library/resources.vue` + `ResourceBatchImportDialog.vue` 直连） |
| AI | `aiApi.getConfig/saveConfig/deleteConfig/getUsage`（Vue 在 `views/system/tenant.vue` 直连 `/ai/config`/`/ai/usage`）、`adminAiApi`（`/admin/tenants/.../ai/config`，随 superadmin 一起缺失） |
| 联盟 | `allianceEnterpriseApi.search/link/unlink/register`、`allianceGrantApi`、`allianceExpertApi.mentorOptions/updateDisplay`、`alliancePermissionApi.toggleEnabled`、`allianceBrandApi.talentRanking/rankConfigs`（Vue 多数在 `views/portal/apps/alliance/*.vue` 直连，`crud-shared.ts` 明确注释"api/alliance.ts 缺失，直连"） |
| 共建 | `partnerCobuildTaskApi`/`WeightApi`/`SchoolApi`（Vue 在 `views/partner/co-build-*.vue` 直连 `/partner/co-build/tasks`/`/partner/co-build/schools`）、`partnerExpertApi.me/updateMe`（`/partner/experts/me` Vue 在 `views/partner/experts.vue` 直连） |
| 门户 | `myScheduleApi`（`/portal/workspace/my-schedule`，Vue 在 `workspace-api.ts` 直连）、`portalMeApi.updateName/changePassword`、`studentHonorApi`（Vue 在 `workspace-api.ts` 直连） |
| 认证 | `authApi.login/saasLogin/me/saasMe`（SaaS 管理员登录/取 me，React 供 superadmin 使用；Java 侧可能由 plus-ui 承担） |

---

## 4. 建议迁移项（按优先级）

### P0 阻断（功能完全缺失，需先补）

1. **企业岗位报名/申请人查看** — Go/React 依据：`frontend/edu/app/partner/employment-jobs/[id]/page.tsx` 调 `partnerEmploymentApi.listApplications`（`/partner/employment-applications`）。Vue 需补：`src/api/partner.ts` 增加 `partnerEmploymentApi.listApplications/getApplication`，并在 `views/partner/employment-job-detail.vue` 增加报名列表展示。
2. **认证规则"任务级权重"保存契约** — Go/React 依据：`frontend/edu/app/evaluation/job-ability/config/[id]/_components/position-weight-config.tsx` 调 `certApi.putPointTaskWeights`（独立端点）。Vue 需补：`src/api/evaluation.ts` 的 `certApi` 增加 `putPointTaskWeights`，并让 `job-ability-config.vue` 改用该端点（当前把 taskWeights 塞进 putPositionWeights，与 React/Go 契约不符）。

### P1 重要（常用功能缺失/不一致）

3. **`/superadmin` 超级管理员控制台** — Go/React 依据：`app/superadmin/page.tsx`（租户/套餐/租户级 AI 配置）。Vue 需补：整页 + 路由 + `adminAiApi`（`/admin/tenants/.../ai/config`）。若确认由 plus-ui（RuoYi 管理端）承担，则本项降级并在此登记结论。
4. **试卷发布 `examApi.publish`** — Go/React 依据：`packages/api-client/src/api/evaluation.ts` `examApi.publish`。Vue 需补：`examApi.publish` + `views/evaluation/exam-edit.vue` 发布按钮。
5. **URL 别名兜底** — Go/React 依据：routes.tsx 的 `/partner/employment-jobs/new`、`/partner/experts/new`。Vue 需补：`redirect` 别名（`new → /new/edit`）与裸 `/partner` → `/partner/workspace`，避免旧深链误入详情页。
6. **API 层集中化收敛** — Go/React 依据：`packages/api-client/src/api/*.ts` 集中式契约。Vue 需补：把 `views/ai/ai-api.ts`、`views/portal/apps/alliance/crud-shared.ts`、`views/portal/workspace/workspace-api.ts`、`views/scene/evaluation-rules/api.ts` 等 view 级本地 API 上收到 `src/api/*.ts`，与 React 对齐（当前导致 `src/api/*.ts` 大量"看似缺失"、维护分散）。

### P2 次要（遗留/低影响）

7. **`/changelog` 更新日志页** — Go/React 依据：`app/changelog/page.tsx` + `lib/changelog-content`。Vue 需补：静态页 + 路由。
8. **题库批量导题 `questionApi.batchCreate`、结果批量评分 `evaluationResultApi.batchGrade/submit`** — Go/React 依据：`evaluation.ts` 对应方法（React 页面是否接线需再确认）。
9. **引用统计 `citationStats/uncited` 收尾** — Go/React 依据：`job.ts`/`lesson.ts`/`library.ts` 的 citationStats/uncited。Vue 已部分在 view 内直连（library/resources、library/ability），但 `job/certificate-library/uncited`、`lesson/knowledge-points/uncited` 等仍全库缺失，需补齐并集中。
10. **快照版本 `getSnapshot`（position/course/scenario/exam/question-bank）** — Go/React 依据：各 `*Api.getSnapshot`。Vue 仅 exam 有 `getSnapshot`，其余缺。
11. **学生能力画像 `portraitApi`** — Go/React 依据：`evaluation.ts` `portraitApi`（React 页面未引用，疑似遗留）。建议先确认 Go 后端是否仍暴露该端点再决定是否补。
12. **`affairs/archive`、`evaluation/archive` 为 Vue 多出** — 反向核对：确认 React/Go 是否真的无此域归档功能，避免 Vue 引入 Go 不支持的端点。

---

## 附：方法学说明与置信度

- "全库缺失"结论基于对 `portal-vue/src` 全树 `grep -rlF <endpoint>`（排除 node_modules）无命中；"分散"结论基于命中文件位于 `views/**` 而非 `src/api/**`。
- React 侧"已使用"结论基于对 `frontend/edu/app` 全树 grep 方法调用点；"未接线"（如 `portraitApi`、`certApi.listItems`、`batchGrade`）表示 api-client 定义了但 React 页面未引用，属遗留接口，迁移优先级相应下调。
- 本报告聚焦 React→Vue 前端对齐；涉及"Vue 是否与 Go 后端契约一致"（如 taskWeights 塞入 putPositionWeights）的点，建议由后端对比子代理或 Go 契约二次确认。
