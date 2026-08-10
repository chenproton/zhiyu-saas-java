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

// ===== 岗位 AI 辅助编写（POST /ai/position-assist）=====

export type AIPositionAssistField =
  | 'polish'
  | 'responsibilities'
  | 'requirements'
  | 'careerPath'
  | 'certificates'

export interface AIPositionAssistBody {
  field: AIPositionAssistField
  position: {
    name: string
    shortName: string
    /** 行业名称（前端由字典 ID 解析后传入） */
    industry: string
    majors: string[]
    salaryRange: [number, number]
    description: string
    responsibilities: string[]
    requirements: string[]
    careerPath: string
  }
}

/** polish 字段结果：基础信息润色（行业/专业为字典 ID，不由 LLM 生成） */
export interface AIPositionPolish {
  name: string
  shortName: string
  description: string
  salaryMin: number
  salaryMax: number
}

export interface AISuggestedCertificate {
  name: string
  description?: string
  url?: string
}

export interface AIPositionAssistResponse {
  field: AIPositionAssistField
  polish?: AIPositionPolish
  responsibilities?: string[]
  requirements?: string[]
  careerPath?: string
  certificates?: AISuggestedCertificate[]
}
