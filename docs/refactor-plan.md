# 代码质量收敛计划

> 基于 `2026-07-28` 全量代码审查，经过多轮修复后的最终状态。仅保留未完成项。

---

## 总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 组件抽象 | 8.5/10 | 10 个 Repository + LibraryPageShell + 4 个 UI 组件统一；3 个不当抽象已回退 |
| 代码结构 | 8.0/10 | router→handler→store 三层；withTx/sanitizeIdentifier/lookupIDByName/parseUploadedExcel 就绪 |
| 可迭代性 | 8.0/10 | getStatusConfig/ConfirmDialog/StatusBadge 全局统一；新页面可套 LibraryPageShell |
| 可读性 | 8.5/10 | 死代码清零；中英消息统一；slog 覆盖 20+ handler |

---

## 剩余未完成项

| # | 问题 | 成本 | 收益 | 说明 |
|---|------|------|------|------|
| B3 | api-client lesson-source 双类型导入 | 0.5天 | 中 | 删除废弃类型需同步更新 9 个前端文件（order→sortOrder, type→refType） |
| F1 | tasks/page.tsx 5646 行拆分 | 2-3天 | 高 | 必须拆但风险大，建议功能冻结期做 |
| F2 | ~485 处 any 渐进清理 | 分散 | 高 | 每次 PR 顺手改 10-20 个 |

---

## 不复修项

以下均经成本/收益评估后决定跳过：

| 项 | 原因 |
|---|------|
| B1 Certification Repository | 前端 0 消费者，等有人做认证前端时再做 |
| B2 KnowledgePoint Repository | 6 个事务+树结构，抽象风险高，现有代码正常 |
| F3 ContentListPage 泛型化 | 依赖 F1/F2 先完成 |
| F5 EmptyState 推广 | 80+ 处纯 cosmetic，不产生功能价值 |
| F6 Landing Shell 提取 | 仅 4 页面受益，等第 3 个 landing 出现再做 |
| F7 废弃类型迁移 | 与 F2 合并渐进迁移 |
| S1 @zhiyu/ui edu 代码迁出 | 无第二个 app，迁不迁没区别 |
| S2 api-helpers 拆分 | 内部重构零用户感知 |
| S3 evaluation-rules 运行时迁出 | 纯架构洁癖 |
| Graduation/Org/User/Position/Scenario/Course/Exam/QuestionBank/Question | 复杂业务实体，强行抽象收益<成本 |
| Institution/ResourceHandler | 占位 stub，无 SQL |
| deploy.sh 依赖检查/健康检查 | 极低优先级 |
