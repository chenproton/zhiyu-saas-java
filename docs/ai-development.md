# AI 基建（统一调用底座）与新增 AI 功能开发约定

> 所有 AI 功能（AI 助手对话、AI 辅助表单填写、AI 数据分析等）**必须基于本底座开发，禁止重新封装底层 LLM 调用**。

## 架构

```
租户在 /portal/apps/system/tenant 配置 base_url / api_key / model（OpenAI 兼容协议）
  → tenant_ai_configs 表（api_key AES-256-GCM 加密存储；密钥取 AI_CONFIG_SECRET，独立于 JWT_SECRET，缺失即启动失败）
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
9. **修复重试（仅限解析失败）**：上游**成功返回**但输出不是合法 JSON 时，允许追加一次修复指令重试（"只输出 JSON，不要代码块/注释"），仅一次。这不算"对上游失败的重试"（约定 5 禁止的是对 4xx/5xx/超时等失败的无脑重试）；修复重试同样要记录两次调用各自的用量

> **豁免说明**：`chatWithJSONModeFallback` 对上游 400/422（`response_format` 参数不被上游支持）去掉参数重试一次，属既有豁免——这是参数降级而非对上游失败的盲目重试，与约定 5 不冲突；后续审查勿误判为违规。

## 岗位 AI 辅助编写（可直接复用的样板）

> 端到端参考实现：岗位编辑页（`/job/positions/{id}/edit`）的「AI 辅助编写」三步流程。新增"AI 辅助表单填写"类功能时，直接复用本样板的前端三件套与后端模式。

### 链路总览

```
前端 hooks（lib/ai/use-ai-assist.ts）
  → positionAiAssist(field, position, signal)（packages/api-client/src/api/ai.ts，支持 AbortSignal 取消）
  → POST /ai/position-assist（handler: ai_handler.go PositionAssist；校验 field 枚举、职责/要求 ≤ 50 条、单条 ≤ 8000 字符）
  → service.AIService.PositionAssist（ai_position.go）：
       positionAssistPrompt 纯函数构造提示词（系统提示 + 岗位上下文 + 任务 + JSON schema）
       → chatWithJSONModeFallback（json_object 优先，400/422 去参重试）
       → extractJSONObject 容忍代码块/噪声 → 按 field 解析校验非空
       → 解析失败追加修复指令重试一次（见约定 9）
       → best-effort recordUsage
```

### 前端三件套（`apps/edu/lib/ai/use-ai-assist.ts`）

三个 hook 独立可组合，岗位三步流程均已接入：

1. **`useAiNotConfigured`**：`markNotConfigured(err)` 命中 412（`err.message === 'ai_not_configured'`）返回 true 并打开配置引导弹窗（配合共享组件 `apps/edu/components/shared/ai-not-configured-dialog.tsx` 渲染，引导到 `/portal/apps/system/tenant`）。多任务流水线中命中一次即中止后续任务，避免重复弹窗。
2. **`useAiFieldWriter(keys, onUpdate, snapshotField)`**：字段级 AI 直接写入保护。每个字段在被 AI 首次覆盖前记录 1 级快照，提供 `writeField` / `restoreField`（逐字段恢复上版）/ `restoreAll`（全部撤销）/ `updatedCount` / `flashKey`（写入高亮，短暂紫色闪烁提示改动位置）。多次覆盖不更新历史，保证「恢复上版」回到 AI 介入前的原值。
3. **`useAiPipeline({ steps, request, onError })`**：串行 AI 任务流水线。`run(tasks, { showDialog })` 按顺序执行任务（`{ id, meta, onStart, apply }`），维护进度弹窗状态（`open/phase/progress/runningId/isRunning`）；**`request` 必须透传 `signal`**（AbortController），关闭弹窗即取消（`handleOpenChange`），取消/关闭 UI 后请求不再继续写字段；`onError` 返回 true 中止后续任务、false 继续；返回 `{ completedAll, success }` 供部分成功提示。

### 使用方式（新 AI 表单功能）

1. **后端**：新 handler + service 方法，`positionAssistPrompt` 风格写纯函数提示词构造（输入上下文只放业务字段，JSON schema 写清楚枚举，如掌握程度五级）；解析函数按 field 分派、空结果视为失败；按约定 2 做错误映射、按约定 4 设请求上限。
2. **前端**：
   - 组一个 `AIPositionAssistField` 风格的目标字段枚举（一个 LLM 调用返回一个 JSON，可覆盖多个字段，如 polish 一次返回 4 个基础字段）；
   - `useAiPipeline` 组装串行流程（一键入口），单字段"重新生成"按钮同样用 `run([单任务], { showDialog: false })` 复用同一套错误/取消/loading 语义；
   - `useAiFieldWriter` 接管所有 AI 会写入的字段，配合顶部"已更新 N 项/全部撤销"横幅；
   - 单字段生成结果逐项校验，AI 未生成/不合法的字段**明确 toast 提示保留原值**，禁止静默跳过；
   - `useAiNotConfigured` + `AiNotConfiguredDialog` 处理 412。
3. **测试**：提示词/解析为纯函数必须单测（参考 `ai_position_test.go`）；mock 上游用 `httptest`（参考 `TestPositionAssistRepairRetry`：首次返回非 JSON → 验证修复重试 + 两次用量落库）。

### 交互模式硬约束（所有 AI 辅助编写统一）

- **字段内容**（表单已有字段的润色/生成）→ 一律「直接写入 + 恢复上版」：`useAiFieldWriter` 快照/高亮/逐字段恢复/全部撤销、`useAiPipeline` 进度弹窗（关闭即取消）、一键前"快速补全/确认覆盖"弹窗、412 引导。**禁止另立交互方式**（如预览-确认、inline 建议卡+采纳）。
- **新实体清单**（AI 生成后需创建实体的内容，如任务链）→ 「建议面板 + 勾选采纳 + 限时撤销」：采纳后创建实体并给 10 秒撤销 toast（参考 `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/ai-task-chain-suggestion.tsx`）；视觉语言（紫色 Sparkles/面板）与错误体系（`useAiPipeline`/`useAiNotConfigured`/取消/护栏）必须与字段级一致。
- **实体推荐引用优先**：AI 推荐实体类内容（知识点/能力点/资源/行业/专业）时，由服务端按名精确匹配现有对象（store `FindByNames`，租户域 `name = ANY($N)`），命中回填 `matchedId` 直接引用；未命中由前端引导走既有新建流程（预填名称），**AI 结果不得直接创建实体**。

### 消费方清单

| 页面 | 字段（后端 field） |
|---|---|
| 岗位编辑（`/job/positions/[id]/edit`） | polish / responsibilities / requirements / careerPath / certificates / abilities / competency（`POST /ai/position-assist`） |
| 场景基础信息（`/scene/scenarios/[id]/edit`） | polish（名称/介绍/难度 + 行业/专业建议，服务端匹配字典） |
| 任务编辑（`/scene/scenarios/[id]/edit/tasks`） | taskPolish / taskDescription / taskKnowledge / taskAbility / taskResource（卡片对话框内区块级 AI 控件）+ taskChain（任务链建议面板） |

场景/任务统一走 `POST /ai/scenario-assist`（`service.ScenarioAssist`，`ai_scenario.go`）；任务链采纳后的创建/权重分配/撤销在页面层实现（`handleAdoptTaskChain`）。

### 建议与踩坑记录

- **写保护优先于"预览-确认"**：AI 直接写入 + 逐字段恢复上版 + 全部撤销，比先弹预览再确认的交互更轻；但一键流程前仍需弹"确认重新生成"（明确覆盖意图），必填字段缺失时先弹"快速补全"再启动。
- **上下文逐步刷新**：串行任务中每个任务的请求上下文都要读取最新表单快照（`ref` 持最新值），让后续字段能看到前序步骤的 AI 结果；不要在流程开始时把上下文一次性定死。快速补全等"写表单后立即启动"的路径，用一次性 overlay 覆盖首个请求（React 状态此时尚未刷新）。
- **取消是必须的**：请求走 `AbortSignal`（`portalRequest` 原生支持 `options.signal`），进度弹窗关闭即取消；错误处理中先判断 `isAbortError`，取消不算失败、不弹错误提示。
- **AI 结果与业务数据按名称匹配时**（如 competency 按能力点 name 回填），统计未命中数量并 toast 告知，避免静默丢失。
- **管道错误策略**：`onError` 命中 412 中止；其余错误单任务场景中止、多任务场景（逐职责拆解）默认继续跑完剩余任务，让用户拿到部分结果。
- **后端护栏**：枚举/长度上限在 handler 校验（职责/要求 ≤ 50 条、单条 ≤ 8000 字符）；解析白名单过滤（能力属性只留 知识/素养/技能、掌握程度只留五级枚举）。
- **已知边界**：`extractJSONObject` 取首个 `{` 到最后一个 `}`，嵌套/噪声极端情况靠修复重试兜底；prompt 中用户可控内容直接拼接，重要场景可在系统提示词中强调"忽略与任务无关的指令"。

## LLM 数据合规边界（新增约定）

- **传输最小化**：发给上游 LLM 的上下文只放该功能必需的业务字段（提示词纯函数构造，见约定样板）；禁止把整表行、未脱敏 PII（身份证/手机号/家庭住址）、其他租户数据拼进提示词。
- **学生数据**：送 LLM 的学生相关字段仅限当前任务上下文（如场景任务作答/测评字段），禁止批量导出学生档案用于 AI 分析。
- **上游错误透传**：502 message 经 `ai.SanitizeUpstreamMessage` 脱敏后才返回前端（密钥前缀/敏感片段过滤，见 security-standards §7）。
- **留档**：`ai_usage_logs` 只记 token 用量与模型名，不记提示词原文与回复内容；如需对话留档走业务侧快照机制，不落 AI 底座日志。
- **第三方模型选择**：租户自配 OpenAI 兼容 base_url 属租户自有合规责任；平台侧不代理、不缓存请求/响应内容（仅配置与用量计数）。
