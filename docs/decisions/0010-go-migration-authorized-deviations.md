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

## 追加登记（2026-08-21 上游比对）：4 项安全姿态偏差

与上游框架 `/tmp/ref-framework` 比对时发现，`ruoyi-admin/src/main/resources/application.yml` 中 4 处配置放松了框架默认安全姿态，均为 zhiyu-saas 迁移期对齐已删除的 Go 版行为，已在配置处带「zhiyu-saas 迁移」注释，且经用户确认（风险接受人=用户）。登记在此防止日后被当作「配置遗漏」回改：

1. **验证码关闭**（`captcha.enable: false`，application.yml:21）：演示环境关闭，zhiyu 模块登录接口按需自实现校验，不使用框架默认图形验证码。
2. **全局接口加密关闭**（`api-decrypt.enabled: false`，application.yml:165）：Vue 门户/管理端均明文请求，对齐已删除的 Go 版无加密行为。
3. **认证放行白名单放宽**（`security.excludes`，application.yml:107-127）：放行 `/auth/**`、`/register`、`/captchaImage`、`/resource/sms/code` 及 `/api/v1/**` 等路径；其中 `/api/v1/**` 由 zhiyu 自有 Filter 鉴权，不走 Sa-Token 拦截，属迁移期「Go→Java 迁移启用」的既定放行。
4. **sa-token 有效期 7 天**（`sa-token.timeout: 604800`，application.yml:96）：对齐 Go 版 7 天会话时长，长于框架常见默认。

风险说明：以上各项均降低默认防护强度（无验证码/无接口加密/长会话/部分路径绕过 Sa-Token），风险由用户确认接受。若后续重新启用某项防护，属行为变更，需同步 spec 与本 ADR。

## 追加登记（2026-08-21 全量审计）：2 项工程结构偏差

2026-08-21 对照 AGENTS.md 第二部分框架契约的全量审计（后端分层 / 安全 / 前端三线子代理）发现 zhiyu 模块另有 2 类**工程结构**偏差，均无运行时安全/功能影响（功能由等价实现承担且已测试），登记防止被当作「违规」误改：

1. **Controller 直接暴露 Entity，无 VO 层**：161 个 Mapper 均为 `BaseMapperPlus<Entity, Entity>`，全模块 0 个 `@AutoMapper`/`MapstructUtils`/`selectVoPage`，96 处 controller 直接返回 domain Entity（入参已用 DTO）。响应结构即 Entity 结构，`password_hash`/`oauth` 已 `@JsonIgnore` 兜底不外泄。代价：无法使用框架 `@Sensitive`/`@Translation` 等序列化注解，规范审查反复命中。**处置**：新模块按框架约定建 VO；存量端点不回改（改响应结构即破坏前端契约）。
2. **自定义鉴权替代 `@SaCheckPermission`/`@Log` 注解**：81 个 Controller 均无框架权限/日志注解，由 `ZhiyuAuthFilter`（登录+活跃校验）+ `ZhiyuAuthzInterceptor` + `ZhiyuAuthzRules`（路径规则表，572 路由全覆盖、8 条未命中恰为公开白名单）+ `ZhiyuOperationLogFilter`（/api/v1 写操作统一异步审计）承担，功能等价且有 `ZhiyuAuthzRulesTest`（525 行规则矩阵）覆盖。代价：与框架注解风格不一致，规则表需手工维护（新增端点漏配时兜底为「portal 平台 + 已登录」，见低危项）。**处置**：新端点按框架约定加注解并同步规则表；存量端点不回改。
