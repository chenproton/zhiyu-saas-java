# 非功能规范（性能 / 可观测 / 国际化 / 测试）

> 本文档聚合 AGENTS.md「二、开发原则」散点要求之外的**横向非功能规范**。与 security-standards.md 同口径：条目均为**当前已确定**的要求（已实施，或明确标注 `[不适用]`）；新增/变更要求随实现同步更新，不保留未落地的待办承诺。
> 本文档为 AGENTS.md「二、开发原则 · 性能自检」与「三、硬性架构约束 3.1 测试」的细则出处（3.1/3.2 红线全文见 [`architecture-constraints.md`](architecture-constraints.md)）。

## 1. 性能预算与 SLO

- **原则**：核心接口保流畅，非核心允许等待；代码形状简单优先（一行 JOIN 优于十行循环）。
- **硬性自查**（写列表/批量/聚合代码时自问，违者改）：
  1. 无循环内逐条 SQL（N+1）——批量用 `IN($N)` / `unnest` / JOIN；
  2. 列表/聚合查询有显式 LIMIT 或「数据量有界」论证；
  3. 新增后台任务/goroutine 有超时 + panic 兜底 + 去重；
  4. 新增外部 HTTP 调用有 timeout（现状：webhook 有超时）。
- **现状缓存档位**（`[已实施]`，新缓存按同档位选择）：
  - 2 分钟档：`/job/public/positions`、`/scene/scenarios`（公开列表）；
  - 30 秒档：`/portal/workspace/dashboard`（键含 userID+角色）。
- **慢查询治理**：新 SQL 避免全表扫描；常用筛选列建索引；EXPLAIN 过的不合理计划在数据访问层直接修正。

## 2. 可观测性

- 见 [`security-standards.md`](security-standards.md) §6（`/health`、`/health/ready`、`/metrics`、操作日志异步审计）——**唯一出处，不在本文档重复**。

## 3. 国际化（i18n）

- **机制**：前端 i18n 的 `translate(key, locale)`；中文即 key 原样直出（默认），英文走字典；占位符 `{n}` 插值。
- **要求**：
  1. 新增用户可见文案一律经 `translate()`（或既有 `t()` 包装），禁止新增硬编码中文字符串绕过翻译层；
  2. 新文案提交时同步补 `en` 字典条目；`zh` 保持 key 直出无需条目；
  3. 数字/日期格式化用前端统一工具函数，禁止散落 `toLocaleString` 样板。
- **现状边界**：`en` 字典为渐进覆盖（未覆盖 key 回退中文），不承诺全量翻译完成；新代码按上面三条走即可。

## 4. 测试策略

- **门禁组合**（deploy.sh / CI 强制）：后端 `./mvnw compile -q`；前端 `cd plus-ui && pnpm build:portal` + `cd plus-ui && pnpm build:admin`；另跑 `./scripts/spec-check.sh`（见 AGENTS.md 4.2）。
- **分层测试要求**（AGENTS.md 3.1）：新接口必须附带 controller/service/mapper 测试**至少一种**；测试要断言「目标回归」失败（code-review-checklist.md 四），不写复述实现的假断言。
- **必测清单**：
  1. 状态机流转（`allowedStatusTransitions`）——非法流转 409/400 断言；
  2. 越权路径——跨租户 403 断言（归属校验命中/未命中各一例）；
  3. migration——up/down 配对 + 不可逆声明（spec-check.sh 机械校验）。
- **前端**：纯逻辑函数（格式化/状态机/转换器）必须 vitest 单测；组件快照/端到端不做（AGENTS.md 五.3：不做端到端验证）。
