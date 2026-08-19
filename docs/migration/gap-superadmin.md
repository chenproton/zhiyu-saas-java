# React→Vue 迁移报告：超管控制台 /superadmin

> 分支 feat/agent-align-remaining · 对齐对象 frontend/edu/app/superadmin（功能基准）· Vue 侧 frontend/portal-vue

## 任务
把 React 的超管控制台 `/superadmin` 整页迁移到 Vue 业务门户 portal-vue（Element Plus + Pinia + vue-router），完整覆盖租户/管理员/订阅/AI 配置/主题色/平台模块七类功能，SaaS 平台登录态。

## 改动清单（仅 portal-vue 相关文件）

| 文件 | 改动 |
|---|---|
| `src/api/http.ts` | 错误对象附带后端统一错误码 `code` / `status`（对齐 api-client，登录流按 captcha_required/captcha_wrong 分支依赖此字段）。 |
| `src/api/superadmin.ts`（新增） | 超管数据通道：租户/企业主体/订阅/管理员(学校+企业)/主题色/AI 配置全量 API（走 `saasRequest`，前缀 /admin/tenants 与 /admin/settings/theme）+ SaaS 登录/验证码 + 平台模块清单 PLATFORM_MODULES + 主题工具（fetchThemeColor/applyBrandColor/isHexColor/DEFAULT_BRAND_COLOR）+ getDeviceId + parseJwtPayload。 |
| `src/views/superadmin/index.vue`（新增） | 主页面：SaaS 登录（账号/密码/验证码图片）+ 租户列表（学校/企业 Tab、搜索、分页、状态/有效期/创建时间）+ 平台主题配置 + 各弹窗编排（启用停用/删除需输入租户名称）。 |
| `src/views/superadmin/theme-color-picker.vue`（新增） | 可复用主题色选择器（预设色板 + 取色器 + 手动输入 + 实时预览 + 保存/恢复），平台级/租户级共用。 |
| `src/views/superadmin/tenant-form-dialog.vue`（新增） | 租户创建/编辑（学校/企业双形态，企业编辑合并更新企业主体，企业创建含管理员账号/初始密码）。 |
| `src/views/superadmin/enterprise-detail-dialog.vue`（新增） | 企业租户只读详情 + 前台展示开关即时落库（失败回滚）。 |
| `src/views/superadmin/admin-list-dialog.vue`（新增） | 学校/企业管理员 CRUD（内联新增/编辑）+ 重置密码（规则校验）。 |
| `src/views/superadmin/subscription-dialog.vue`（新增） | 订阅套餐：平台模块 jsonb 勾选 + aiTokenQuota（¥↔tokens 换算）+ 租户级 AI 配置（get/save/delete，apiKey 不回显、留空不修改、可清除）。 |
| `src/router/index.ts` | 新增 `/superadmin` 顶级路由（meta.public=true，页面内部自行鉴权，不走门户 token 守卫）。 |

## 后端契约对齐（已读确认）
- `SuperAdminController`：/api/v1/admin/tenants 系列（list/create/update/status/delete/enterprise/subscription/admins/enterprise-admins/reset-password/theme）。
- `AiTenantConfigController`：/api/v1/admin/tenants/{tenantId}/ai/config（get/save/delete）。
- `ZhiyuAuthController`：/api/v1/auth/saas/login、/saas/me、/captcha；错误体 `{code,error,message}`（captcha_required / captcha_wrong 由 ApiExceptionHandler 输出）。
- `SettingsController`：公开 GET /api/v1/settings/theme（tenantId 可选），用于主题色读取。

## 校验结果
- `cd frontend/portal-vue && npx vue-tsc --noEmit` → **exit 0**（通过）。

## 已知简化点
1. **无 i18n**：React 用 `useT()` 多语言；portal-vue 无 i18n 机制，本页直接中文文案（与既有 Vue 视图一致）。
2. **平台模块卡片**：React 每模块 lucide 图标 + 独立配色；Vue 版用 `el-checkbox border` 网格展示模块开关，省略图标/配色，仅保留 id+label 数据源（PLATFORM_MODULES，与 navigation-config platformModuleDefs 一级 key/label 对齐）。
3. **管理员新增行**：React 在表格首行内联输入；Vue 版在表格下方独立内联新增行（语义一致，交互略简化）。
4. **未调用 /auth/saas/me**：与 React 一致，登录后仅本地 parseJwtPayload 判 `roleCodes.includes("platform_admin")` 并取 username；后端 /saas/me 契约存在但 React 未使用，故未接入。
5. **主题实时生效**：Vue 版保存后同样写 `--brand` CSS 变量 + 派发 `zhiyu-theme-changed` 事件；但 portal-vue 侧暂无全局品牌监听消费该事件（React edu 有），实际生效依赖刷新后由公共 /settings/theme 拉取。
6. **401 跳转**：saas 请求 401 走 http.ts `handleUnauthorized("saas")` 跳 /login（与 React api-client 一致）；portal-vue 的 /login 为门户登录页，属既有 http.ts 行为，本任务未改动。
7. **模块 jsonb 取值容错**：后端 modules 为 `Map<String,Object>`，Vue 侧将 `true / "true" / 1` 统一归为开启（React 直接 `?? false` 假设布尔）。
8. **删除确认**：React 用 ConfirmDialog + 输入租户名称匹配；Vue 版用 el-dialog + el-input 同语义实现。
