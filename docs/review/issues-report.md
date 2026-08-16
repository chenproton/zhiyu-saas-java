# 知与 SaaS 代码审查 —— 遗留问题清单

> 全量审查基线：2026-08-16，24 个并行子代理逐文件逐行读完全部自有源码（后端 489 .go + 前端 617 .ts/.tsx，约 27 万行），文件逐项勾选见 [`file-inventory.md`](file-inventory.md)。
> 本清单为**四轮修复后仍遗留**的问题；已修复项已从清单移除，修复历史见 git 提交：
> `d70f8726`（一轮安全/租户）→ `ef6d00a1`（UI 巡查）→ `72e33c77`（二轮遗留：关键写租户 + 明确 bug + 前端项 + 工具名单）→ `4fa54ad7` + `033fe711`（三轮：workflows 强制租户 + 菜单权限 fail-closed + SSE 解析器重写）。
> 分级沿用 AGENTS.md 五项原则「简单优先 / 安全只排高危 / 性能稳定性优先 / 容忍 hacker / 锁只给核心业务」。

## 遗留问题总览

| # | 类别 | 数量级 | 严重度 | 处置倾向 |
|---|---|---|---|---|
| 1 | 租户隔离纵深防御缺口（SQL 层缺 tenant_id） | ~20 处 | 低（handler 已兜底） | 用户已决「保持现状」 |
| 2 | N+1 / 全量拉取（非核心路径） | 若干 | 低（非核心允许等待） | 用户已决「保持现状」 |
| 3 | 分页钳制静默截断 | ~7 处 | 低（UX 边界） | 用户已决「保持现状」 |
| 4 | 前端竞态/清理 | ~20 处 | 低（UX 抖动） | 用户已决「保持现状」 |
| 5 | 其他低危 / 工具项 | ~15 项 | 低 | 未逐项决策 |
| 6 | UI 巡查遗留（题库页超时） | 1 处 | 低（非核心性能） | 未决策 |
| 7 | 已接受风险（非缺陷） | 2 项 | — | 记录不修 |

---

## 1. 租户隔离纵深防御缺口（handler 已校验，SQL 层缺 tenant_id）

按 ADR-0003「handler 校验为主、SQL 层可选限定」属有意取舍；仅当「未来新增调用点漏校验」时才构成 IDOR。第三轮已修 6 组关键写（`content_actions` 状态机 / `exam_results` 改分 / `evaluation_results` 改分 / `appeal` 处理 / `exam_questions` 同步 / `staff_titles` 启停），以下为其余未补 SQL 租户条件的写操作：

- `store/scenarios.go` Update/Delete、`store/positions.go` Update/Delete 级联
- `store/position_bindings.go` / `position_certificates.go` / `position_clone.go` / `course_clone.go`
- `store/alliance_source_edit_store.go`、`store/organizations.go`、`store/resource_bindings.go`
- DictStore 基类：`industries.go` / `majors.go` / `org_types.go` / `on_site_question_library.go` / `resource_codes.go`
- `store/roles.go` / `subscriptions.go` / `tenant_admins.go` / `scheduling.go`（审批 ReviewStep 状态写）
- 导入导出：`scenario_import_export.go` / `question_import_export.go` / `resource_import_export.go` / `imports.go` / `student_portraits.go`

**最佳实践**：写操作签名补 `tenantID`，WHERE 补 `AND tenant_id=$N`（参考已对齐的 `exams.go` / `exam_usages.go` / `content_actions.go`）。
**遗留理由**：① handler 均已 `verifyTenantOwnership`/`CheckOwnership` 兜底，无真实越权路径；② 批量改签名牵动数十调用点与测试，风险收益不成比例；③ ADR-0003 明示「可选限定」。

---

## 2. N+1 / 全量拉取（非核心路径，允许等待）

- 导出类（10min 长超时，非核心）：`service/course_export.go` / `question_export.go` / `position_export.go` / `scenario_export.go` / `resource_export.go` / `handler/granular_course_export_handler.go` / `handler/exam_export_handler.go` —— 循环内逐条查名称/关联。
- 汇聚类：`service/job_ability_aggregator.go`（逐学生 FetchRecommendPositions）。
- 前端逐条/全量：`scene/scenarios/[id]/edit/tasks/page.tsx`、`job/landing/*` 与 `job/learn-roads`、`alliance` 各列表页、`portal/apps/system/logs`、`evaluation/approvals`、`components/job/student/job-home.tsx`、`bank-question-selector-panel.tsx`、`data-provider.tsx`。

**最佳实践**：批量 `IN($N)` / JOIN 一次取回 → 内存 map 回填；前端批量端点或 `fetchAllPages` 加 `maxPages` 上限。

---

## 3. 分页钳制静默截断（limit 1000 → 后端钳 200）

- `hooks/use-org-tree.ts` / `use-portal-users.ts`、`lesson/admin/*`（archive/approvals/system-add/hybrid 原子模块）、`portal/workspace/_components/hybrid-grading-dialog.tsx`、`evaluation/scene-results/page.tsx`、`alliance/enterprises/page.tsx`、`job/positions/[id]/edit/page.tsx`。
- 属 UX 边界（超 200 条时名称回退显示 id），非安全/正确性硬伤；仓库已有 `fetchAllPages` 范式可渐进替换。

---

## 4. 前端竞态/清理（旧响应覆盖新结果、卸载后 setState 等）

> 用户已决策：本类保持现状不改。

- `portal/apps/ai/chat/page.tsx`（取消后误删新消息 + 双流）、`portal/apps/ai/agents/[id]/page.tsx`（会话切换竞态）、`scene/landing/[id]/page.tsx`（快照/live 竞态 + 全量拉取）、`evaluation/landing/exams/[id]/page.tsx`（开考前快照提前拉取）、`theme-brand-sync.tsx`、`use-ai-assist.ts`、`alliance/enterprises/page.tsx`、`system/org-user/roles/page.tsx`、`superadmin/page.tsx`、`scene/scenarios/[id]/edit/tasks/page.tsx`（reorder 无防抖）等约 20 处。
- **最佳实践**：`let cancelled=false` / 请求序号 ref / `AbortController` / `isAbortError` 区分取消。
- **遗留理由**：多属「用户体验抖动」而非数据损坏（后端为真实边界）。

---

## 5. 其他低危 / 工具项

- `service/community.go` ListReplies 无 LIMIT（社区回复无限增长）——建议补分页。
- `store/query.go` / `scenario_import_export.go` 循环逐名称/逐 id 查（导入导出场景，数据量有界）。
- ILIKE 搜索未转义 `%/_`（`learn_roads.go` / `job_ability_results.go` / `alliance_*_store.go`）——参数化无注入，仅匹配面放大；建议统一 `escapeLike`。
- `store/scenario_configs.go` 动态表名未走白名单（当前仅硬编码字面量，无注入面）。
- Excel 导入未设 `http.MaxBytesReader`（`exam_import_handler.go` / `granular_course_import_handler.go` / `course_import_handler`）——建议补总量上限（需核对各端点既有 `ParseMultipartForm` 50MB/200MB 口径）。
- `service/evaluation_result.go` SubmitExamResult 检查与写入分离（TOCTOU）——已有 `(usage,user)` 唯一约束兜底。
- `service/position_import.go` 关联写入错误 `_=` 静默丢弃——建议计入 Failed/Errors。
- `service/granular_course_import.go` 覆盖导入未包事务（先删后插非原子）——建议 `WithTx`。
- `service/lesson_content.go` / `scenario.go` CloneCourse 源租户 nil 放行（与 position_clone 不一致）。
- `router/router_dup_test.go` 重复注册测试失效（每 Group 新建 seen map）——建议共享 map。
- `packages/api-client/src/api-helpers.ts` authedFetch 无 timeout/signal——建议对齐 40s `AbortSignal.timeout`（需核对大文件上传/下载调用点）。
- `packages/ui/src/components/ui/chart.tsx` id/color 未转义插入 `<style>`——建议白名单校验（当前调用方传硬编码 id）。

---

## 6. UI 巡查遗留

- `/evaluation/question-banks/{1013题题库}`：单路由超时 >180s、0 次点击（全量 `fetchAllPages` 拉取 1013 题 + 渲染超长表格 + `collectClickables` 遍历慢）——需服务端分页 / 虚拟滚动，属「非核心允许等待」。

---

## 7. 已接受风险（非缺陷，记录不修）

- JWT 存 localStorage 的 XSS 会话接管面：`docs/security-standards.md` §2 已有「不迁移 HttpOnly cookie」评估结论，属已接受风险。
- `dangerouslySetInnerHTML` 两处（`app/layout.tsx`、`packages/ui/chart.tsx`）：均为硬编码常量，非用户/LLM 内容，spec-check 提示为误报。
