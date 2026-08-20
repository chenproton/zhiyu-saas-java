# 0001: 后端分层红线（controller/service/mapper 职责分离）

- 状态：已接受（2026-08 随 Go→Java 迁移改写为 Java 框架语义）
- 日期：2026-08-14（初稿，Go）；2026-08-20（改写，Java）
- 取代：无

## 背景

后端早期存在 handler 直写 SQL、service 拼 SQL、store 读取 HTTP/Claims 的混杂现象，导致：分层职责不清、越权校验散落、难测试、难维护。需要一个硬性分层契约来约束所有新增代码。Go 后端迁移为 Java（base-dev-framework6-java，`org.dromara`）后，分层按框架约定变为 **Controller → Service → Mapper**（无 DAO 层），红线语义等价平移。

## 决策

我决定采用严格的**三层职责分离**（Java 框架约定，详见 `AGENTS.md` 第二部分与 `spec-check.sh` 校验规则）：

- **controller**：只做 HTTP 编排与鉴权，禁止出现裸 SQL（`SELECT/INSERT/UPDATE/DELETE`）、禁止持有 `JdbcTemplate`/`DataSource`/`SqlSessionFactory` 等 DB 句柄、禁止 MyBatis 注解（`@Select` 等）、禁止直接调 mapper。
- **service**：业务编排，禁止拼接 SQL；数据访问统一走 Mapper。
- **mapper**：SQL 的唯一落点（MyBatis 注解/XML），禁止读取 HTTP 请求（`HttpServletRequest`）、Sa-Token（`StpUtil`）、租户上下文（`TenantContext`）；SQL 统一带 `tenant_id` 条件做租户过滤。

新接口必须附带 controller/service/mapper 测试至少一种（`spec-check.sh` 第 14 项硬校验）。

## 备选方案

1. **单一 controller 层包办一切**：开发快，但 SQL 散落、越权校验重复、无法复用，长期维护成本高。否决。
2. **允许 service 拼 SQL**：缩短调用链，但 SQL 从 mapper 抽离，静态扫描、复用、测试都难。否决。
3. **引入 DAO 层**（框架衍生版写法）：破坏框架约定（本框架无 DAO 层），与 `BaseMapperPlus`/`QueryBuilder` 体系冲突。否决。

## 后果

### 正面
- SQL 集中在 mapper，可统一审计、复用、加租户限定。
- 分层清晰，新协作者/AI 容易对齐，越权校验有固定位置（service 层 + SQL 纵深防御）。

### 负面 / 代价
- 新增一个接口要跨三层写代码，样板代码略多。
- 需要依赖 code review / AI 协作者自觉遵守（无编译期强制），靠 `AGENTS.md` 红线 + `spec-check.sh` 静态扫描兜底。
