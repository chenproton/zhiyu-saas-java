# 评价/考核平台审计

## 核心决策

- **题库**：`QuestionBankHandler` 实现完整内容生命周期。支持 6 种题目类型：单选、多选、判断、填空、问答、简答。
- **题目管理**：`QuestionHandler` 实现 CRUD + 批量创建。选项和答案以 JSON 存储。
- **试卷**：题目通过 `exam_questions` 反范式存储（添加时复制快照），`total_score` 自动计算。
- **考试使用**：`ExamUsageHandler` 管理考试场次，状态流转 `draft → in_progress → finished`。
- **自动评分**：单选/判断字符串匹配；多选集合匹配；填空/问答/简答返回 `false`（需人工批改）。及格线 60%。支持重复提交覆盖。
- **场景评价**：`scene_evaluation_results` 支持单条和批量评分。
- **认证规则**：规则 → 能力项 → 能力点三级结构，`GetFullRule` 返回完整嵌套。
- **评价方法**：`EvaluationMethodHandler` 管理评价方法目录。分类（`evaluation_method_categories`）为全局共享，方法（`evaluation_methods`）按租户隔离，支持按分类筛选和启用/禁用切换。
- **毕业设计**：全生命周期（选题 → 档案 → 评价 → 查询），删除时级联清理。
- **学生画像**：领域得分、排名、毕业资格、出勤率、徽章。支持画像档案管理（`ListArchives`/`CreateArchive`），按学生维度归档历史画像。
- **微证书**：模板管理 + 批量发放，唯一证书编号，删除级联。支持发放历史查询（`ListHistory`）。
- **申诉管理**：CRUD + 处理，`pending → approved/rejected`。
- **岗位能力评价**：`job_ability_results` 能力达成率计算。
- **学生端落地页**：`LandingHandler` 提供无需登录的考试列表（`GET /evaluation/landing/exams`）；`CertGradeHandler` 提供认证等级查询（`GET /evaluation/landing/certifications/{id}/grades`）。
- **评价批次**：`EvaluationBatchHandler` 继承通用 `BatchHandler`，实现评测批次（`evaluation_batches`）的 CRUD。配置驱动租户隔离（`TenantScoped: true`）。
- **考试成绩**：`ExamResultHandler` 管理考试结果提交与查询。提交答案后自动评分（单选/多选/判断自动评分，填空/问答需人工批改），使用 UPSERT 保证幂等性，支持重复提交覆盖。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 题库 CRUD | PASS | 内容生命周期；知识点关联 |
| 题目管理 | PASS | 6 种题型；批量创建 |
| 试卷组卷 | PASS | 反范式快照；total_score 自动计算 |
| 考试场次 | PASS | 时间窗口管理；draft→in_progress→finished |
| 自动评分 | PASS | 单选/多选/判断自动评分；及格线 60% |
| 场景评价 | PASS | 单条/批量评分；JSON 多维数据 |
| 认证规则 | PASS | 三级结构；GetFullRule 嵌套返回 |
| 评价方法 | PASS | 全局分类 + 租户隔离方法；按分类筛选；启用/禁用切换 |
| 毕业设计 | PASS | 全生命周期；容量控制；级联删除 |
| 学生画像 | PASS | 默认画像生成；档案管理（归档/列表） |
| 微证书 | PASS | 批量发放；唯一编号；级联删除；发放历史查询 |
| 申诉管理 | PASS | CRUD + 处理 |
| 岗位能力评价 | PASS | 能力达成率计算 |
| 学生端落地页 | PASS | 考试列表 + 认证等级查询；无需登录 |
| 评价批次 | PASS | 继承通用 BatchHandler；配置驱动租户隔离 |
| 考试成绩 | PASS | 自动评分；UPSERT 幂等性；支持重复提交覆盖 |

## 风险与约束

- **申诉 remark 已持久化但不在 API 响应中返回**：`appeal_handler.go` 的 `Process` 接口解析了 `remark` 字段且已写入 SQL UPDATE（`remark = $2`），但 `AppealRecord` 结构体和 `fetchAppeal` 的 SELECT 未包含 `remark` 字段，导致 API 响应中不返回 remark。—— **低风险，按需修复。**
- **毕业选题无竞争保护**：`ApplyTopic` 仅递增 `applied_count`，无事务级容量检查，并发申请可能超出容量。—— **核心业务防重复，建议加乐观锁。**
