# 知与 SaaS 全量代码审查问题清单

> 审查日期：2026-08-16。审查方式：24 个并行子代理逐文件逐行完整读完全部自有源代码（后端 489 个 .go 文件 + 前端 617 个 .ts/.tsx 文件，约 27 万行），辅以 `spec-check.sh` 机器硬约束与语义自查。
> 分级沿用 AGENTS.md「简单优先 / 安全只排高危 / 性能稳定性优先 / 容忍 hacker / 锁只给核心业务」五项原则。
> 文件清单（含逐文件勾选）见 [`file-inventory.md`](file-inventory.md)。

---

## 0. 结论摘要

| 维度 | 结论 |
|---|---|
| spec 规范质量 | **优秀**：五层制品 + 子平台 spec + ADR + 复用速查 + 安全/非功能规范齐备，闭环可执行，仅 1 处流程 YAML 语法 bug 与 2 处契约漏登记（已修） |
| spec↔代码偏差 | 机器硬约束全通过；发现 2 处路由未登记契约 + 1 处 AGENTS.md 与 deploy.sh 口径漂移（已修） |
| 后端分层红线 | 无违规（handler 无裸 SQL / service 无拼 SQL / store 不读 HTTP） |
| AI 底座红线 | 无绕过；但 SSE 未配置 412 预检失效（已修） |
| 安全 | 发现 7 处**真实越权/泄露**（已修）；另有约 20 处「handler 已校验、SQL 层缺纵深防御」（部分修、多数遗留记录） |
| 性能/稳定性 | 无 N+1 硬伤于核心读写路径；导出/批量/审批等非核心路径存在大量 N+1 与全量拉取（按「非核心允许等待」原则多数遗留记录） |

---

## 1. 第一部分：spec 规范评估（Q1）

### 1.1 总体评价

`AGENTS.md` + `docs/` 构成一套**成熟、可执行的 spec-first 制度**，显著优于一般 AI 主导仓库：

- **分层清晰**：AGENTS.md 摘要红线 → `docs/refactor-layering.md`/`ai-development.md`/`security-standards.md` 细则 → ADR 记「为什么」→ 速查表记「能复用啥」。查证链路完整。
- **闭环可执行**：七节点闭环 + DoD + `spec-check.sh` 机器硬约束 + `ui-smoke --flows` 业务链路 + `spec_analyze` 语义复查，四层校验互补。
- **防过度设计**：每个子平台 spec 模板强制「扩展性预留」章节；simplification-notes 要求「给调用点证据」。

### 1.2 发现的缺陷（已修复）

| # | 缺陷 | 位置 | 修复 |
|---|---|---|---|
| 1 | 验收流程 YAML 语法错误：`ai-agent-publish-loop` 一步内出现两个 `fill` 键、两个 `click` 键，js-yaml 报 `duplicated mapping key`，导致 `--flows` 该流程无法解析 | `docs/spec/06-acceptance-flows.md` §3.3 | 合并 `fill` 为单键；把「切换审核 Tab」与「筛选已发布+下架」拆为两个 step |
| 2 | 代码路由 `/ai/yiknow/chat`、`/ai/yiknow/conversations`（v2.2 YIKnow 会话）未登记 API 契约 | `docs/spec/02-api-contract.md` §3.9、`docs/spec/ai-service-center.md` §5.2/§5.6 | 补齐两处路由表 + 鉴权矩阵 |
| 3 | AGENTS.md §4.1 称「deploy.sh 自动执行质量门禁」，实际 deploy.sh 默认跳过（`--gates` 可选、CI 覆盖），口径漂移 | `AGENTS.md` §4.1 | 改为准确表述：门禁默认由 CI 覆盖，`--gates` 可选本地执行 |

### 1.3 无缺陷但属「有意为之」的项（不修改）

- `dangerouslySetInnerHTML` 两处（`app/layout.tsx` 字体/语言/主题色内联脚本、`packages/ui/chart.tsx` 图表 CSS 变量）——均为**硬编码常量**，非用户/LLM 内容，spec-check 提示级为误报。
- JWT 存 localStorage（`security-standards.md` §2 已记录「评估结论：主认证不迁移 HttpOnly cookie」）。
- 明文初始密码一次性回传（`security-standards.md` §1 已记录「明文密码仅在重置响应中一次性返回」）。

---

## 2. 第二部分：存量代码是否偏离 spec（Q2）

机器硬约束（`spec-check.sh`）全部通过，证明**分层/AI 底座/migration/ADR/租户关键写**未系统性漂移。语义层发现如下偏差：

| # | 偏差 | 严重度 | 处置 |
|---|---|---|---|
| 1 | `/ai/yiknow/*` 路由未登记契约 | 提示 | ✅ 已修（§1.2 #2） |
| 2 | AGENTS.md 与 deploy.sh 门禁口径不一致 | 提示 | ✅ 已修（§1.2 #3） |
| 3 | `ssE 未配置 → 412` 契约（ai-service-center §5.5）被实现违背：`GetConfig` 未配置返回 `(configured=false, nil)` 而非 error，导致 412 预检失效 | 中 | ✅ 已修（见 §3.1 #8） |
| 4 | 前端 `evaluation/scene-results` 详情/列表页无权限门禁，直接渲染参考答案与全班成绩（后端有角色校验，但前端门禁缺失，违反「前端也按权限渲染」惯例） | ~~高~~ 误报 | ✅ 核实后关闭（见 §5） |

---

## 3. 第三部分：代码问题清单（Q3）

### 3.1 高危（安全/越权/泄露）—— 已全部修复

| # | 问题 | 位置 | 最佳实践修复 |
|---|---|---|---|
| 1 | **OAuth 凭据泄露**：`/auth/me` 返回 `domain.User` 时未清空 `user.Oauth`（第三方 OAuth 凭据），登录/partner 路径均已清、唯独 Me 漏 | `backend/internal/handler/auth_handler.go:448` | 构造 `MeResponse` 前 `user.Oauth = nil` |
| 2 | **跨租户删除题目**：`Delete` 先无租户条件删 `exam_questions`，传入他租户 exam_id 时先毁他租户题目、再静默 0 行 | `backend/internal/store/exams.go:96` | 题目 DELETE 补 `AND tenant_id=$2`；主表删除校验 `RowsAffected` |
| 3 | **跨租户改考试安排状态**：`SetStatus` 状态写 SQL 仅 `WHERE id` 无租户（红线：状态写需 SQL 层租户纵深防御） | `backend/internal/store/exam_usages.go:193` | 签名加 `tenantID`，`WHERE id=$2 AND tenant_id=$3`（handler/service 同步透传） |
| 4 | **跨租户投递**：学生投递 `INSERT..SELECT` 未校验 `u.tenant_id = j.tenant_id`，target_groups 为空时任意租户学生可把他校岗位的 PII 快照写入他人租户 | `backend/internal/store/alliance_employment_store.go:414` | `JOIN users u ON u.id=$3 AND u.tenant_id = j.tenant_id` |
| 5 | **租户自延订阅**：portal 学校管理员可 `PUT /tenants/{id}` 修改 `valid_from/valid_until` 自行延长有效期，绕过登录门禁 | `backend/internal/handler/tenant_handler.go:225` | 非平台管理员（`!canManagePlatform`）剥离有效期字段 |
| 6 | **越权枚举未公开专家**：`ListPublicExperts` 的 `includeNonPublic=true` 对任意登录用户放行，绕过 `is_public` 隐私开关跨租户读专家档案 | `backend/internal/handler/alliance_handler.go:1468` | 收紧为「本校 + `canManageAlliance` 角色」方可传 `includeNonPublic=true` |
| 7 | **企业成员越权读专家档案**：`GET /partner/experts/{id}` 注册在 admin+member 组，member 可读他人专家完整档案（含 PII） | `backend/internal/router/routes_partner.go:24` | 移入 `adminOnly` 组（member 仅可读 `/experts/me`） |

### 3.2 中危（性能/稳定性/契约）—— 已修复关键项

| # | 问题 | 位置 | 最佳实践修复 |
|---|---|---|---|
| 8 | **AI 412 预检失效**：`AgentChat`/`KBAsk`/`YIKnowChat` 用 `if _, err := GetConfig(...); err != nil` 预检，未配置时 `GetConfig` 返回 `(configured=false, nil)`，导致 SSE 已 emit meta/sources 并落库后上游才报错 | `backend/internal/service/ai_center_agent.go:253/342`、`ai_center_v22.go:51` | 改为 `cfg, err := GetConfig; if !cfg.Configured { return ErrAINotConfigured }` |
| 9 | **审计日志 goroutine 不可自愈**：`flushLoop` 的 panic recover 包裹整个循环，flush 内 panic 会永久终止 goroutine，后续操作日志静默丢失 | `backend/internal/middleware/oplog_buffer.go:63` | recover 下沉到每次 `flushSafe`，panic 只丢当前批、循环继续 |
| 10 | **SaaS 超管写操作双写审计**：外层已挂 `OperationLog`，platformAdmin 组内又重复挂载，产生两条 operation_logs | `backend/internal/router/routes.go:301` | 删除内层重复挂载 |
| 11 | **迁移切分器 dollar-quote 关闭 bug**：关闭 `$tag$` 时先清空 `openTag` 再用 `len(openTag)-1` 回退索引（恒回退 1），导致函数/DO 块之后所有语句被并作一条，migrate 会失败 | `backend/cmd/migrate/main.go:238` | 先存 `tag := openTag` 再清空，`i += len(tag)-1` |

### 3.3 中危/低危 —— 遗留记录（按五项原则判断「不值得修 / 已兜底 / 非核心」）

> 下列问题已核实代码位置与最佳实践方案，但按用户五项原则**有意遗留**，理由见每条「遗留理由」。完整清单供后续按需治理。

#### A. 租户隔离纵深防御缺口（handler 层已 `verifyTenantOwnership` 兜底，SQL 层缺租户条件）

按 ADR-0003「handler 校验为主、SQL 层可选限定」属「有意为之」的已知取舍；以下仅当「未来新增调用点漏校验」时才构成 IDOR，故降为遗留：

- `store/appeal.go:82` Process 状态写、`store/exam_results.go:89` Grade 改分、`store/evaluation_results.go:156` Grade/BatchGrade 改分、`store/content_actions.go:148` Transition/Review 状态写、`store/exam_questions.go:20` SyncExamQuestions、`store/scenarios.go:111` Update/Delete、`store/positions.go:164/186` Update/Delete 级联、`store/position_bindings.go`/`position_certificates.go`/`position_clone.go`、`store/course_clone.go`、`store/alliance_source_edit_store.go`、`store/organizations.go:137`、`store/industries.go`/`majors.go`/`org_types.go`/`on_site_question_library.go`（DictStore 基类）、`store/resource_codes.go`、`store/roles.go:63`、`store/staff_titles.go:53`、`store/subscriptions.go:85`、`store/tenant_admins.go:118`、`store/scheduling.go:304`、`store/scenario_import_export.go:43`、`store/question_import_export.go:41/91`、`store/resource_import_export.go:329`、`store/imports.go:189/332`、`store/student_portraits.go:55`、`store/resource_bindings.go:144`。
- 最佳实践：这些写操作签名补 `tenantID` 并在 WHERE 补 `AND tenant_id=$N`（参考同库 `exams.go`/`exam_usages.go` 已对齐的写法）；`service/evaluation_appeal.go` 的 `GetAppeal/ProcessAppeal` 与 `service/evaluation_result.go:159` `GradeExamResult` 建议签名补 tenantID。
- **遗留理由**：① 调用方 handler 均已做归属校验，无真实越权路径；② 批量改签名会牵动数十处调用点与测试，风险与收益不成比例；③ 属 ADR-0003 明示的「可选限定」。

#### B. N+1 / 全量拉取（非核心路径，允许等待）

- 导出类（10min 长超时，非核心）：`service/course_export.go:35`、`service/question_export.go:97`、`service/position_export.go:33`、`service/scenario_export.go:33`、`service/resource_export.go:163`、`handler/granular_course_export_handler.go:52`、`handler/exam_export_handler.go:53` —— 循环内逐条查名称/关联。
- 汇聚类：`service/job_ability_aggregator.go:425`（逐学生 FetchRecommendPositions）。
- 前端逐条/全量：`scene/scenarios/[id]/edit/tasks/page.tsx`（逐任务 listMethods/upsert/保存）、`job/landing/*` 与 `job/learn-roads`（逐场景 taskApi.list）、`alliance` 各列表页（fetchAllPages 全表拉取 + 逐行 listMilestones/关联 update）、`portal/apps/system/logs`（fetchAllPages 全表）、`evaluation/approvals`（逐条 review）、`components/job/student/job-home.tsx`、`components/evaluation-rules/bank-question-selector-panel.tsx`、`components/providers/data-provider.tsx`（逐题 update）。
- 最佳实践：批量 `IN($N)` / JOIN 一次取回 → 内存 map 回填；前端提供批量端点或 `fetchAllPages` 加 `maxPages` 上限；审批/关联写用批量端点。
- **遗留理由**：均为非核心读写路径（导出/批量/审批/编辑页），数据量有界时不影响核心接口流畅；逐个改造牵涉前后端批量端点新增，属较大工程。

#### C. 分页钳制导致的静默截断（limit 1000 → 后端钳 200）

- `hooks/use-org-tree.ts:61`、`hooks/use-portal-users.ts:59`、`lesson/admin/*`（archive/approvals/system-add/hybrid 原子模块）、`portal/workspace/_components/hybrid-grading-dialog.tsx:94`、`evaluation/scene-results/page.tsx:274`、`alliance/enterprises/page.tsx:66`、`job/positions/[id]/edit/page.tsx:74`。
- 最佳实践：改用 `fetchAllPages` 分页合并，或后端下推搜索/返回 name 字段。
- **遗留理由**：属 UX 边界（超 200 条时名称回退显示 id），非安全/正确性硬伤；仓库已有 `fetchAllPages` 范式可渐进替换。

#### D. 前端竞态/清理（旧响应覆盖新结果、卸载后 setState、SSE 取消误删消息）

- `portal/apps/ai/chat/page.tsx:151`（取消后误删新消息 + 双流）、`portal/apps/ai/agents/[id]/page.tsx:110`（会话切换竞态）、`packages/api-client/src/api/ai-center.ts:366`（SSE error 后不终止、尾块丢失）、`scene/landing/[id]/page.tsx:395/446`（快照/live 竞态 + 全量拉取）、`evaluation/landing/exams/[id]/page.tsx:119/139`（开考前快照提前拉取）、`theme-brand-sync.tsx:25`、`use-ai-assist.ts:66/167`、`alliance/enterprises/page.tsx:98`、`system/org-user/roles/page.tsx:226`、`superadmin/page.tsx:514`、`scene/scenarios/[id]/edit/tasks/page.tsx:1540`（reorder 无防抖）等约 20 处。
- 最佳实践：`let cancelled=false` / 请求序号 ref / `AbortController`；SSE 解析器收到 `error` 后置终止标志；`isAbortError` 区分取消。
- **遗留理由**：多属「用户体验抖动」而非数据损坏（后端为真实边界）；逐个加守卫工作量大，属渐进治理项。

#### E. 其他

- `service/community.go:99` ListReplies 无 LIMIT（社区回复无限增长）——建议补分页，遗留（社区为轻量非核心）。
- `store/query.go:621`/`scenario_import_export.go:210` 循环逐名称/逐 id 查（导入导出场景，数据量有界）。
- `store/learn_roads.go:25`/`job_ability_results.go:150`/`alliance_*_store.go` 等 ILIKE 搜索未转义 `%/_`（参数化无注入，仅匹配面放大）——建议统一 `escapeLike`，遗留（低危）。
- `store/scenario_configs.go:225` 动态表名未走白名单（当前仅硬编码字面量调用，无注入面）——建议补白名单，遗留（潜在风险点）。
- `handler/exam_import_handler.go:34`/`granular_course_import_handler.go:33`/`course_import_handler` 等 Excel 导入未设 `http.MaxBytesReader`（可上传超大 multipart 撑爆磁盘/内存）——**建议补 30MB 上限**，遗留（需核对 multipart 各调用点）。
- `handler/evaluation_result_handler.go:276` BatchGrade 无 items 上限——建议钳制 ≤200，遗留。
- `service/evaluation_result.go:55` SubmitExamResult 检查与写入分离（TOCTOU）——已有 `(usage, user)` 唯一约束兜底，遗留（唯一索引即锁）。
- `service/position_import.go:174` 关联写入错误 `_=` 静默丢弃——建议计入 Failed/Errors，遗留。
- `service/granular_course_import.go:35` 覆盖导入未包事务（先删后插非原子）——建议 `WithTx`，遗留。
- `service/lesson_content.go:135`/`scenario.go` CloneCourse 源租户 nil 放行（与 position_clone 不一致）——建议对齐，遗留（低危）。
- `store/workflows.go:30` 全局流程（tenant_id NULL）CRUD 不对称（Create 可成功但后续 Get 报 500 孤儿）——建议签名改 `*string`，遗留（需 spec 明确全局流程语义）。
- `router/router_dup_test.go:23` 重复注册测试失效（每 Group 新建 seen map）——建议共享 map，遗留（测试改进项）。
- `handler/stats_handler.go:9` MyStats 硬编码 0 占位桩——建议未实现则不注册，遗留。
- `handler/position_handler.go:536`/`program_course_import_handler.go:133`/`service/ai_center_kb.go:27` 死代码——建议删除，遗留（无害）。
- 前端 `evaluation-rules-editor.tsx:3224` 只读共建模式「保存评价标准」按钮未隐藏——建议 `!readOnly` 门控，遗留（中危，需前端确认交互）。
- ~~前端 `resource-preview-modal.tsx:33` link 资源外链直通 kkfileview 代理（SSRF/内网探测面）~~ **已修复**：kkfileview 服务端代理改为仅服务本系统 `/uploads/` 文件，外链/第三方 URL 不再交由服务端抓取（非 file-viewer 支持格式引导新窗口打开）。
- `packages/api-client/src/api-helpers.ts:270` authedFetch 无 timeout/signal——建议对齐 40s `AbortSignal.timeout`，遗留。
- `packages/ui/src/components/ui/chart.tsx:77` id/color 未转义插入 `<style>`——建议白名单校验，遗留（当前调用方传硬编码 id）。

---

## 4. 第四部分：测试/部署工具审查（Q4）

### 4.1 工具清单与结论

| 工具 | 覆盖 | 结论 |
|---|---|---|
| `deploy.sh` | 分支隔离 worktree、源码 hash 增量构建、DB baseline/增量 migration、部署锁串行、回滚、离线安装 | **完善**；质量门禁为 `--gates` 可选（CI 覆盖），已修 AGENTS.md 口径 |
| `scripts/spec-check.sh` | 分层红线 / AI 底座 / migration 配对 / spec 五层 / ADR 索引 / 安全红线 / schema↔migration / 表数 / 机器码 / 路由契约 / 流程一致性 | **完善**（12 项检查，阻断+提示两级） |
| `scripts/ui-smoke/` | 全站点击巡检（CRUD/弹窗/Tab）+ `--flows` 业务链路 + 危险词护栏 + SMOKE_ 数据清理 + 报告/基线/断点续跑 | **完善**（超出常规仓库） |
| `scripts/package-release.sh` | 离线无源码实施包 | 完善 |
| `scripts/migrate_uploads.sh` | 存量上传文件按租户归置 | 完善（幂等） |
| `.github/workflows/ci.yml` | 前端 typecheck/lint/test/format + 后端 gofmt/vet/build/test（DB 容器）+ spec-check | 完善 |

### 4.2 工具缺陷（已修复）

- `backend/cmd/migrate/main.go` `splitSQLStatements` dollar-quote 关闭索引回退 bug（见 §3.2 #11）：影响未来所有含 `$` 块的迁移，migrate up 会失败（deploy.sh 有 psql 逐文件兜底不损坏数据，但仍需修）。

---

## 5. 第五部分：明确遗留（需用户决策 / 隐患较大）

1. ~~**前端 `evaluation/scene-results`（列表 + `[id]` 详情）无权限门禁**~~ **核实后为误报，非缺陷**：后端已完整兜住——`evaluationResultHandler.List` 对学生强制 `evaluateeId=本人 + ownOnly`、`Get` 校验 `EvaluateeID==本人` 否则 404（学生看不到全班/他人成绩）；快照接口对学生 `StripStudentAnswers` 删除 answer/analysis（学生拿不到参考答案与正确选项）。「学生查自己结果」属产品预期（已与用户确认），无需前端门禁。
2. ~~**`resource-preview-modal` link 资源外链直通 kkfileview 代理（SSRF）**~~ **已修复（最简方案）**：`resource-preview-modal.tsx` 中 kkfileview 服务端代理仅服务本系统 `/uploads/` 上传文件，外链不再进入 kkfileview 抓取路径，SSRF 面关闭。
3. **JWT 存 localStorage 的 XSS 会话接管面**：`security-standards.md` §2 已有「不迁移 HttpOnly cookie」的明确评估结论，属**已接受风险**，不复议。
4. **§3.3-A 的约 30 处租户纵深防御缺口**：handler 均已校验、无真实越权，属 ADR-0003「可选限定」；若未来希望「SQL 层全量限定」，需专项批量改造 + 补测试。

---

## 6. 已修复文件清单

| 文件 | 修复内容 |
|---|---|
| `backend/internal/handler/auth_handler.go` | `/auth/me` 清空 Oauth |
| `backend/internal/store/exams.go` | 删题补租户条件 + RowsAffected 校验 |
| `backend/internal/store/exam_usages.go` | SetStatus 补租户条件（签名加 tenantID） |
| `backend/internal/service/evaluation_exam.go` | SetExamUsageStatus 透传 tenantID |
| `backend/internal/handler/exam_usage_handler.go` | 调用处透传 tenantID |
| `backend/internal/store/snapshot_stamping_test.go` | 测试调用点同步签名 |
| `backend/internal/store/alliance_employment_store.go` | 投递 INSERT 补 `u.tenant_id = j.tenant_id` |
| `backend/internal/handler/tenant_handler.go` | 非平台管理员剥离有效期字段 |
| `backend/internal/handler/alliance_handler.go` | ListPublicExperts includeNonPublic 收紧为本校管理角色 |
| `backend/internal/router/routes_partner.go` | `/partner/experts/{id}` 移入 adminOnly |
| `backend/internal/service/ai_center_agent.go` | AgentChat/KBAsk 412 预检修正 |
| `backend/internal/service/ai_center_v22.go` | YIKnowChat 412 预检修正 |
| `backend/internal/middleware/oplog_buffer.go` | flush 独立 recover，循环自愈 |
| `backend/internal/router/routes.go` | 删除 SaaS 超管组重复 OperationLog |
| `backend/cmd/migrate/main.go` | splitSQLStatements dollar-quote 关闭索引 bug |
| `apps/edu/components/shared/resource-preview-modal.tsx` | kkfileview 代理仅服务本系统 /uploads 文件，关闭外链 SSRF |
| `docs/spec/06-acceptance-flows.md` | 修复两处重复 YAML 键 |
| `docs/spec/02-api-contract.md` | 登记 /ai/yiknow/* 路由 |
| `docs/spec/ai-service-center.md` | 登记 /ai/yiknow/* 路由 + 鉴权矩阵 |
| `AGENTS.md` | §4.1 deploy.sh 门禁口径修正 |

---

## 7. 校验结果

- `cd backend && go build ./...` ✅ 通过
- `cd backend && go vet ./...` ✅ 通过
- `./scripts/spec-check.sh` ✅ 硬约束全通过（路由契约、验收流程 YAML 已修复，仅剩 2 处 dangerouslySetInnerHTML 误报提示）
