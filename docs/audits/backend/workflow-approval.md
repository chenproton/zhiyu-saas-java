# 审批流引擎与审批中心审计

## 核心决策

- **审批流定义**：`workflows` 表存储审批流模板，包含 `steps`（JSONB 数组，每个步骤含 `label`、`approverIds`、`mode`）和 `major_ids` 过滤。
- **审批记录**：`approval_records` 表跟踪单次审批流程，含 `target_type`/`target_id`/`workflow_id`/`current_step_idx`/`history`（JSONB 审批历史数组）。
- **审批流程**：
  1. 内容提交审批时调用 `Create`，创建 `pending` 状态的审批记录，`current_step_idx = 0`。
  2. 审批人调用 `Review` 接口，接受 `approved` 或 `rejected`。
  3. **驳回**：审批记录设为 `rejected`，同步内容实体状态为 `rejected`。
  4. **通过**：`mode = "any"` 任一通过即完成步骤；`mode = "all"` 所有审批人通过才完成。最后一步通过则内容实体 `approved`；中间步骤则推进索引。
- **内容状态同步**：`syncEntityStatus` 通过 `entityTableMap` 映射目标类型到表名，同步更新实体状态。支持 5 种内容类型。
- **状态回退清理**：内容从 `pending` 回退时，`contentActions.transition` 自动删除对应的 `pending` 审批记录。
- **权限**：`Create`/`Review` 接口要求 `school_admin` 或 `teacher` 角色。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 审批流 CRUD | PASS | `WorkflowHandler` 实现完整 CRUD |
| 审批记录创建 | PASS | `ApprovalHandler.Create` 正确设置初始状态和步骤索引 |
| 审批步骤推进 | PASS | `Review` 正确处理 any/all 模式；步骤完成后自动推进 |
| 内容状态同步 | PASS | 最终审批通过/驳回时同步实体状态；支持 5 种内容类型 |
| 审批历史记录 | PASS | 每次审批操作追加到 `history` JSONB 数组 |
| 状态回退清理 | PASS | 内容从 `pending` 回退时自动删除对应审批记录 |
| 权限控制 | PASS | 审批接口要求 `school_admin` 或 `teacher` 角色 |

## 风险与约束

- 无明显高风险项，模块设计简洁合理。
