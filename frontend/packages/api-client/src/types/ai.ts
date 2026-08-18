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

// ===== AI 用量统计（GET /ai/usage）=====

export interface AIUsageDay {
  /** 2006-01-02 格式日期 */
  date: string
  tokens: number
  requests: number
}

export interface AIUsageStats {
  totalRequests: number
  totalTokens: number
  /** AI 套餐 token 额度（来自订阅 ai_token_quota，未设置时为 0） */
  tokenQuota: number
  /** 近 30 天每日序列（含今天，后端已补齐无数据日期为 0） */
  daily: AIUsageDay[]
}

// ===== 岗位 AI 辅助编写（POST /ai/position-assist）=====

export type AIPositionAssistField =
  | 'polish'
  | 'responsibilities'
  | 'requirements'
  | 'careerPath'
  | 'certificates'
  | 'abilities'
  | 'competency'

export interface AIPositionAbilityContext {
  name: string
  domain?: string
  attributes?: string[]
  description?: string
}

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
    /** abilities 字段使用：当前待拆解的工作职责名称 */
    responsibilityName?: string
    /** competency 字段使用：现有能力绑定清单 */
    abilities?: AIPositionAbilityContext[]
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

/** abilities 结果：AI 为某职责拆解的能力点 */
export interface AISuggestedAbility {
  name: string
  domain: string
  attributes: string[]
  rubricDescription: string
}

/** competency 结果：AI 填充的掌握程度与胜任标准（按 name 与绑定匹配） */
export interface AICompetencyFill {
  name: string
  level: 'understand' | 'comprehend' | 'master' | 'proficient' | 'expert'
  rubricDescription: string
}

export interface AIPositionAssistResponse {
  field: AIPositionAssistField
  polish?: AIPositionPolish
  responsibilities?: string[]
  requirements?: string[]
  careerPath?: string
  certificates?: AISuggestedCertificate[]
  abilities?: AISuggestedAbility[]
  competencies?: AICompetencyFill[]
}

// ===== 场景 AI 辅助编写（POST /ai/scenario-assist）=====

export type AIScenarioAssistField =
  | 'polish'
  | 'taskPolish'
  | 'taskDescription'
  | 'taskKnowledge'
  | 'taskAbility'
  | 'taskResource'
  | 'taskChain'

/** 场景/任务 AI 辅助请求上下文（行业/专业/岗位由前端解析为名称传入） */
export interface AIScenarioAssistBody {
  field: AIScenarioAssistField
  scenario: {
    name: string
    background: string
    difficulty: number
    industryNames: string[]
    professionNames: string[]
    /** taskAbility 前置条件：场景关联的岗位 ID */
    positionId: string
    positionName: string
    /** task* 字段使用：当前任务上下文 */
    taskName: string
    taskBackground: string
    taskDescription: string
    taskDifficulty: number
    /** taskChain 使用：现有任务清单与用户意图 */
    existingTasks: { name: string; type: 'training' | 'assessment'; difficulty: number }[]
    intention: string
  }
}

/** 实体推荐条目：matchedId 非空表示命中现有对象（引用优先），否则需新建/引导添加 */
export interface AIScenarioSuggestion {
  name: string
  description?: string
  /** taskResource：资源类型枚举（document/video/software/...） */
  type?: string
  matchedId?: string
  matchedName?: string
}

export interface AIScenarioPolish {
  name: string
  background: string
  difficulty: number
}

export interface AIScenarioTaskPolish {
  name: string
  background: string
  difficulty: number
}

export interface AIScenarioTaskChainTask {
  name: string
  type: 'training' | 'assessment'
  difficulty: number
  estimatedHours: number
  description: string
}

export interface AIScenarioTaskChain {
  taskCount: number
  assessmentCount: number
  trainingCount: number
  tasks: AIScenarioTaskChainTask[]
}

export interface AIScenarioAssistResponse {
  field: AIScenarioAssistField
  polish?: AIScenarioPolish
  industrySuggestions?: AIScenarioSuggestion[]
  professionSuggestions?: AIScenarioSuggestion[]
  /** 目标岗位建议（polish 返回 0-1 个；命中系统已有岗位时回填 matchedId/matchedName） */
  positionSuggestion?: AIScenarioSuggestion
  task?: AIScenarioTaskPolish
  taskDescription?: string
  suggestions?: AIScenarioSuggestion[]
  chain?: AIScenarioTaskChain
}
