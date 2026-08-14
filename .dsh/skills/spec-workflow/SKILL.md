---
name: spec-workflow
description: 知与 SaaS 的 spec-first 开发模式执行手册：任务分诊、七节点闭环（对齐意图→明确需求→制定方案→拆解任务→实现→校验→收敛）、DoD 验收清单、spec-check.sh 门禁、分支隔离与部署流程。任何涉及本仓库代码的开发任务，开始前加载本技能。
whenToUse: 接到「新增功能 / 修复 bug / 重构 / 变更行为」任务时；开始写代码前；跑 spec 校验或部署前。
---

# 知与 SaaS Spec 开发执行手册

> 本技能是 `AGENTS.md` 开发契约 + `docs/spec-standards.md` 的可执行浓缩版。原则冲突时以 AGENTS.md 与 docs 原文为准。
> 三条铁律先背下来：① 禁止覆盖/还原他人代码；② 禁止破坏安全边界；③ 禁止破坏 handler/service/store 分层与 AI 统一底座。

## 1. 任务分诊（先判类型再动手）

| 类型 | 判定 | 流程 |
|---|---|---|
| 新功能 | 增加能力/模块/接口 | 走七节点闭环，spec 必须同步 |
| 修复 bug | 行为偏离 spec/合理预期 | 读 spec 定正确行为 → 先写复现测试（红）→ 修复（绿）→ 改行为才动 spec；纯修复不改 spec 但 commit 说明 → spec-check + 部署 |
| 重构 | 行为不变，只改结构 | 等价变换；改可观察行为就升级为新功能/修复；先按 `docs/simplification-notes.md` 给证据（调用点），区分「真简化」vs「有意为之」（查 ADR）；**不同步 spec**，commit 说明「行为不变」 |
| 纯文档 | 只动 AGENTS.md/docs/ | 直接 commit，无需 deploy |

第一步永远是 **read spec，不是 read 代码**：先 `read` 相关 `docs/spec/*.md` + `docs/decisions/`（ADR），确认现状与「扩展性预留」章节（明确写着「暂不做」的东西不许做）。

## 2. 七节点闭环（新功能全流程）

| # | 节点 | AI 动作 | 产物 | 红线 |
|---|---|---|---|---|
| 1 | 对齐意图 | 读 AGENTS.md + 相关 docs + ADR | 无新产物 | 不写代码 |
| 2 | 明确需求 | 澄清为「做什么/为什么」，**只谈 WHAT/WHY，不碰 HOW**（技术栈/表结构/代码组织一律后置） | spec 需求章节 | 不清楚用 ask_user_question 问用户 |
| 3 | 制定方案 | 需求 → 数据模型 / API 契约 / 测试场景；**每个技术选择记录理由并回链需求** | spec 架构/API/数据章节 | 选型需拍板时问用户；复用优先：先查 `docs/components.md`、`docs/forms-tables.md`、`docs/backend-reuse.md`、ADR |
| 4 | 拆解任务 | 生成可执行任务清单，标依赖与可并行项 `[P]` | todo_write 任务清单（可写入 spec 开发计划章节） | 依赖明确才能标 [P] |
| 5 | 实现 | 写代码 + 测试 + migration，**同时回写 spec**（spec-first 硬约束） | 代码 + 回写的 spec | 走分支隔离工作流；migration 必须配对 `.down.sql`；单次 commit 只含当次变更 |
| 6 | 校验 | `spec_check` 工具（硬约束）+ 语义自查：spec 说的有没有实现、代码做的有没有写进 spec、验收标准能否变成测试断言 | 校验报告 | 硬约束失败必须修复；语义用 `spec_analyze` 派子代理独立复查 |
| 7 | 收敛 | 对照 spec 评估，把「没做完/偏航/新增件」记回任务或 spec | 收敛记录 | 成为下轮输入 |

发现「spec 说的」与「代码做的」不一致时：**停下来向用户报告差异**，不要擅自判定谁对谁错。

## 3. 提交前必跑（硬约束）

```bash
cd backend && go vet ./... && go build ./... && gofmt -l .   # 后端
pnpm typecheck && pnpm lint && pnpm test                      # 前端
./scripts/spec-check.sh                                        # spec 硬约束（必须通过）
```

- 优先调用 `spec_check` 工具获得结构化结果（violations 阻断级 / hints 提示级），失败项必须修复后再提交。
- `spec_check.sh` 覆盖：分层红线（handler 无 SQL/db 调用、service 无拼 SQL、store 不读 HTTP/Claims）、AI 底座（handler/service 不绕过 AIService）、migration 配对、spec 五层制品、ADR 索引双向、ADR-0003 关键写租户条件、schema↔migrations 编号、表数、机器码词汇表；提示级：down 不可逆标注、XSS、路由↔契约、spec 随代码变更。
- 功能类 commit message 引用 spec 文件名/章节（如「见 docs/spec/02-api-contract.md §2」）；纯重构/纯修复加 `spec:nochange` 声明豁免。

## 4. DoD 验收清单（全部满足才算完成）

1. 代码实现 spec 所述能力，过 deploy.sh 质量门禁。
2. spec 已同步（新增能力写入、变更行为更新对应章节）。
3. 测试至少一种（handler/service/store 单测）。
4. API 变更同步 `02-api-contract.md` 或子平台 spec API 章节；migration 配对 `.down.sql` 且编号登记进 `04-database-schema.md` §5。
5. 没做 spec「扩展性预留」里写「暂不做」的东西；真做了要么补 spec 要么删代码。
6. 新建公共抽象前已查复用速查表 + ADR，并同步登记速查表；能复用而未复用的需在 commit 说明理由。

## 5. 写代码时的心法与红线

- **性能自检（温和）**：列表/批量/聚合——① 有没有循环内逐条 SQL（N+1）？② 有没有显式 LIMIT 或数据量有界论证？③ 新增 goroutine 有没有超时 + panic 兜底 + 去重？④ 外部 HTTP 有没有 timeout？
- **后端分层**：handler 禁 SQL/`db.*`/持 Pool；service 禁拼 SQL；store 禁读 HTTP 请求/Claims。
- **AI 底座**：LLM 一律经 `AIService`；错误映射 412 `ai_not_configured` / 502；api_key 永不回传、不落日志；流式经 `ai.Client.ChatCompletionStream`。
- **安全五问**（新端点写前自问）：① 跨租户读/写？② 密钥/密码回传或落日志？③ SQL 注入面？④ 上传文件会执行？⑤ 未鉴权/越权匿名路径？每个新端点必须做归属校验（`verifyTenantOwnership` / `CheckOwnership`），关键写操作 SQL 层补租户条件。
- **数据模型变更**：迁移号 = 当前最大 +1；up 不可逆须声明 `-- 不可逆：<原因>`；同次提交回写 `04-database-schema.md` §5 + §2 字段级定义 + 数据字典。

## 6. 分支隔离与部署

```bash
git worktree add -b feat/<agent>-<任务简述> /tmp/<agent> master && cd /tmp/<agent>
git add -A && git commit -m "feat: 任务描述" && git push -u origin <分支>
./deploy.sh --branch <分支名>    # 可选 --clean / --force / --skip-merge；全程实时看输出
cd / && git worktree remove /tmp/<agent>
```

deploy.sh 自动做：源码 hash 增量构建、质量门禁（gofmt/vet + typecheck/lint）、DB migration、部署锁串行。代码修改后必须 deploy 验证；纯文档改动直接 commit。

## 7. 与 Harness 工具的配合

| 节点 | 工具 |
|---|---|
| 2 需求澄清 | `ask_user_question`（每次只问一个关键决策） |
| 2/3 需求与方案 | `spec_scaffold`（新模块按 10 节模板生成 docs/spec/<slug>.md 骨架，防结构漂移） |
| 3/4 方案与任务 | `plan-mode`（大方案先 exit_plan_mode 给用户审）+ `todo_write` |
| 5 实现 | `bash`（构建/测试）、`edit`/`write` |
| 6/7 校验与收敛 | `spec_check`（机器硬约束）+ `spec_analyze`（子代理语义复查）+ `goal`（长任务跨轮驱动） |

- 长任务（多轮、多文件）：用 `create_goal` 建目标持续驱动，每轮对照 spec 汇报进度。
- 扫描/统计只覆盖自有代码，排除 `offline/`、符号链接 `apps/edu/public/image-editor`、`backend/vendor/`、`node_modules/`、`.next/`、`dist/`、`*.tsbuildinfo`、`logs/`。
