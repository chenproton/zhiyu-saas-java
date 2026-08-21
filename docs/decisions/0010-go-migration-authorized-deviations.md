# 0010: Go→Java 迁移中的 4 项框架约定授权偏差

- 状态：已接受
- 日期：2026-08-21

## 背景

zhiyu 业务模块（`ruoyi-modules/ruoyi-zhiyu`）由 Go 版迁移而来，为逐端点对齐 Go 行为，存在 4 类与 Java 框架契约（AGENTS.md 第二部分）不一致的写法。这些写法若被当作「违规」随手「修复」，反而会破坏与 Go 版的行为对齐，故登记为授权偏差。

## 决策

允许 zhiyu 模块保留以下 4 项偏差，不再按框架默认约定回改：

1. **`is_deleted` 手写软删**：zhiyu 业务表沿用 Go 版 `is_deleted` 布尔列（非框架 `del_flag` + `@TableLogic`），软删/过滤在 SQL 中显式书写。表结构随 Go 版基线冻结，不迁到 `del_flag`。
2. **手写 `LIMIT/OFFSET` 分页**：列表接口沿用 Go 版 `limit/offset` 契约，SQL 或 wrapper `last("LIMIT ...")` 手写分页，统一经 `SystemGuard.clampLimit` 收敛上限（默认上限 200，大列表场景用三参重载），不走框架 `PageQuery`/`PageResult`。
3. **admin 动词路径**：部分管理端端点保留 Go 版动词式路径（如 `/xxx/approve`），不改写为标准 REST（`PUT /{id}` 等），以保持前后端契约不变。
4. **登录防护 fail-open**：登录失败计数/常用设备判定在 Redis 不可用时降级放行（`AuthServiceImpl`），优先保证可登录；所有降级路径必须 `log.warn` 留痕（fail-open 不等于静默）。

## 备选方案

- **全面回改到框架约定**（`del_flag`/`PageQuery`/标准 REST/fail-closed）：否决。会偏离 Go 版既有 API 契约与表结构，迁移期回归风险远大于一致性收益。
- **不登记、靠口头约定**：否决。审查与规范检查（spec-check）会反复命中这些点，没有 ADR 会被误判为违规。

## 后果

### 正面

- 迁移行为对齐 Go 版，契约稳定；审查者与后续 Agent 有据可查，不再误改。
- 偏差边界明确：仅限 zhiyu 模块既有端点，新模块仍按框架约定开发。

### 负面 / 代价

- zhiyu 模块与框架其它模块风格不一致，新人需要读本 ADR 才能理解「为什么这里不一样」。
- fail-open 在 Redis 长时间不可用时削弱登录防爆破能力，依赖日志告警兜底。
