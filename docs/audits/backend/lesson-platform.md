# 课程/教学平台审计

## 核心决策

- **课程类型**：体系课（`system`，节点树组织）、颗粒课（`granular`，知识点为核心）、混合课（`hybrid`，模块化组织）。
- **课程 CRUD**：`CourseHandler` 实现完整内容生命周期管理，通过 `contentActions` 支持状态流转。视图计数通过 `view_logs` 动态计算。
- **课程节点树**：`system_course_nodes` 通过 `parent_id` 实现层级树。节点关联知识点和资源通过独立绑定表（`node_knowledge_point_bindings`、`node_resource_bindings`）。支持 `Reorder` 接口在事务内批量更新排序。
- **知识点管理**：`knowledge_points` 支持关联标记和颗粒课关联。
- **测验系统**：节点级测验（`node_quizzes`）+ 题目管理（`node_quiz_questions`），删除时级联清理。
- **作业系统**：`node_homeworks` 支持附件要求和截止时间。
- **混合课模块**：`hybrid_node_modules` 支持 pre/in/post class 模块配置。
- **课堂行为采集**：`lesson_behavior_records` 记录出勤、测验、互动等行为，支持聚合查询。
- **批量管理**：`CourseBatchHandler` 封装通用 `batch_handler`。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 课程 CRUD | PASS | 完整 CRUD；三种课程类型；租户隔离 |
| 内容状态机 | PASS | 完整状态流转 |
| 课程节点树 | PASS | CRUD + 排序；绑定表管理知识点和资源 |
| 知识点管理 | PASS | CRUD；支持关联标记 |
| 测验系统 | PASS | 测验 CRUD + 题目管理；删除级联清理 |
| 作业系统 | PASS | 附件要求和截止时间 |
| 混合课模块 | PASS | pre/in/post class 模块配置 |
| 课堂行为 | PASS | 出勤、测验、互动等行为记录；聚合查询 |
| 批量管理 | PASS | 封装通用 batch handler |

## 风险与约束

- 无明显高风险项，模块设计简洁合理。
