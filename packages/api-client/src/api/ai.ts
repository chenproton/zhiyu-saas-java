import { portalRequest } from '../api-helpers'
import type { AIChatBody, AIChatResponse, AIConfigSaveBody, AIConfigView } from '../types/ai'

// 租户 AI 服务配置（portal 系统管理）与统一对话入口
export const aiApi = {
  getConfig: () => portalRequest<AIConfigView>('/ai/config'),
  saveConfig: (body: AIConfigSaveBody) =>
    portalRequest<{ status: string }>('/ai/config', { method: 'PUT', body: JSON.stringify(body) }),
  deleteConfig: () =>
    portalRequest<{ status: string }>('/ai/config', { method: 'DELETE' }),
}

export function sendAIChat(body: AIChatBody) {
  return portalRequest<AIChatResponse>('/ai/chat', { method: 'POST', body: JSON.stringify(body) })
}

export const getAIConfig = aiApi.getConfig
export const saveAIConfig = aiApi.saveConfig
export const deleteAIConfig = aiApi.deleteConfig
