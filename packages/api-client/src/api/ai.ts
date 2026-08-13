import { portalRequest, saasRequest } from '../api-helpers'
import type {
  AIChatBody,
  AIChatResponse,
  AIConfigSaveBody,
  AIConfigView,
  AIPositionAssistBody,
  AIPositionAssistResponse,
  AIScenarioAssistBody,
  AIScenarioAssistResponse,
  AIUsageStats,
} from '../types/ai'

// 租户 AI 服务配置（portal 系统管理）与统一对话入口
export const aiApi = {
  getConfig: () => portalRequest<AIConfigView>('/ai/config'),
  saveConfig: (body: AIConfigSaveBody) =>
    portalRequest<{ status: string }>('/ai/config', { method: 'PUT', body: JSON.stringify(body) }),
  deleteConfig: () =>
    portalRequest<{ status: string }>('/ai/config', { method: 'DELETE' }),
  getUsage: () => portalRequest<AIUsageStats>('/ai/usage'),
}

// 超管视角（/admin/tenants/{tenantId}/ai/config）：代租户维护 AI 服务配置，
// 与租户自身配置同一张表 tenant_ai_configs，仅以 SaaS 平台 token 访问。
export const adminAiApi = {
  getConfig: (tenantId: string) =>
    saasRequest<AIConfigView>(`/admin/tenants/${tenantId}/ai/config`),
  saveConfig: (tenantId: string, body: AIConfigSaveBody) =>
    saasRequest<{ status: string }>(`/admin/tenants/${tenantId}/ai/config`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteConfig: (tenantId: string) =>
    saasRequest<{ status: string }>(`/admin/tenants/${tenantId}/ai/config`, { method: 'DELETE' }),
}

export function sendAIChat(body: AIChatBody) {
  return portalRequest<AIChatResponse>('/ai/chat', { method: 'POST', body: JSON.stringify(body) })
}

/** 岗位 AI 辅助编写（润色/拆解/推荐，仅生成建议不写库）；signal 用于取消（AbortController） */
export function positionAiAssist(body: AIPositionAssistBody, signal?: AbortSignal) {
  return portalRequest<AIPositionAssistResponse>('/ai/position-assist', {
    method: 'POST',
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })
}

/** 场景/任务 AI 辅助编写（润色/说明生成/实体推荐/任务链建议）；signal 用于取消 */
export function scenarioAiAssist(body: AIScenarioAssistBody, signal?: AbortSignal) {
  return portalRequest<AIScenarioAssistResponse>('/ai/scenario-assist', {
    method: 'POST',
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })
}

export const getAIConfig = aiApi.getConfig
export const saveAIConfig = aiApi.saveConfig
export const deleteAIConfig = aiApi.deleteConfig
export const getAIUsage = aiApi.getUsage
