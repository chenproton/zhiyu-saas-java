# 0002: AI 功能统一走 AIService 底座

- 状态：已接受
- 日期：2026-08-14

## 背景

AI 相关功能（AI 助手对话、AI 辅助表单填写、AI 数据分析等）若各模块各自封装 LLM 调用，会导致：api_key 管理散乱、租户 AI 配置逻辑重复、错误映射不一致、密钥泄露面扩大。

## 决策

我决定所有 AI 功能统一基于 `AIService` 底座开发（完整规范见 `docs/ai-development.md`）：

- LLM 调用一律经 `AIService.Chat` / `ai.Client.ChatCompletion`，禁止新建 LLM HTTP client，禁止直接查 `tenant_ai_configs` 或自行解密 api_key。
- 错误映射统一：未配置 → 412 `ai_not_configured`；上游错误 → 502 + 上游 message；其余 → `respondServerError`。
- api_key 永不回传前端、禁止打印日志。
- 新端点按场景设请求上限、不自动重试、流式经 `ai.Client.ChatCompletionStream`。

## 备选方案

1. **各模块自行封装 LLM**：灵活但密钥/配置/错误映射各搞一套，安全面分散。否决。
2. **只在「对话」用 AIService，表单填写另写**：看似省事，实际把「统一底座」的边界打破，后续更乱。否决。

## 后果

### 正面
- 密钥、租户配置、错误映射、流式单一入口，安全可控、行为一致。
- 新增 AI 功能只需调底座，不碰底层 LLM。

### 负面 / 代价
- 所有 AI 需求都受 AIService 能力边界约束，若底座暂不支持的能力需先扩展底座（不能绕过）。
- 需要 AI 协作者自觉遵守红线（无编译期强制），靠 `AGENTS.md`「三、硬性架构约束」第 3.2 条 + 审查兜底。
