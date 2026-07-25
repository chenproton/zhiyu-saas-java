# 岗位/职业平台审计

## 核心决策

- **岗位 CRUD**：`PositionHandler`（1202 LOC）实现完整内容生命周期管理，通过嵌入 `contentActions` 支持 6 状态流转。
  - 两种列表模式：匿名模式（仅返回所有租户 `published` 岗位）、认证模式（租户隔离）。
  - `SaveFull` 接口在单事务内完成：岗位信息、专业绑定、职责、能力绑定、能力域、证书绑定的完整保存。
  - 能力点绑定采用"按名复用"策略；证书绑定采用"查找或创建"策略。
- **能力体系**：能力域 → 能力点 → 岗位能力绑定，三级结构。
- **证书管理**：`certificate_library` 租户级共享证书池 + 岗位证书绑定。
- **岗位推荐**：支持按专业推荐或全局推荐。
- **收藏系统**：`ToggleFavorite` 原子切换收藏状态。
- **学习路线**：`LearnRoadHandler` 实现 CRUD，路线包含名称、描述、关联岗位列表和有序步骤（JSON 数组），支持分页和搜索，租户隔离。
- **岗位横幅**：`JobBannerHandler` 实现 CRUD，横幅包含标题、图片、链接、排序、启用开关，支持按启用状态筛选，按 `sort_order` 排序，租户隔离。
- **批量导入/导出与克隆**：
  - `PositionImportHandler` 解析 Excel（`岗位基本信息`、`岗位职责`、`能力要求` 三个 sheet），按名称查找/创建行业、专业、证书、批次，批量生成岗位、职责与能力绑定。
  - `PositionExportHandler` 按 ID 列表导出岗位完整信息到 Excel，结构与导入模板一致。
  - `TemplateHandler.ServePositionTemplate` 生成带字典预填充的批量导入模板。
  - `PositionCloneHandler` 在事务内克隆岗位主记录，并级联克隆专业绑定、职责、能力绑定、能力域、证书绑定，新岗位状态重置为 `draft`。
- **辅助模块**：能力点 CRUD、岗位职责 CRUD、能力域 CRUD、证书库 CRUD、批量管理。
- **视图计数**：通过 `view_logs` 动态计算。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 岗位 CRUD | PASS | 完整 CRUD + 两种列表模式；租户隔离 |
| SaveFull 复合保存 | PASS | 单事务内保存岗位 + 专业 + 职责 + 能力绑定 + 能力域 + 证书 |
| 能力体系 | PASS | 三级结构；按名复用策略 |
| 证书库 | PASS | 共享证书池；查找或创建绑定 |
| 内容状态机 | PASS | 完整 6 状态流转 |
| 岗位推荐 | PASS | 支持专业推荐和全局推荐 |
| 收藏系统 | PASS | 原子切换；返回收藏状态和计数 |
| 学习路线 | PASS | CRUD；关联岗位列表；有序步骤 JSON 数组；租户隔离 |
| 岗位横幅 | PASS | CRUD；排序；启用开关；租户隔离 |
| 批量管理 | PASS | 封装通用 batch handler |
| Excel 批量导入 | PASS | `PositionImportHandler` 解析多 sheet 并生成岗位、职责、能力绑定 |
| Excel 导出 | PASS | `PositionExportHandler` 按 ID 导出完整岗位数据 |
| 导入模板下载 | PASS | `TemplateHandler.ServePositionTemplate` 生成带字典的模板 |
| 岗位克隆 | PASS | `PositionCloneHandler` 事务级联克隆岗位及关联数据 |
| 浏览量 | PASS | `view_logs` 动态计算 |

## 风险与约束

- **SaveFull 大事务**：单事务涉及 5+ 张表的写操作，大量并发时可能影响性能。—— **核心业务，建议在 SaveFull 处关注并发，必要时加锁。**
- **匿名列表无租户隔离**：匿名模式下返回所有租户的 `published` 岗位，可能泄露跨租户数据分布信息。—— **按需评估是否需要收紧。**
- **Excel 导入非事务整体回滚**：`PositionImportHandler` 逐行写入，遇到错误继续处理剩余行，部分成功数据会保留。—— **当前返回成功/失败统计，符合批量导入惯例；若需强一致性，建议整体事务包裹。**
