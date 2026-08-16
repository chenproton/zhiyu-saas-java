// AI 智能服务中心 API 封装（docs/spec/ai-service-center.md §5）。
// 普通端点走 portalRequest；SSE 流式端点（对话/库内问答）用 fetch + ReadableStream 自解析。
import {
  buildQuery,
  getToken,
  handleUnauthorized,
  portalRequest,
  type ApiErrorWithCode,
} from '../api-helpers'

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
  viewCount: number
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
  viewCount: number
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
  kbs: (params: { q?: string; tag?: string; sort?: 'hot' | 'new' | 'updated' | 'docs' | 'views'; page?: number; pageSize?: number } = {}) =>
    portalRequest<ListResult<AIKnowledgeBase>>(`/ai/square/kbs${buildQuery({ ...params })}`),

  agents: (params: { q?: string; sort?: 'hot' | 'new' | 'views'; page?: number; pageSize?: number } = {}) =>
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

// 流式读取闲置超时：单次 read 超过该时长仍无新数据即视为流中断（后端 30s 超时，前端放宽到 60s）。
// 只作用于「无新数据」的空闲场景，不限制正常流式输出的总时长。
const SSE_IDLE_TIMEOUT_MS = 60_000

/**
 * 带闲置超时的单次 read：超时以普通 Error 拒绝（走 onError，区别于 AbortError 的用户取消）。
 * 超时后原 read 仍在挂起，附加空 catch 避免后续流错误成为未处理拒绝。
 */
async function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const read = reader.read()
  read.catch(() => {})
  try {
    return await Promise.race([
      read,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('流式响应超时')), SSE_IDLE_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * SSE 流式调用（spec §5.5）：POST + text/event-stream 解析。
 * 开始前失败（401/403/404/412/500）按 HTTP JSON 错误抛 ApiErrorWithCode（401 同时跳登录）；
 * 流中途失败（含闲置超时）经 onError 事件回调（不再抛异常）。
 * signal 取消即中断（AbortController，AbortError 向上抛由调用方以 isAbortError 识别，不触发 onError）。
 * 解析遵循 SSE 规范：兼容 \n / \r\n 行结束符，多行 data 按 \n 拼接，
 * 事件以空行分界，未显式 event 的行视为默认事件，流结束刷新尾部缓冲。
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
    // 开始前错误：JSON 错误体（401 统一跳登录，与 requestWithPlatform 一致）
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    if (res.status === 401 && typeof window !== 'undefined') {
      handleUnauthorized('portal')
    }
    const err: ApiErrorWithCode = new Error((data as any).error || `HTTP ${res.status}`)
    err.code = (data as any).code
    err.status = res.status
    throw err
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('当前浏览器不支持流式响应')
  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = ''
  let dataLines: string[] = []

  // 一个 SSE 事件完成（空行分界）后派发；无 data 字段则不触发回调
  const dispatch = () => {
    const event = eventType
    const dataStr = dataLines.join('\n')
    eventType = ''
    dataLines = []
    if (!dataStr) return
    let data: unknown
    try {
      data = JSON.parse(dataStr)
    } catch {
      return
    }
    switch (event) {
      case 'meta':
        callbacks.onMeta?.(data as { conversationId: string; messageId: string })
        break
      case 'sources':
        callbacks.onSources?.(data as AIMessageSource[])
        break
      case 'delta':
        callbacks.onDelta?.((data as { text: string }).text)
        break
      case 'done':
        callbacks.onDone?.(data as Record<string, unknown>)
        break
      case 'error':
        callbacks.onError?.(
          (data as { code?: string }).code ?? 'error',
          (data as { message?: string }).message ?? '未知错误',
        )
        break
    }
  }

  // 逐行累积字段：空行派发事件；event/data 按规范解析；注释与未知字段忽略
  const processLine = (line: string) => {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    if (colon === -1) return
    const field = line.slice(0, colon)
    let value = line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    switch (field) {
      case 'event':
        eventType = value
        break
      case 'data':
        dataLines.push(value)
        break
      // id / retry 当前协议不使用，忽略
    }
  }

  try {
    for (;;) {
      const { done, value } = await readWithIdleTimeout(reader)
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 只切到最后一个换行符：尾部残留（含可能被截断的 \r）留待下块，
      // 以正确识别跨 chunk 的 \r\n 行结束符
      const lastLF = buffer.lastIndexOf('\n')
      if (lastLF === -1) continue
      const head = buffer.slice(0, lastLF)
      buffer = buffer.slice(lastLF + 1)
      for (const line of head.split('\n')) {
        processLine(line.endsWith('\r') ? line.slice(0, -1) : line)
      }
    }
    // 流结束：刷新解码器残余与尾部缓冲，再派发未以空行结尾的最后事件
    buffer += decoder.decode()
    for (const line of buffer.split('\n')) {
      processLine(line.endsWith('\r') ? line.slice(0, -1) : line)
    }
    dispatch()
  } catch (err) {
    // 用户主动取消（AbortController）：保留 AbortError 向上抛，
    // 让调用方以 isAbortError 区分取消（不再触发 onError，与调用方既有取消处理兼容）
    if (isAbortError(err)) throw err
    // 流中途传输错误：经 onError 回调（不再抛异常，符合流式调用契约）
    callbacks.onError?.('stream_error', err instanceof Error ? err.message : '网络中断')
  }
}

/** 判断错误是否为主动取消（AbortController），跨环境兼容（不依赖 DOMException 全局） */
function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError'
}

// ==================== v2.2：问答记录 / YIKnow 通用会话 / 智能体预览 ====================

export interface AIKBAsk {
  id: string
  question: string
  answer: string
  createdAt: string
}

export const aiCenterV22Api = {
  /** 我在该库下的提问历史（B6） */
  listMyKBAsks: (kbId: string) =>
    portalRequest<{ items: AIKBAsk[] }>(`/ai/kb/${kbId}/asks`),
  /** 我的 YIKnow 通用会话列表（A1） */
  listYiknowConversations: () =>
    portalRequest<{ items: AIConversation[] }>('/ai/yiknow/conversations'),
  /** 智能体预览试聊（B7，owner 专属，不落库） */
  previewAgent: (agentId: string, systemPrompt: string, message: string) =>
    portalRequest<{ reply: string }>(`/ai/agents/${agentId}/preview`, {
      method: 'POST',
      body: JSON.stringify({ systemPrompt, message }),
    }),
}

/** YIKnow 流式对话（A1，与智能体对话同一 SSE 协议：meta/delta/done/error） */
export async function streamYiknowChat(
  conversationId: string | null,
  message: string,
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return streamAICenter(
    '/ai/yiknow/chat',
    { conversationId: conversationId ?? undefined, message },
    callbacks,
    signal,
  )
}
