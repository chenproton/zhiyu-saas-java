# 后端可复用资产速查

> ⚠️ **历史文档（Go 时代）**：本文档是 Go 后端（`store`/`handler`/`service`）复用资产的记录。Go 后端已于 2026-08 迁移删除，当前后端为 **Java（controller → service → mapper，`BaseMapperPlus` + `QueryBuilder.lambda` + `MapstructUtils` 等）**，复用约定以根 `AGENTS.md` 第二部分「Java 后端框架契约」为准。本文档仅作历史参考。

> 原「新写后端代码前先查本表」纪律由 `AGENTS.md` 第二部分（组件/方法复用）承接；「能复用而不复用」需在 commit 说明理由（见 `spec-standards.md` DoD 第 6 条）。

## 一、列表查询（最多复用的一类，约 2/3 场景）

| 资产 | 位置 | 用途 | 何时用 |
|---|---|---|---|
| `store.ListQueryConfig[T]` | `store/query.go` | 列表查询配置（表/列/租户/搜索/排序/过滤） | 任何列表接口，先让对应的 store 提供 `ListConfig()` |
| `store.ExecuteListQuery` | `store/query.go` | 通用列表查询执行（含 count + 分页 + 白名单） | 列表接口的 handler 统一走它，不手写 limit/offset |
| `store.ListQueryBuilder` | `store/query.go` | 动态 WHERE 组装（参数化 + 防注入） | 需要动态过滤条件时 |
| `store.ClampLimitOffset` | `store/query.go` | limit/offset 钳制（防越界） | 手动分页时 |

## 二、字典类 CRUD（专业/行业/组织类型/现场题库等）

| 资产 | 位置 | 用途 | 何时用 |
|---|---|---|---|
| `crudConfig[T,V]` | `handler/crud.go` | 泛型 CRUD 模板（Create/Get/Update/Delete + 归属校验 + 唯一冲突） | 新做「字典类实体」的 CRUD，套这个模板而非手写四件套 |
| `crudCreate/Get/Update/Delete` | `handler/crud.go` | 上述模板的具体实现 | 同上（配合 crudConfig） |
| `store.DictStore[T]` | `store/dict_store.go` | 字典实体通用 store（GetByID/Create/Update/Delete/List） | 新做字典类 store，嵌入它而非手写 |

## 三、内容状态流转 / 通用动作

| 资产 | 位置 | 用途 | 何时用 |
|---|---|---|---|
| `store.ContentActionStore` | `store/content_actions.go` | 内容型实体的状态流转/审核/协作邀请（岗位/场景/课程/题库/试卷/方案共用） | 新做「有审批流的内容实体」动作，复用而非重写状态机 |

## 四、通用工具函数

| 资产 | 位置 | 用途 |
|---|---|---|
| `handler.parseLimitOffset` | `handler/common.go` | 解析分页参数 |
| `handler.safeHandler` | `handler/common.go` | 带 panic recover 的 handler 包装 |
| `store.LockByKey` | `store/query.go` | 分布式锁（核心业务防重复） |
| `store.IsUniqueViolation` | `store/query.go` | 判断唯一键冲突（23505） |
| `store.escapeLike` 惯例 | `store/query.go` | ILIKE 搜索转义 %/_ 并加 `ESCAPE '\'` |
| `store.MarshalJSONBytes` | `store/query.go` | JSON 序列化（含 fallback） |
| `store.GenerateUniqueEntityCode` | `store/entity_code.go` | 唯一实体编码生成（前缀+查重重试） |
| `store.FormatDateTime` | `store/` | 时间格式化（避免各层重复） |

## 五、事务模式

| 资产 | 位置 | 用途 |
|---|---|---|
| `store.WithTxStore` / `withTxStore` | `store/` | 事务包装（store 层） |
| `service.WithTx` | `service/` | 事务编排（service 层） |

> 更新纪律：新增可复用的公共 store 方法 / handler 模板 / 工具函数时，同步登记本表；删除时同步移除——与复用速查的登记纪律一致。
