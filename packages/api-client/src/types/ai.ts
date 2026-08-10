// 租户 AI 服务配置与对话（后端 /ai/config 与 /ai/chat，camelCase 字段）
export interface AIConfigView {
  configured: boolean
  baseUrl?: string
  model?: string
  apiKeyMasked?: string
}

export interface AIConfigSaveBody {
  baseUrl: string
  /** 留空表示不修改已有 key；首次配置必填 */
  apiKey?: string
  model: string
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIChatBody {
  messages: AIChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface AIUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface AIChatResponse {
  reply: string
  usage: AIUsage
}
