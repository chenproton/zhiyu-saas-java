# AI 基建（统一调用底座）与新增 AI 功能开发约定

> 所有 AI 功能（AI 助手对话、AI 辅助表单填写、AI 数据分析等）**必须基于本底座开发，禁止重新封装底层 LLM 调用**。

## 架构

```
租户在 /portal/apps/system/tenant 配置 base_url / api_key / model（OpenAI 兼容协议）
  → tenant_ai_configs 表（api_key AES-256-GCM 加密存储；密钥取 AI_CONFIG_SECRET，缺省回落 JWT_SECRET）
  → service.AIService（Redis 读穿缓存 ai:cfg:{tenantID}，TTL 10min，Redis 故障降级直查 DB）
  → ai.Client（OpenAI 兼容 chat completions 网关；共享连接池，60s 超时）
```

关键文件：

- 网关客户端：`backend/internal/ai/client.go`（`ChatCompletion`，支持 `temperature`/`max_tokens`/`response_format` 透传，返回 `Usage`）
- 业务编排：`backend/internal/service/ai.go`（`AIService`：配置管理 + `Chat`，缓存与加解密都在这层）
- 存储：`backend/internal/store/ai_config.go`、`backend/internal/store/ai_usage.go`（用量记录）；加密：`backend/internal/crypto/aes.go`
- 现有端点：`GET/PUT/DELETE /ai/config`、`POST /ai/chat`、`GET /ai/usage`（用量统计：`backend/internal/handler/ai_handler.go`）
- 前端 API：`packages/api-client/src/api/ai.ts`；对话页：`apps/edu/app/portal/apps/ai/chat/page.tsx`

## 新增 AI 功能的开发约定

1. **LLM 调用一律经 `AIService`**：新功能 = 新 handler 端点 + 新 service 方法，内部调 `AIService.Chat` / `ai.Client.ChatCompletion` 拿结果。禁止：
   - 新建 LLM HTTP client、重新封装 OpenAI 协议调用
   - 直接查 `tenant_ai_configs` 表或自行解密 api_key（读取配置必须经 `AIService`，缓存/解密已内置）
2. **错误约定**：未配置 → `service.ErrAINotConfigured`（handler 映射 412 `ai_not_configured`，前端引导去租户信息页配置）；上游错误 → `*ai.UpstreamError`（映射 502 + 上游 message，不透传上游原始 body）；其余 500 → `respondServerError`
3. **密钥红线**：api_key 永不回传前端（domain 字段 `json:"-"`，对外视图只给 `maskAPIKey` 脱敏值）；禁止在日志中打印 api_key
4. **请求护栏**：新端点沿用 `POST /ai/chat` 的思路（messages ≤ 50 条、单条 ≤ 8000 字符），按场景自定上限，防止单请求打爆租户额度
5. **不自动重试**：chat completions 非幂等且按 token 计费，失败返回前端由用户重发
6. **流式扩展**：需要流式对话时，在 `ai.Client` 增加 `ChatCompletionStream`（解析 SSE + `http.Flusher` 透传）并新增端点，不得绕过 client 直接手写 SSE 调用上游
7. **用量落库**：LLM 调用产生的 token 用量已由 `AIService.Chat` 自动写入 `ai_usage_logs`（上游成功后 best-effort，失败不影响响应），复用 Chat 的新 AI 功能无需额外处理；若有绕过 Chat 的新调用路径，也必须自行记录用量
8. 前端调用经 `packages/api-client` 新增方法（`portalRequest` 等）；收到 412 统一引导到 `/portal/apps/system/tenant` 完成配置
