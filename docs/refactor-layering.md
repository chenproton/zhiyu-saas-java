# zhiyu-saas 后端分层重构计划

> 状态：已完成。P0-P3 全部收口：列表 SQL 配置全量下沉 store（非冻结区 handler 零 SQL 片段）、service 按域重组文件、DI 统一 store-only、工具函数收敛、store 纯逻辑单测补齐。
> 关联红线：见 `AGENTS.md`「二、交付要求」第 6 条

## 一、现状基线（实测，2026-08-02 更新）

| 包                | 文件/行数         | 状态                                                                                                                                                                                          |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| handler           | 121 文件          | 除豁免冻结区（import/export/template 22 文件）与测试外：无直写 SQL、无 `*pgxpool.Pool` 字段、无 `pgx.Tx`；handler 不再持有 Service+Store 双依赖（统一 store-only）                                 |
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

- `handler` 禁止拼接 SQL、禁止持有 `*pgxpool.Pool`（豁免区除外，见红线 2）
- `service` 禁止拼接 SQL 字符串
- `store` 禁止读取 HTTP Header/Claims，只接收显式参数

## 三、分层红线（P0）

见 `AGENTS.md`「二、交付要求」第 6 条，全文如下：

1. **新增** handler 中出现 `SELECT/INSERT/UPDATE/DELETE` 字符串，或直接调用 `db.Query/QueryRow/Exec` → 禁止合并
2. 新增 handler 禁止持有 `*pgxpool.Pool` 字段；**豁免冻结区**：现有 import/export/template 22 个 handler 文件（`*_import_handler.go`、`*_export_handler.go`、`template_handler.go`、`import_common.go`、`import_export_handler.go`）保持现状，冻结不扩散，不做迁移
3. `common.go` 新增函数必须说明为何不能放入 store 层
4. `service` 禁止拼接 SQL；`store` 禁止读取 HTTP/Claims（只接收显式参数）
5. 新接口必须附带 handler/service/store 测试至少一种
6. 通用查询件（`executeListQuery` 等）下沉至 `store/query.go` 后，禁止在 store 包之外直接调用

## 四、阶段路线图

### P0 立规（0.5 天）✅

红线写入 `AGENTS.md` + 本文档，声明 import/export 22 文件为豁免冻结区。

### P1 骨架（1-2 天）

1. **下沉通用查询件**：`executeListQuery`/`listQueryBuilder`/4 组白名单/`sanitizeIdentifier` 迁移至 `store/query.go`，签名改为显式 `ListParams{Search, Limit, Offset, Values map[string]string}`（去掉 `*http.Request` 依赖），55 个调用点机械改造
2. **service 骨架**：`service.New(stores...)` + `withTx` 事务模板
3. **试点**：迁移 `resource_library` 领域完整走 handler→service→store，作为后续模板

### P2 核心域迁移（73 个 handler，5 批）✅ 已完成

| 批次 | 领域                                                                       | 状态                            |
| ---- | -------------------------------------------------------------------------- | ------------------------------- |
| 1    | 租户/组织/用户（13 个）                                                    | ✅ master `c543c280`            |
| 2    | 内容核心域（21 个，含 course 作业/评估子域）                               | ✅ master `33c86f58`/`4cacae7c` |
| 3    | 题库/考试（8 个）                                                          | ✅ master `530b7f8a`            |
| 4    | 评测/教务/排课（8 个）                                                     | ✅ master `6aaa5707`            |
| 5    | 前台/公共（23 个，含 portal/auth/teaching_plan/training_program/batch 系） | ✅ master `41135c2c`            |

每批验收：该批 handler 文件 SQL 清零 → `go vet`/`go test` 全绿 → 部署后接口冒烟。
**P2 完成后**：除豁免冻结区（import/export/template 22 文件）外，全部 handler 无直写 SQL、无 `*pgxpool.Pool` 字段（认证类 fetch helper 经 store 封装，`LoadCertificationModel` 等既有 service 查询保留）。
**类型安全**：store 层全部使用强类型 DTO（`map[string]any` 已清零）。

### P3 清理（✅ 已完成）

- `common.go` → 保留响应/租户/权限 helper，`withTx`（死代码）已删除、`lookupIDByName` 已迁至 `import_common.go` ✅
- **非豁免 Handler 列表 SQL 下沉** ✅：46 个 handler 的 `ListQueryConfig` 配置（Table/SelectColumns/ExtraFilter/扫描器）全部沉淀到对应 store（`ListConfig()`/`AdminListConfig()`/`PublicListConfig()` 等 + `store/batch_configs.go` + `store/logs.go` 包级配置），非冻结区 handler 零 SQL 片段；claims 派生过滤经 `params.Values` 注入，store 不读 Claims
- **DI 统一** ✅：major/industry/org_type/staff_title/certificate_library/role/learn_road/micro_cert/on_site_question_library 9 个 handler 统一为 store-only（删除对应死 service 文件与路由构造）
- **工具函数收敛** ✅：`parseInt`/`parsePageLimit`/`itoa` 唯一实现于 store（handler 侧委托）；时间格式化统一 `store.FormatDateTime`
- **service 按域重组** ✅：`PositionService`（121 方法）/`EvaluationService`（109 方法）方法拆分为按域独立文件（position/ability/banner/term/batch/workflow/subscription/resource_code/recommend/hybrid_module/lesson_behavior/landing/approval/teaching_plan/training_program/workspace_stats + evaluation_* 系列），接收者类型不变、零行为变化
- **store 纯逻辑单测** ✅：`content_actions_test.go`（状态流转矩阵/业务规则/白名单防注入/ParsePageLimit）
- 巨型文件拆分：template(1621)/resource_import(1503) — **明确不做**（`docs/components.md` 约定大文件不拆分）
- store 查询构建器单测：`query_test.go` 已存在，`status.test.ts`/`api-helpers.test.ts`/`format-utils.test.ts` 补齐 ✅
- 格式化债务：Prettier（根目录 `format`/`format:check`）+ gofmt 全量清零 ✅

## 五、风险与缓解

| 风险                                          | 缓解                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| executeListQuery 显式 filter 改造导致行为回归 | 白名单与 SQL 骨架原样平移，每批跑 13 个现有 handler 测试 + 冒烟 |
| 事务语义变化                                  | `withTx` 行为保持，仅移动位置；`pgx.Tx` 满足查询接口无需新抽象  |
| 改动面大                                      | 按批提交，每批独立可部署（deploy.sh --branch）                  |
| import/export 豁免区继续手写 SQL              | 红线冻结 + 本文档声明，不扩散                                   |
