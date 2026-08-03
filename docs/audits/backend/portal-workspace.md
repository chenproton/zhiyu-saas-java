# Portal 工作台审计

## 核心决策

- **统一入口**：`PortalHandler.WorkspaceDashboard` 为教师/学生/管理员提供统一的工作台数据视图，通过 `role` 查询参数区分角色。
- **教师工作台**：
  - 公告（`announcements`，按角色过滤，租户隔离，最多 10 条）。
  - 待办（`todos`）：待审批数（`approval_records`）+ 草稿课程数（`draft` 状态）。
  - 日程（`schedule`）：已发布课程 + 即将开始的考试（`exam_usages`），按时间排序。
  - 统计（`stats`）：课程数量 + 唯一学生数（从 `lesson_behavior_records` 去重计算）。
  - 课程列表：已发布课程（含学生数、出勤率进度）。
- **学生工作台**：
  - 公告（同上）。
  - 待办：即将开始的已发布考试场次。
  - 日程：已发布课程 + 考试时间表。
  - 统计：可用课程数 + 待考考试数。
  - 课程列表：已发布课程（含课时/学分/进度计算）。
  - 场景任务：已发布场景任务（含完成状态：未开始/进行中/已完成）。
  - 考试列表：已发布/进行中/已完成的考试（含 LEFT JOIN 查成绩）。
- **数据聚合逻辑**：
  - 课程进度 = 出勤次数 / 总行为记录数 × 100%，来自 `lesson_behavior_records`。
  - 场景任务状态 = 查询最新 `scene_evaluation_results`，分"未开始"/"进行中"/"已完成"。
  - 学分 = 总课时 / 16。
- **角色判定**：前端传 `role` 参数，后端不强制校验角色权限，允许角色切换查看不同视图。
- **短周期缓存**：`/portal/workspace/dashboard` 挂 30 秒 Redis 缓存（`cache.DashboardKey`，键按租户+用户隔离，防跨用户串数据）；管理员视图内部以 `goAsync` 并行聚合 5 路统计，教师/学生视图并行 4~6 路。
- **核心查询索引**：排课（`schedule_entries` 租户前缀教师/班级 + `class_node_ids` GIN）与待办计数（`approval_records(status, tenant_id)`）已由 migration `118_workspace_indexes` 覆盖。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 教师工作台 | PASS | 公告/待办/日程/统计/课程全景覆盖 |
| 学生工作台 | PASS | 公告/待办/日程/统计/课程/场景/考试全景覆盖 |
| 租户隔离 | PASS | 所有查询通过 `tenantFilter()` 绑定当前租户 |
| 课程进度计算 | PASS | 来自 `lesson_behavior_records` 实时出勤率 |
| 场景任务状态 | PASS | 查询最新 `scene_evaluation_results` |
| 学分计算 | PASS | 总课时 / 16 |
| 角色切换 | PASS | 支持前端传 `role` 动态切换视图 |

## 性能约束

- 工作台单请求仍包含多次 DB 查询（4~6 路并行），但已被 30 秒缓存 + 核心索引覆盖，P99 压力显著缓解。—— **已优化（2026-08-03 确认：缓存 + 索引迁移 118），若后续用户量增长可再评估查询合并与预计算，方案见 `performance-maintainability.md#一`。**

## 风险与约束

- 无明显高风险项，模块设计简洁合理。
