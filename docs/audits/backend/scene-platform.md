# 场景/实践平台审计

## 核心决策

- **场景 CRUD**：`ScenarioHandler` 实现完整内容生命周期管理，通过嵌入 `contentActions` 支持完整状态流转。关联岗位、行业、职业、批次。使用 `NullableString`/`NullableStringSlice` 区分"显式传 null"和"未传该字段"。
- **任务链管理**：任务（`scenario_tasks`）通过 `sort_order` 排序，`Reorder` 接口在事务内批量更新。支持依赖关系、引用标记、源场景引用。关联知识点/能力点/资源通过 JSON 数组字段存储。
- **评价配置**：三级结构——评价配置（按方法分组）→ 评价点（含满分、等级映射）→ 评审步骤（含主体类型、权重）。使用统一 upsert 模式。
- **任务资源绑定**：`task_resources` + `task_resource_bindings` 多对多关联。
- **权重配置**：`scenario_weight_configs` 按任务设置场景权重。
- **等级映射**：`scenario_grade_mappings` 定义 S/A/B/C 等级。
- **场景归档**：`scene_archives` 存储版本快照（JSONB）。
- **批量管理**：`SceneBatchHandler` 封装通用 `batch_handler`。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 场景 CRUD | PASS | 完整 CRUD；租户隔离；nullable 字段处理正确 |
| 内容状态机 | PASS | 完整状态流转；invite 使用 `co_builder_ids` |
| 任务链管理 | PASS | CRUD + 排序；支持依赖关系、知识/能力/资源关联 |
| 评价配置 | PASS | 三级结构（配置→评价点→评审步骤）；统一 upsert |
| 资源绑定 | PASS | 支持绑定/解绑 |
| 知识/能力绑定 | PASS | `TaskKnowledgeAbilityHandler` 支持绑定/解绑 |
| 权重配置 | PASS | 按任务设置场景权重 |
| 等级映射 | PASS | S/A/B/C 等级定义 |
| 批量管理 | PASS | 封装通用 batch handler |

## 风险与约束

- 无明显高风险项，模块设计简洁合理。
