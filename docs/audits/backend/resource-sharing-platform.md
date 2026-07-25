# 资源共享平台审计

## 核心决策

- **商城资源交易**：`ResourceHandler` 管理可交易的教育资源（`resources` 表），覆盖岗位包、场景包、课程包、测评包、素材包五类。
  - 匿名/认证用户均可浏览 `published` 资源；运营管理员可查看全部资源。
  - 机构用户只能创建/修改/删除本机构资源；存在订单或授权记录时禁止删除，需改为下架。
  - 资源状态流：`draft` → `reviewing` → `pending_publish` / `rejected` → `published` → `offlined`。
  - 支持标签（专业、行业、适用层次、难度等级）、附件、封面、价格、版本、销量、浏览量统计。
- **租户资源库**：`ResourceLibraryHandler` 管理教育管理域的 `resource_library` 表，用于存储教学过程中沉淀的资源（URL/文件/元数据）。
  - 按 `tenant_id` 隔离，支持资源类型筛选、按上传者组织/专业筛选。
  - 返回上传者姓名、所属组织节点、所属专业，方便资源归属追溯。
- **现场问答库**：`OnSiteQuestionLibraryHandler` 管理 `on_site_question_library` 表，为场景任务中的现场问答/现场评审提供题库。
  - 按 `tenant_id` 隔离，支持题型、难度、知识点、标签筛选。
  - 题目文本、参考答案、分数、知识点关联、标签等完整 CRUD。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 商城资源 CRUD | PASS | 创建、更新、删除、详情、列表、浏览量自增 |
| 商城资源状态流 | PASS | draft / reviewing / pending_publish / rejected / published / offlined 流转 |
| 商城资源机构隔离 | PASS | 非管理员只能操作本机构资源；删除前检查订单/授权引用 |
| 商城资源标签与附件 | PASS | 支持专业/行业/层次/难度标签；附件与封面字段 |
| 租户资源库 CRUD | PASS | 创建、更新、删除、详情、列表、按类型/组织/专业筛选 |
| 租户资源库上传者信息 | PASS | LEFT JOIN 用户、组织、专业表回显上传者信息 |
| 现场问答库 CRUD | PASS | 创建、更新、删除、详情、列表、按题型/难度筛选 |
| 现场问答知识点与标签 | PASS | 支持知识点关联与标签 |
| 租户隔离 | PASS | `ResourceLibraryHandler` 与 `OnSiteQuestionLibraryHandler` 均强制 `tenant_id` |

## 风险与约束

- **商城资源删除依赖业务引用检查**：删除前检查 `orders` 和 `authorizations`，但这两张表可能数据量较大，频繁删除场景下建议加索引或软删除。
- **`ResourceHandler` 运营审核未使用通用内容状态机**：资源状态与 `content_actions.go` 中的 6 状态模型不同，需单独维护流转逻辑，未来可考虑收敛。
