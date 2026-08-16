// AI 智能服务中心 API 封装（docs/spec/ai-service-center.md §5）。
// 普通端点走 portalRequest；SSE 流式端点（对话/库内问答）用 fetch + ReadableStream 自解析。
import { buildQuery, getToken, portalRequest, type ApiErrorWithCode } from '../api-helpers'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

// ==================== 类型（与后端 domain/ai_center.go 对齐） ====================

export type AIContentStatus = 'private' | 'pending' | 'published' | 'rejected'
export type AIKBOwnerRole = 'owner' | 'editor' | 'viewer' | 'member' | 'collaborator'

export interface AIKnowledgeBase {
  id: string
  name: string
  description: string
  tags: string[]
  coverImage?: string
  status: AIContentStatus
  reviewComment?: string
  docCount: number
  askCount: number
  ownerId: string
  ownerName?: string
  myRole?: AIKBOwnerRole
  createdAt: string
  updatedAt: string
}

export interface AIKBDocument {
  id: string
  kbId: string
  name: string
  fileSize: number
  mime: string
  status: 'parsing' | 'ready' | 'failed'
  error?: string
  chunkCount: number
  charCount: number
  uploaderName?: string
  createdAt: string
}

export interface AIKBCollaborator {
  id: string
  userId: string
  userName?: string
  role: 'editor' | 'viewer'
  createdAt: string
}

export interface AIAgent {
  id: string
  name: string
  avatar: string
  description: string
  coverImage?: string
  greeting: string
  systemPrompt: string
  status: AIContentStatus
  reviewComment?: string
  chatCount: number
  ownerId: string
  ownerName?: string
  kbIds?: string[]
  kbNames?: string[]
  createdAt: string
  updatedAt: string
}

export interface AIConversation {
  id: string
  agentId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface AIMessageSource {
  docId: string
  docName: string
  seq: number
  snippet: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: AIMessageSource[]
  createdAt: string
}

export interface AIIntegration {
  id: string
  kind: 'agent' | 'app'
  name: string
  description: string
  url: string
  icon: string
  category: string
  sort: number
  status: 'active' | 'inactive'
  createdAt: string
}

export interface AIAdminOverview {
  kbTotal: number
  kbPending: number
  kbPublished: number
  agentTotal: number
  agentPending: number
  agentPublished: number
  integrations: number
}

export interface ListResult<T> {
  items: T[]
  total: number
}

// ==================== 知识库 ====================

export const aiCenterKbApi = {
  listMine: (params: { scope?: string; q?: string; page?: number; pageSize?: number } = {}) =>
    portalRequest<ListResult<AIKnowledgeBase>>(`/ai/kb${buildQuery({ ...params })}`),

  create: (body: { name: string; description?: string; tags?: string[]; coverImage?: string }) =>
    portalRequest<AIKnowledgeBase>('/ai/kb', { method: 'POST', body: JSON.stringify(body) }),

  get: (id: string) => portalRequest<AIKnowledgeBase>(`/ai/kb/${id}`),

  update: (id: string, body: { name: string; description?: string; tags?: string[]; coverImage?: string }) =>
    portalRequest<{ status: string }>(`/ai/kb/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  remove: (id: string) => portalRequest<{ status: string }>(`/ai/kb/${id}`, { method: 'DELETE' }),

  submit: (id: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${id}/submit`, { method: 'POST', body: '{}' }),

  unpublish: (id: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${id}/unpublish`, { method: 'POST', body: '{}' }),

  listDocuments: (kbId: string) => portalRequest<{ items: AIKBDocument[] }>(`/ai/kb/${kbId}/documents`),

  getDocument: (kbId: string, docId: string) =>
    portalRequest<AIKBDocument>(`/ai/kb/${kbId}/documents/${docId}`),

  uploadDocument: (kbId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = getToken('portal')
    return fetch(`${API_BASE}/ai/kb/${kbId}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({ error: '请求失败' }))
      if (!res.ok) {
        const err: ApiErrorWithCode = new Error((data as any).error || `HTTP ${res.status}`)
        err.status = res.status
        throw err
      }
      return data as AIKBDocument
    })
  },

  removeDocument: (kbId: string, docId: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${kbId}/documents/${docId}`, { method: 'DELETE' }),

  listCollaborators: (kbId: string) =>
    portalRequest<{ items: AIKBCollaborator[] }>(`/ai/kb/${kbId}/collaborators`),

  addCollaborator: (kbId: string, userId: string, role: 'editor' | 'viewer') =>
    portalRequest<{ status: string }>(`/ai/kb/${kbId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),

  removeCollaborator: (kbId: string, userId: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${kbId}/collaborators/${userId}`, { method: 'DELETE' }),
}

// ==================== 智能体 ====================

export interface AIAgentInput {
  name: string
  avatar?: string
  description?: string
  coverImage?: string
  greeting?: string
  systemPrompt: string
  kbIds?: string[]
}

export const aiCenterAgentApi = {
  listMine: () => portalRequest<{ items: AIAgent[] }>('/ai/agents'),

  create: (body: AIAgentInput) =>
    portalRequest<AIAgent>('/ai/agents', { method: 'POST', body: JSON.stringify(body) }),

  get: (id: string) => portalRequest<AIAgent>(`/ai/agents/${id}`),

  update: (id: string, body: AIAgentInput) =>
    portalRequest<{ status: string }>(`/ai/agents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  remove: (id: string) => portalRequest<{ status: string }>(`/ai/agents/${id}`, { method: 'DELETE' }),

  submit: (id: string) =>
    portalRequest<{ status: string; warnings?: string[] }>(`/ai/agents/${id}/submit`, {
      method: 'POST',
      body: '{}',
    }),

  unpublish: (id: string) =>
    portalRequest<{ status: string }>(`/ai/agents/${id}/unpublish`, { method: 'POST', body: '{}' }),

  listConversations: (agentId: string) =>
    portalRequest<{ items: AIConversation[] }>(`/ai/agents/${agentId}/conversations`),

  getConversation: (convId: string) =>
    portalRequest<{ conversation: AIConversation; messages: AIMessage[] }>(`/ai/conversations/${convId}`),

  removeConversation: (convId: string) =>
    portalRequest<{ status: string }>(`/ai/conversations/${convId}`, { method: 'DELETE' }),
}

// ==================== 广场 / 挂接展示 ====================

export const aiCenterSquareApi = {
  kbs: (params: { q?: string; tag?: string; sort?: 'hot' | 'new' | 'updated' | 'docs'; page?: number; pageSize?: number } = {}) =>
    portalRequest<ListResult<AIKnowledgeBase>>(`/ai/square/kbs${buildQuery({ ...params })}`),

  agents: (params: { q?: string; sort?: 'hot' | 'new'; page?: number; pageSize?: number } = {}) =>
    portalRequest<ListResult<AIAgent>>(`/ai/square/agents${buildQuery({ ...params })}`),

  integrations: (kind?: 'agent' | 'app') =>
    portalRequest<{ items: AIIntegration[] }>(`/ai/integrations${buildQuery({ kind })}`),
}

// ==================== 收藏（复用通用收藏端点，类型 ai_kb/ai_agent） ====================

export const aiCenterFavoriteApi = {
  status: (targetType: 'ai_kb' | 'ai_agent', id: string) =>
    portalRequest<{ isFavorite: boolean; favoriteCount: number }>(`/favorites/${targetType}/${id}`),
  toggle: (targetType: 'ai_kb' | 'ai_agent', id: string) =>
    portalRequest<{ isFavorite: boolean; favoriteCount: number }>(`/favorites/${targetType}/${id}`, {
      method: 'POST',
      body: '{}',
    }),
}

// ==================== 管理端（school_admin） ====================

export const aiCenterAdminApi = {
  reviews: (params: { type: 'kb' | 'agent'; status?: string; page?: number; pageSize?: number }) =>
    portalRequest<ListResult<AIKnowledgeBase | AIAgent>>(`/ai/admin/reviews${buildQuery({ ...params })}`),

  reviewAction: (type: 'kb' | 'agent', id: string, action: 'approve' | 'reject' | 'takedown', comment?: string) =>
    portalRequest<{ status: string }>(`/ai/admin/reviews/${type}/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment ?? '' }),
    }),

  overview: () => portalRequest<AIAdminOverview>('/ai/admin/overview'),

  listIntegrations: (kind?: 'agent' | 'app') =>
    portalRequest<{ items: AIIntegration[] }>(`/ai/admin/integrations${buildQuery({ kind })}`),

  createIntegration: (body: Omit<AIIntegration, 'id' | 'status' | 'createdAt'>) =>
    portalRequest<AIIntegration>('/ai/admin/integrations', { method: 'POST', body: JSON.stringify(body) }),

  updateIntegration: (id: string, body: Omit<AIIntegration, 'id' | 'status' | 'createdAt'>) =>
    portalRequest<{ status: string }>(`/ai/admin/integrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  toggleIntegration: (id: string, status: 'active' | 'inactive') =>
    portalRequest<{ status: string }>(`/ai/admin/integrations/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  removeIntegration: (id: string) =>
    portalRequest<{ status: string }>(`/ai/admin/integrations/${id}`, { method: 'DELETE' }),
}

// ==================== SSE 流式对话 ====================

export interface AIStreamCallbacks {
  onMeta?: (data: { conversationId: string; messageId: string }) => void
  onSources?: (sources: AIMessageSource[]) => void
  onDelta?: (text: string) => void
  onDone?: (data: Record<string, unknown>) => void
  onError?: (code: string, message: string) => void
}

/**
 * SSE 流式调用（spec §5.5）：POST + text/event-stream 解析。
 * 开始前失败（401/403/404/412/500）按 HTTP JSON 错误抛 ApiErrorWithCode；
 * 流中途失败经 onError 事件回调（不再抛异常）。
 * signal 取消即中断（AbortController）。
 */
export async function streamAICenter(
  path: string,
  body: { conversationId?: string; message: string },
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken('portal')
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  })

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok || !contentType.includes('text/event-stream')) {
    // 开始前错误：JSON 错误体
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    const err: ApiErrorWithCode = new Error((data as any).error || `HTTP ${res.status}`)
    err.code = (data as any).code
    err.status = res.status
    throw err
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('当前浏览器不支持流式响应')
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  const dispatch = (event: string, dataStr: string) => {
    let data: any
    try {
      data = JSON.parse(dataStr)
    } catch {
      return
    }
    switch (event) {
      case 'meta':
        callbacks.onMeta?.(data)
        break
      case 'sources':
        callbacks.onSources?.(data as AIMessageSource[])
        break
      case 'delta':
        callbacks.onDelta?.((data as { text: string }).text)
        break
      case 'done':
        callbacks.onDone?.(data)
        break
      case 'error':
        callbacks.onError?.((data as any).code ?? 'error', (data as any).message ?? '未知错误')
        break
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE 事件以空行分隔
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dispatch(currentEvent, line.slice(5).trim())
        }
      }
    }
  }
}
