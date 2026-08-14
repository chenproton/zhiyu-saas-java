# 0001: 后端分层红线（handler/service/store 职责分离）

- 状态：已接受
- 日期：2026-08-14

## 背景

后端早期存在 handler 直写 SQL、service 拼 SQL、store 读取 HTTP/Claims 的混杂现象，导致：分层职责不清、越权校验散落、难测试、难维护。需要一个硬性分层契约来约束所有新增代码。

## 决策

我决定采用严格的三层职责分离（完整规范见 `docs/refactor-layering.md`）：

- **handler**：只做 HTTP 编排与鉴权，禁止出现 `SELECT/INSERT/UPDATE/DELETE`、禁止直接 `db.Query/QueryRow/Exec`、禁止持有 `*pgxpool.Pool` 字段（含 import/export/template 等所有 handler）。
- **service**：业务编排，禁止拼接 SQL。
- **store**：SQL 的唯一落点，禁止读取 HTTP 请求/Claims。

新接口必须附带 handler/service/store 测试至少一种。

## 备选方案

1. **单一 handler 层包办一切**：开发快，但 SQL 散落、越权校验重复、无法复用，长期维护成本高。否决。
2. **允许 service 拼 SQL**：缩短调用链，但 SQL 从 store 抽离，静态扫描、复用、测试都难。否决。

## 后果

### 正面
- SQL 集中在 store，可统一审计、复用、加租户限定。
- 分层清晰，新协作者/AI 容易对齐，越权校验有固定位置（handler 层）。

### 负面 / 代价
- 新增一个接口要跨三层写代码，样板代码略多。
- 历史遗留的 19 个直写 SQL handler 需逐步下沉（已在前轮完成大部分）。
- 需要依赖 code review / AI 协作者自觉遵守（无编译期强制），靠 `AGENTS.md` 红线 + 审查兜底。
