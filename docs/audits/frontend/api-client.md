# API 客户端层审计

## 核心决策

- **集中式 API 客户端**：所有 API 函数集中在 `packages/api-client/src/api.ts`（1139 行），统一管理后端请求。
- **双 Token 管理**：
  - 两个 localStorage 键：`zhiyu-token`（SaaS）和 `zhiyu-portal-token`（Portal）。
  - `request()` 函数根据 URL 路径或 `NEXT_PUBLIC_DEFAULT_PLATFORM` 环境变量自动选择 token。
  - `requestWithPlatform<T>()` 是核心 fetch 封装——附加 Bearer token、解析 JSON、401 时清除 token 并跳转登录页。
- **工厂模式**：
  - `createCrudApi<TItem, TCreate, TUpdate>(prefix)`：生成标准 CRUD 接口。
  - `createContentApi<TItem, TCreate, TUpdate>(prefix)`：扩展 CRUD，增加内容生命周期操作（submit/review/publish/archive/unpublish/withdraw/saveDraft/invite）。
- **请求封装**：`buildQuery()` 参数序列化、文件上传使用 `FormData`、非 2xx 响应抛出 `ApiError`。
- **API 对象分组**：7 大分组 40+ API 对象，覆盖核心市场、后台管理、Portal 管理、岗位/场景/课程/评价全部平台后端接口。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 双 Token 管理 | PASS | 自动根据平台选择正确的 token；401 时清除并跳转 |
| 工厂模式 | PASS | `createCrudApi`/`createContentApi` 减少重复；覆盖 20+ 资源 |
| API 覆盖 | PASS | 40+ API 对象，覆盖全部后端接口 |
| 类型安全 | PASS | 完整的 TypeScript 接口定义 |
| 错误处理 | PASS | `ApiError` 封装状态码和消息 |
| 文件上传 | PASS | `FormData` 封装 |

## 风险与约束

- 无明显高风险项，API 客户端层设计完整。
