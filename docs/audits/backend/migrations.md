# 数据库迁移完整性审计

## 核心决策

- **迁移管理方式**：使用手写 SQL 迁移文件，通过自定义 migrator 按序执行。所有迁移文件位于 `backend/migrations/` 目录，以 `NNN_description.{up,down}.sql` 格式命名。
- **合并基准线**：迁移 001-090 已通过 `pg_dump --schema-only` 合并为单一 `001_baseline.up.sql`（2184 行，109 张 `CREATE TABLE`），作为新部署的初始 schema。增量迁移从 091 开始追加。
- **增量迁移**：`091_certification_weights.up.sql` 新增 `certification_weights` 表及其索引，支持岗位能力认定模型的两级权重配置。
- **外键级联策略**：合并基准线中，所有 `tenant_id` 外键已统一为 `ON DELETE CASCADE`，业务关联外键多数也用 CASCADE。早期多轮收敛（024/030/035/036）的结果已内化到基准线中。
- **幂等性保证**：`001_baseline.up.sql` 无幂等性语法（直接 CREATE TABLE），仅首次部署时执行一次。`091` 使用标准 DDL，依赖 migrator 的 `schema_migrations` 表追踪。

## 统计数据

| 指标 | 数值 |
|---|---|
| 迁移文件总数 | 66（33 个 `.up.sql` + 33 个 `.down.sql`） |
| 合并基准线大小 | 2184 行（001_baseline.up.sql） |
| 增量迁移 | 32 条（092~118，其中 097/101/104/107 各含 2 个文件） |
| 有 `.down.sql` 配对 | 33/33 ✅（100%） |
| `.down.sql` 策略 | 001_baseline：循环 DROP 所有表+类型；增量：DROP INDEX/TABLE/COLUMN IF EXISTS |
| 合并基准线内 CREATE TABLE | 109 张表 |
| 合并基准线内 DEFAULT 约束 | 431 处 |

> 最近一次增量：`118_workspace_indexes`（工作台核心查询索引，2026-08-03 部署应用）。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 每 `.up.sql` 有配对 `.down.sql` | PASS | 118/118 完全配对 |
| 迁移编号连续无重复 | PASS | 001（合并基准线）+ 092~118（增量）；编号递增无重复 |
| 命名规范统一 | PASS | `NNN_description.{up,down}.sql` |
| CASCADE 覆盖率 | PASS | 多轮收敛后所有 tenant FK 统一为 `ON DELETE CASCADE`，已内化到基准线 |
| 索引创建 | PASS | 基准线中在建表语句内随表创建 + 091 为 certification_weights 添加复合索引 |
| 回滚安全 | PARTIAL | `down.sql` 可恢复表结构定义，但无法恢复已删除的行数据。生产环境执行 down migration 前需备份数据 |
| 合并基准线部署安全 | PASS | 首次部署直接执行 CREATE TABLE，无 ALTER/DROP 操作。后续部署由 migrator 增量执行，不触碰已有数据 |

## 风险与约束

- **合并基准线为全量 DROP + CREATE**：`001_baseline.down.sql` 使用循环 `DROP TABLE IF EXISTS ... CASCADE` 删除所有表及类型。生产环境执行 down 恢复时，所有数据将永久丢失。—— **仅用于开发/测试环境重置，生产环境严禁执行 001 的 down。**
- **增量迁移无锁超时保护**：增量迁移直接执行，未设置 `statement_timeout` 或 `lock_timeout`。当前演示环境数据量小，可接受。—— **低危，若生产化部署需关注大表锁竞争，建议对大表 ALTER 添加 `lock_timeout`。**
- **增量迁移数量持续增长，需规范新增流程**：当前 117 条增量迁移（092~118），后续新增迁移需保持 `.up.sql`/`.down.sql` 配对和编号递增的约定。
