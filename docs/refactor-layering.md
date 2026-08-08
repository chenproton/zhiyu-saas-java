# zhiyu-saas 后端分层重构计划

> 状态：已完成。P0-P3 全部收口（路线图与各批验收明细已从本文档删除，历史见 git 提交：P0 立规 / P1 骨架 / P2 核心域 73 个 handler 5 批 / P3 清理）。
> 本文档现仅保留目标架构与红线规范。
> 关联红线：见 `AGENTS.md`「二、交付要求」第 6 条

## 一、现状基线（实测，2026-08-02 更新）

| 包                | 文件/行数         | 状态                                                                                                                                                                                          |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| handler           | 121 文件          | 全部 handler 无 `*pgxpool.Pool` 字段（import/export/template 已于 2026-08-09 迁移为 Store 注入）；分层红线全量适用                                 |
| store             | 70+ 文件          | 独立类型模式成熟：`NewXxxStore(q)` 工厂；**列表查询配置全量下沉**（各域 `ListConfig()`/`AdminListConfig()`/`PublicListConfig()`/`ListXxxConfig()` 方法 + `BatchTableConfig` + 日志包级配置），非冻结区 handler 不再内联 SQL 片段 |
| service           | 50 文件           | 业务编排层，提供 `Store()`/`Queryer()` 供 handler 直读；`PositionService`/`EvaluationService` 方法已按域重组为独立文件（position/ability/batch/workflow/term/teaching_plan/training_program/workspace_stats 等） |
| domain            | 12 文件 / 2.1k 行 | 类型中心，**保持不动，不新建 model/**                                                                                                                                                         |
| handler/common.go | ~370 行           | 响应/租户/权限 helper + `executeListQuery` 适配；`parseInt`/`parsePageLimit`/`itoa` 委托 store 唯一实现；时间格式化统一 `store.FormatDateTime`                                                     |

**现有可复用资产**：

- `store.ExecuteListQuery` + `ListQueryBuilder` + 白名单防注入（原 common.go 下沉）
- `decodeBody`、`requireTenant`/`tenantFilter`/`verifyTenantOwnership`
- `generateUniqueEntityCode`、`recordView`
- **`store.ContentActionStore`**（`store/content_actions.go`）：内容通用动作（提交审批/撤回/发布/下架/删除/归档）的 store 层复用范例，新建内容域接口优先复用
- **`respondServerError`**（`handler/common.go`）：新增 handler 的 500 错误处理约定，统一记录原始 error 后返回通用错误响应
- **`crudConfig[T, V]`**（`handler/crud.go`）：租户域字典实体 CRUD 通用模板（crudCreate/crudGet/crudUpdate/crudDelete），major/industry/org_type/staff_title/certificate_library 已套用，新增同类字典接口优先复用
- **`withTxStore`**（`store/store.go`）：领域 store 内部多语句事务统一模板（Begin/Rollback/Commit），`Store.WithTx` 亦基于它；禁止再手写 `beginner.Begin` 散落代码
- **列表查询配置下沉模式**：各域 store 提供 `ListConfig()` 等方法返回 `ListQueryConfig`（SQL 片段唯一所在地），handler 仅 `h.Service.Store().Xxx().ListConfig()` 取配置；claims 派生过滤由 handler 注入 `params.Values`，store 不读 Claims
- **`store.BatchTableConfig`**（`store/batch_configs.go`）：5 类批次表/列/状态差异配置 + 5 个构造器，BatchHandler 模板据此工作

## 二、目标架构

```
internal/
├── handler/    # HTTP 适配：解析→校验→调用 service/store→响应（不拼 SQL、不持有 pool）
├── service/    # 业务编排：事务边界、跨 store 组合、聚合计算
├── store/      # 数据访问：唯一 SQL 所在；领域 store 类型 + 通用查询件
│   ├── query.go      # ExecuteListQuery/ListQueryBuilder/白名单（从 common.go 下沉）
│   ├── content_actions.go  # ContentActionStore 通用内容动作
│   └── *_store.go    # 各领域 store（延续现有独立类型模式）
├── domain/     # 领域模型（现有，不动）
└── middleware/ # Claims/鉴权（现有，不动）
```

核心契约：

- `handler` 禁止拼接 SQL、禁止持有 `*pgxpool.Pool`（全量适用，无豁免区）
- `service` 禁止拼接 SQL 字符串
- `store` 禁止读取 HTTP Header/Claims，只接收显式参数

## 三、分层红线（P0）

见 `AGENTS.md`「二、交付要求」第 6 条，全文如下：

1. **新增** handler 中出现 `SELECT/INSERT/UPDATE/DELETE` 字符串，或直接调用 `db.Query/QueryRow/Exec` → 禁止合并
2. 新增 handler 禁止持有 `*pgxpool.Pool` 字段（**冻结区已于 2026-08-09 取消**：import/export/template 23 个文件全部迁移为 `Store *store.Store` 注入，不再豁免）
3. `common.go` 新增函数必须说明为何不能放入 store 层
4. `service` 禁止拼接 SQL；`store` 禁止读取 HTTP/Claims（只接收显式参数）
5. 新接口必须附带 handler/service/store 测试至少一种
6. 通用查询件（`executeListQuery` 等）下沉至 `store/query.go` 后，禁止在 store 包之外直接调用
