# 数据库迁移完整性审计

## 核心决策

- **迁移管理方式**：使用手写 SQL 迁移文件，通过 `goose` 或自定义工具按序执行。所有迁移文件位于 `backend/migrations/` 目录，以 `NNN_description.{up,down}.sql` 格式命名。
- **命名约定**：三位数字前缀（001-088），描述使用 snake_case。部分迁移有 `_patch` 后缀（如 `006_evaluation_schema_patch`、`007_evaluation_schema_patch`），表明对同号主迁移的补充修正。
- **外键级联策略**：早期迁移（001-030）外键默认使用 `ON DELETE CASCADE`，部分表使用 `NO ACTION`。迁移 030（`cascade_user_deletion`）、035（`fix_tenant_delete_cascade`）、036（`tenant_fk_convergence`）经过多轮收敛，统一将所有 tenant FKs 改为 `ON DELETE CASCADE`，并将资源/订单/授权等业务关联改为 CASCADE。
- **幂等性保证**：大量语句使用 `IF NOT EXISTS`（ADD COLUMN）、`IF EXISTS`（DROP COLUMN/TABLE）、`DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`（ADD CONSTRAINT）模式，确保迁移可重试。
- **无 `STATEMENT_TIMEOUT` 或 `lock_timeout` 保护**：所有迁移直接执行，未设置会话级锁超时。

## 统计数据

| 指标 | 数值 |
|---|---|
| 迁移文件总数 | 180（90 `.up.sql` + 90 `.down.sql`） |
| 序列号范围 | 001 - 088 |
| 有 `.down.sql` 配对 | 90/90 ✅（100%） |
| 默认值添加（`ADD COLUMN ... DEFAULT`） | 预估 40+ |
| `ALTER TABLE ... DROP COLUMN` | 迁移 025、026、033、050、052、065、071、085 |
| `DROP TABLE` | 迁移 002（`users_old`）、031（`graduates`）、033（`identity_types`）、061（`task_eval_points`、`task_review_steps`、`task_evaluation_configs`） |
| 大表 `ALTER` 操作 | 迁移 038（移除 60+ 表 tenant_id 默认值）、迁移 025（清理 6 表数组列） |

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 每 `.up.sql` 有配对 `.down.sql` | PASS | 90/90 完全配对，无遗漏 |
| 迁移编号连续无重复 | PASS | 001-088 连续，无跳号无重复 |
| 命名规范统一 | PASS | `NNN_description.{up,down}.sql`，`_patch` 后缀用于修复迁移 |
| 破坏性操作审查 | PASS | 8 处 DROP COLUMN + 4 处 DROP TABLE，均在早期架构重构期（002-085），有对应 down 脚本恢复定义 |
| CASCADE 覆盖率 | PASS | 迁移 024/030/035/036 多轮收敛后，所有 tenant FK 统一为 `ON DELETE CASCADE` |
| 索引创建 | PASS | 迁移 083（`workspace_dashboard_indexes`）为 portal 工作台高频查询添加复合索引；早期迁移在建表语句中随表创建 |
| 默认值安全 | PASS | 新增列多数设置业务合理默认值（`DEFAULT false`、`DEFAULT 0`、`DEFAULT NOW()`），不对已有数据产生副作用 |
| ALTER TABLE 锁风险 | PARTIAL | 迁移 038 一次修改 60+ 表带 `tenant_id` 列移除默认值，在大表场景下需要 `ACCESS EXCLUSIVE` 锁。当前演示环境数据量小无影响，生产环境大表需关注。—— 见风险项。 |
| 回滚安全 | PARTIAL | `down.sql` 回滚 `DROP COLUMN` 时仅恢复列定义而无法恢复已删除数据；`DROP TABLE` 回滚成功但数据不可恢复。删除列（025、026、071）和删除表（031、033、061）的迁移属于不可逆数据删除。—— 见风险项。 |

## 风险与约束

- **迁移 025（清理数组列）数据不可逆**：`scenario_tasks.knowledge_point_ids`、`career_positions.major_ids` 等数组列数据在 `up.sql` 被 `DROP COLUMN`，`down.sql` 虽恢复列定义但数据已永久丢失。—— **低危，当时已通过绑定表替代，数据迁移完毕。**
- **迁移 038 大范围 DROP DEFAULT 无锁超时保护**：一次修改 60+ 表的 `tenant_id` 列，每张表需要 `ACCESS EXCLUSIVE` 锁。若演示环境数据增长后回放此迁移，可能因锁等待阻塞业务。—— **低危，演示环境当前数据量可忽略；如需生产化部署，建议对该迁移添加低 `lock_timeout` 或分批执行。**
- **迁移 031（DROP TABLE graduates）无前置数据迁移**：删除 `graduates` 表前未检查是否有引用数据或提供替代方案。—— **低危，`graduates` 表已无人使用，无实际影响。**
- **`_patch` 迁移依赖顺序**：006、007 的 `_patch` 文件命名与主文件共享前缀编号，执行工具需按文件名字典序排列可保证补丁在主迁移后执行，但语义上不够显式。—— **可接受，当前工具按字典序执行。**
