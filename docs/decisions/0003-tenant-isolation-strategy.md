# 0003: 租户隔离采用「service 层校验 + SQL 层纵深防御」

- 状态：已接受（2026-08 随 Go→Java 迁移改写为 Java 框架语义）
- 日期：2026-08-14（初稿，Go）；2026-08-20（改写，Java）
- 取代：无

## 背景

多租户隔离有两条防线可选：① service 层先查归属再校验（等价 Go 版 `GetByID` + `verifyTenantOwnership`，Java 侧由 `SystemGuard`/各域 service 承担）；② SQL 层直接加 `AND tenant_id = ...`。前者灵活但依赖调用方自觉，后者严格但改动面大、且部分查询（如内部回查）本就不需要租户参数。

## 决策

我决定采用「**service 层校验为主，SQL 层租户限定为纵深防御**」（Java 实现）：

- 归属校验在 service 层统一兜底（`SystemGuard.canManagePortal` / 各域 service 的租户校验，等价 Go 的 `verifyTenantOwnership` 语义）；controller 只做 HTTP 编排，不重复实现归属逻辑。
- 关键写操作（考试题目增删改分、密码/状态写）在 SQL 层补 `tenant_id` 条件（MyBatis 注解 SQL 带 `tenant_id = #{tenantId}`），作为「漏校验即 IDOR」的纵深防御。
- 普通读/写依赖 service 层校验 + mapper SQL 的租户过滤（zhiyu 业务表查询统一带 `tenant_id` 条件，见 `AGENTS.md` 3.2 与 `spec-check.sh` 第 6 项）。

## 备选方案

1. **所有 SQL 一律带租户条件**：最严格，但 mapper 方法签名全面膨胀、大量「内部回查」需穿透租户参数，收益与成本不匹配。部分否决（仅关键写操作采纳）。
2. **只靠 service 校验，SQL 永不限定**：简单，但任一新调用点漏校验即成越权。否决（需配合关键写操作的 SQL 纵深防御）。
3. **启用框架租户插件（TenantLineInnerInterceptor）**：自动注入 tenant_id，但 zhiyu 租户语义复杂（租户停用校验、跨租户文件签名访问、联盟公共访问等），插件无法覆盖，行为等价迁移优先。否决（zhiyu 业务域沿用显式 SQL 过滤）。

## 后果

### 正面
- 关键写操作有双重防线，普通路径不被租户参数拖累。
- 越权校验位置明确（service 层 + SQL 纵深防御），新协作者/AI 易对齐。

### 负面 / 代价
- 「哪些操作该在 SQL 层补租户」需要经验判断，边界不完全机械化（`scripts/spec-check-data/adr0003-key-writes.txt` 外置名单兜底）。
- mapper 层「无租户限定」的方法依赖注释/审查保证调用方校验，存在未来新调用点遗漏的风险（需 ADR 标注契约 + 审查兜底）。
