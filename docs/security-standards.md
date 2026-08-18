# 安全非功能规范（密码 / 会话 / 密钥 / 限流 / 上传）

> 本文档定义多租户 SaaS 的**安全非功能需求**，作为 AGENTS.md「三、硬性架构约束 3.3 安全红线」的细则补充。
> 所有条目均为**当前已确定**的要求（已实施，或明确标注 `[不适用]`）；新增/变更要求随实现同步更新（spec-first），不保留未落地的待办承诺。
> （数据备份/灾备不纳入本规范，属独立运维事项，另行规划。）

## 1. 密码策略

| 项 | 要求 | 状态 |
|----|------|------|
| 存储 | bcrypt（cost ≥ 10）哈希，禁用明文/可逆加密 | `[已实施]`（`users.password_hash`） |
| 最小强度 | 长度 ≥ 8；至少含字母与数字（大小写/特殊字符不强求，避免过度防御） | `[已实施]`（`handler/common.go isStrongPassword`，注册/改密/重置/导入全部入口统一校验） |
| 历史/轮换 | 不强制定期改密（对 C 端与教师群体是负担）；仅「泄露/可疑活动」时强制重置 | `[已实施]`（按需重置） |
| 重置密码回显 | 明文密码**仅在重置响应中一次性返回**（预览/复制）；服务端不存明文、不打日志、不支持事后再次查询；优先「随机密码仅返回一次」模式 | `[已实施]`（现状即一次性预览） |
| 登录防爆破 | 限流（见 §4）+ 验证码（见 §4），连续失败不返回「用户名 vs 密码」区分 | `[已实施]`（登录失败统一返回「用户名或密码错误」，含停用账号；验证码按失败阈值触发） |

## 2. 会话与 JWT 生命周期

- **签名**：HS256，密钥 `JWT_SECRET`（≥ 32 字节随机串，禁止提交仓库）；支持 `JWT_SECRET_PREVIOUS` 旧密钥验签（轮换窗口，见 §3）。
- **有效期**：7 天。
- **平台隔离**：portal / saas / partner 三端 token 不可互用（Claims 携带 platform，中间件校验）。
- **逐请求吊销**（`middleware.RequireActiveUser`，挂载于全部鉴权路由）：
  - 停用用户 / 停用租户 / 删除用户 → 下一请求即 401（不等到 7 天过期）；
  - 修改/重置密码后 → 旧 token 下一请求即 401（`users.password_changed_at` 早于 token `iat` 判定）。
- **登出**：前端清除本地 token（无服务端会话状态）；7 天过期 + 逐请求吊销已覆盖会话生命周期，无需服务端吊销通道。
- **存储介质评估（2026-08-15 结论）**：token 存 localStorage（`frontend/packages/api-client`），可被同源 XSS 窃取；后端已具备 HttpOnly cookie 通道（`middleware.SetAuthCookie`，仅 /uploads 图片通道使用）。**评估结论：主认证不迁移 HttpOnly cookie**——迁移需配套 CSRF 防护、改造三端全部请求链路与文件下载鉴权，收益（XSS 场景已由 CSP/上传沙箱/输入消毒多层缓解）与成本风险不成比例；未来若引入第三方脚本面扩大再复议。
- **Claims 最小化**：只放 userId/tenantId/roleCodes/permissions/platform，不放密钥、密码哈希等敏感信息。

## 3. 密钥管理

| 密钥 | 用途 | 要求 | 状态 |
|------|------|------|------|
| `JWT_SECRET` | 签发 JWT | ≥ 32 字节随机；每 90 天轮换（`JWT_SECRET_PREVIOUS` 旧验签、新签发）；禁止提交仓库（`.env`） | `[已实施]`（双密钥验签已落地） |
| `AI_CONFIG_SECRET` | 加密租户 AI api_key | **独立密钥，禁止回落 `JWT_SECRET`**（缺失即启动失败）；每 90 天轮换（解密先试主密钥、再兜底历史密钥 `JWT_SECRET`，兼容独立前存量密文） | `[已实施]` |
| 租户 AI api_key | 调用第三方 LLM | 入库加密（AES-256-GCM），永不回传前端、禁止打日志；只展示脱敏尾号 | `[已实施]` |

## 4. 限流与防爆破

- **现状**：登录 6 接口（`/auth/login`、`/auth/saas/login`、`/auth/portal/login`、`/auth/partner/login`、`/auth/partner/register`、`/auth/select-tenant`）+ `/auth/captcha` + `/files/upload` + 导入导出已挂限流器（Redis 计数，未配置 Redis 自动降级为内存限流）。
- **验证码**：字符验证码，连续输错 3 次触发、新设备首次登录必须校验（`[已实施]`）。
- **补齐项**（`[已实施]`）：
  1. AI 对话/生成端点限流（`/ai/chat`、`/ai/position-assist`、`/ai/scenario-assist`，每用户 20 次/分钟，防 token 额度盗刷）；
  2. 密码相关写操作限流（本人改密/管理员重置密码，每用户 10 次/分钟）；
  3. 公开读取接口限流（`/settings/theme` 120 次/分钟/IP；登录公开的联盟前台 `/alliance/public/*` 120 次/分钟/IP；`/job/public/positions`、`/scene/scenarios` 已有 2 分钟缓存）。
- **文档口径修正**：`系统功能清单.md` 原称「接口限流」为平台级能力，实际仅覆盖上述端点；本文档为准——未挂限流器的接口**不视为已限流**。

## 5. 上传与文件安全

| 项 | 要求 | 状态 |
|----|------|------|
| 类型校验 | 扩展名白名单 + **服务端 magic bytes 嗅探**（`http.DetectContentType`，内容与扩展名明显不符拒绝，防改扩展名绕过/XSS） | `[已实施]` |
| 大小 | 单文件 ≤ 10MB（请求体上限需计入 multipart 开销，实际限 `10MB + 头部`） | `[已实施]` |
| 存储 | 存 `data/uploads/{tenantID}/`，目录禁止执行权限；下载走 `Content-Disposition: attachment` 或内容安全响应头 | `[已实施]` |
| 访问控制 | 签名 URL 或登录态混合鉴权（`OptionalJWT`），跨租户 403 | `[已实施]` |
| 压缩炸弹 | 后端不服务端解压归档（解压预览交由 kkFileView/浏览器侧），无服务端解压攻击面；若将来引入服务端解压，须先校验展开体积与文件数上限 | `[不适用]` |

## 6. 可观测性

- **现状（即要求）**：`/health`、`/health/ready`（DB+Redis）、`/metrics`（Prometheus：请求量/耗时/5xx + DB 连接池）、操作日志异步化审计（含操作人/租户/IP/目标资源）。

## 7. 敏感信息脱敏与日志

- 身份证号、手机号等 PII 展示脱敏（`[已实施]` 部分）；日志禁止打印密码、api_key、token、身份证明文。
- 第三方 AI 上游错误 message 透传时，须过滤 `sk-` 等密钥前缀与可能回显的敏感片段（`[已实施]`：`ai.SanitizeUpstreamMessage`，见 ai-development.md）。
