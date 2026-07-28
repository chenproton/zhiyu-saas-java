# 代码质量收敛计划

> 基于 `2026-07-28` 全量代码审查，经过多轮修复后的最终状态。

---

## 总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 组件抽象 | 8.5/10 | 跨 app 重复已消除；10 个 Repository 覆盖核心实体；4 个通用 UI 组件通过 @zhiyu/ui 统一；TableRowActions 已组合 HoverActionBar |
| 代码结构 | 8.0/10 | router/api-client/store 已三层拆分；`withTx`/`sanitizeIdentifier`/`lookupIDByName` 基础设施就绪；parseUploadedExcel 已统一 |
| 可迭代性 | 8.0/10 | 核心架构稳定；`getStatusConfig()` 全局统一；ConfirmDialog/StatusBadge 统一；认证状态码/审批事务已修复 |
| 可读性 | 8.5/10 | 死代码/占位/alert/window.confirm 已清零；中英消息统一；slog 日志覆盖 10+ handler；超大文件仍影响阅读 |

---

## 剩余未完成项

以下为评估后确认值得修复但未在本轮执行的遗留项：

### 后端

| # | 问题 | 难度 | 收益 |
|---|------|------|------|
| B1 | Certification 认证规则 handler (549行) 含 23 处 SQL，有 14 个方法 — 可建 Repository | 中 | 中 |
| B2 | KnowledgePoint handler (293行) 含 6 个事务操作 — 树结构增删改 | 中 | 中 |
| B3 | api-client lesson-source.ts 双重类型导入 — 规范版与废弃版 SystemCourseNode 并存 | 中 | 中 |

### 前端

| # | 问题 | 难度 | 收益 |
|---|------|------|------|
| F1 | tasks/page.tsx 5646 行超大文件拆分 | 极高 | 高 |
| F2 | ~485 处 any 类型渐进清理 | 极高 | 高 |
| F3 | ContentListPage/BatchGroupPage/ApprovalListPage 泛型化 | 高 | 中 |
| F4 | Library 6 个 CRUD 页提取共享组件 | 中 | 中 |
| F5 | EmptyState 推广到 80+ 处 | 中 | 中 |
| F6 | Landing 详情/列表页 Shell 提取 | 中 | 中 |
| F7 | 废弃类型系统迁移 (job-source/lesson-source → 规范类型) | 高 | 中 |

### 共享包

| # | 问题 | 难度 | 收益 |
|---|------|------|------|
| S1 | @zhiyu/ui 含 edu 领域代码 (useImportFlow/usePlatformLinks/data-provider) — 有消费者，需渐进迁移 | 中 | 中 |
| S2 | api-helpers.ts 350 行杂糅 HTTP/认证/类型/重导出 — 应拆分为 http.ts/auth.ts | 中 | 中 |
| S3 | evaluation-rules.ts 含 uid()/clone() 等运行时函数 — 应迁入 utils 包 | 低 | 低 |

---

## 不复修项（成本/收益评估后跳过）

| 实体/问题 | 原因 |
|-----------|------|
| Graduation (620行) | 日期解析、手动 SQL、3 表事务删除 — 改动大收益小 |
| Org (468行) | 树结构 parent_id/children，不是简单 CRUD |
| User (1001行) | 33 处 SQL，密码哈希、多子表 — 改动大 |
| Institution/ResourceHandler | 全为占位 stub，无 SQL |
| Position/Scenario/Course/Exam/QuestionBank/Question | 500-1149+ 行，多子实体复杂业务 |
| deploy.sh 依赖检查、健康检查 URL | 极低优先级 |
| shared-types 3 种 User/Position 类型统一 | 需要跨前后端同步，成本高 |

---

## 架构目标 vs 当前状态

```
当前（已达成）:
├── packages/
│   ├── shared-types/     ← 类型包；certification.ts 重复 STATUS_CONFIG 已删
│   ├── api-client/       ← 按 domain 拆分；lesson-source 双导入待修
│   └── ui/               ← 通用 UI 组件；TableRowActions 已组合 HoverActionBar
├── apps/edu/
│   ├── shared/*          ← 页面级共享组件（22 个 edu 专属）
│   ├── platform-shell/   ← 已从 packages/ui 导入
│   ├── lib/converters/   ← 原 stores/ 已重命名
│   ├── lib/              ← 死代码已清理
│   └── app/library/resources/_components/  ← useResourceCrud + ResourceUploadZone
└── backend/
    └── internal/
        ├── store/         ← 10 个 Repository（Industry→Role 等核心实体）
        ├── handler/       ← handler 仅负责 HTTP 编排+参数校验
        └── domain/        ← ScenarioStatus 已别名化 ContentStatus
```

评分：前端 8.5 / 后端 8.0 / 共享包 7.5 / 综合 8.0+。核心架构已稳定，剩余均为渐进优化项。
