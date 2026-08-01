# zhiyu-saas 后端分层重构计划

> 状态：已确认，P0 立规完成，P1 骨架进行中
> 关联红线：见 `AGENTS.md`「二、交付要求」第 6 条

## 一、现状基线（实测）

| 包 | 文件/行数 | 状态 |
|---|---|---|
| handler | 108 文件 / 45.8k 行 | 91 个直写 SQL，79 个持有 `DB *pgxpool.Pool`，业务逻辑 + SQL 全部堆积于此 |
| store | 10 文件 / 2.2k 行 | 独立类型模式已成熟：`AllianceStore`/`RolesStore` + `NewXxxStore(db)` 工厂，仅 10 个 handler 使用 |
| service | 2 文件 / 847 行 | 空壳，应成为业务编排层 |
| domain | 12 文件 / 2.1k 行 | 类型中心，store/handler 一致引用，**保持不动，不新建 model/** |
| handler/common.go | 803 行 | `executeListQuery`（55 文件复用）+ 4 组白名单 + `withTx` + 租户 helper，需拆解 |

**现有可复用资产（整体下沉，不推翻）**：
- `executeListQuery` + `listQueryBuilder` + 4 组白名单防注入（55 文件复用）
- `decodeBody`（69 文件）、`withTx` 事务模板、`requireTenant`/`tenantFilter`/`verifyTenantOwnership`
- `lookupIDByName`（25 表白名单）、`generateUniqueEntityCode`、`recordView`

## 二、目标架构

```
internal/
├── handler/    # HTTP 适配：解析→校验→调用 service/store→响应（不拼 SQL、不持有 pool）
├── service/    # 业务编排：事务边界、跨 store 组合、聚合计算
├── store/      # 数据访问：唯一 SQL 所在；领域 store 类型 + 通用查询件
│   ├── query.go      # executeListQuery/listQueryBuilder/白名单（从 common.go 下沉）
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

### P2 核心域迁移（51 个 handler，分 4-5 批）
| 批次 | 领域 | 涉及文件 |
|---|---|---|
| 1 | 租户/组织/用户（写操作密集） | user_management、tenant、role、org、org_type、staff_title、user_extension_field、user_relation、major、industry |
| 2 | 内容核心域 | course（含 clone/node/homework/quiz）、scenario（含 task/weight/grade）、position（含 ability/certificate/clone） |
| 3 | 题库/考试 | question_bank、question、exam（含 usage/result） |
| 4 | 评测/教务/排课 | evaluation 系、affairs 系、scheduling、graduation、student_portrait |
| 5 | 前台/资源库 | landing、portal、resource_library、on_site_question_library、certificate_library |

每批验收：该批 handler 文件 SQL 清零 → `go vet`/`go test` 全绿 → 部署后接口冒烟。

### P3 清理（1 天）
- `common.go` 803 行 → 保留响应/租户/权限 helper，目标 <200 行
- 巨型文件拆分：scheduling(1486)/template(1621)/resource_import(1503)/course(1329)
- 补 store 查询构建器单测、service 事务单测

## 五、风险与缓解

| 风险 | 缓解 |
|---|---|
| executeListQuery 显式 filter 改造导致行为回归 | 白名单与 SQL 骨架原样平移，每批跑 13 个现有 handler 测试 + 冒烟 |
| 事务语义变化 | `withTx` 行为保持，仅移动位置；`pgx.Tx` 满足查询接口无需新抽象 |
| 改动面大 | 按批提交，每批独立可部署（deploy.sh --branch） |
| import/export 豁免区继续手写 SQL | 红线冻结 + 本文档声明，不扩散 |
