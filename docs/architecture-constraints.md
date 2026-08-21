# 硬性架构约束（分层红线 / 安全红线）

> 本文档为根 `AGENTS.md`「三、硬性架构约束」的细则出处（拆自 AGENTS.md 原文）：只列「必须遵守」的硬条款，详细规范与理由见对应 ADR（3.1 → [ADR-0001](decisions/0001-backend-layering.md)，3.2 → [ADR-0003](decisions/0003-tenant-isolation-strategy.md)），其余放各规范文档。

## 3.1 后端分层红线（Java 框架契约，理由见 ADR-0001）

- **controller**：禁止出现裸 SQL（`SELECT/INSERT/UPDATE/DELETE`）、禁止持有 `JdbcTemplate`/`DataSource`/`SqlSessionFactory` 等 DB 句柄、禁止 MyBatis 注解（`@Select` 等）、禁止直接调 mapper。
- **service**：禁止拼接 SQL；业务逻辑统一在 Service 层组装，数据访问走 Mapper。
- **mapper**：禁止读取 HTTP 请求（`HttpServletRequest`）、Sa-Token（`StpUtil`）、租户上下文（`TenantContext`）；SQL 统一带 `tenant_id` 条件做租户过滤。
- 新接口必须附带 controller/service/mapper 测试至少一种。

## 3.2 安全红线（越权 / 租户隔离，理由见 ADR-0003）

- 租户隔离以 SQL 层 `tenant_id` 条件 + 归属校验（`SystemGuard` / service 层校验）为准，禁止跨租户读写。
- 关键写操作（考试题目增删改分、密码/状态写）SQL 层补租户条件作纵深防御。
- 新端点写前自检五问：① 有没有跨租户读/写他租户数据？② 密钥/密码是否可能回传或落日志？③ 有没有 SQL 注入面？④ 上传文件是否会执行？⑤ 有没有未鉴权/越权匿名访问路径？
