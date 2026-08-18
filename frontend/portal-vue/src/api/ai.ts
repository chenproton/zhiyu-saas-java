import { portalRequest, buildQuery, getToken, handleUnauthorized } from './http';
import type { ListResponse } from './http';
import type { AIAgent, AIKnowledgeBase, AIKBType, AIIntegration, AIAdminOverview } from '@/types/ai';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export interface AIMessageSource {
  docId: string;
  docName: string;
  seq: number;
  snippet: string;
}

export interface AIStreamCallbacks {
  onMeta?: (data: { conversationId: string; messageId: string }) => void;
  onSources?: (sources: AIMessageSource[]) => void;
  onDelta?: (text: string) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (code: string, message: string) => void;
}

// SSE 流式调用（POST + text/event-stream 解析），等价 api-client 的 streamAICenter
export async function streamAICenter(
  path: string,
  body: { conversationId?: string; message: string },
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const token = getToken('portal');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(body),
    signal
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || !contentType.includes('text/event-stream')) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (res.status === 401 && typeof window !== 'undefined') {
      handleUnauthorized('portal');
    }
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('当前浏览器不支持流式响应');
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    const event = eventType;
    const dataStr = dataLines.join('\n');
    eventType = '';
    dataLines = [];
    if (!dataStr) return;
    let data: unknown;
    try {
      data = JSON.parse(dataStr);
    } catch {
      data = dataStr;
    }
    if (event === 'meta' || event === 'message') {
      callbacks.onMeta?.(data as { conversationId: string; messageId: string });
    } else if (event === 'sources') {
      callbacks.onSources?.((data as { sources?: AIMessageSource[] }).sources || []);
    } else if (event === 'delta' || event === 'message') {
      const d = data as { delta?: string; content?: string };
      const text = d.delta ?? d.content ?? '';
      if (text) callbacks.onDelta?.(text);
    } else if (event === 'done') {
      callbacks.onDone?.(data as Record<string, unknown>);
    } else if (event === 'error') {
      const e = data as { code?: string; message?: string };
      callbacks.onError?.(e.code || 'stream_error', e.message || '流式错误');
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        } else if (line === '') {
          dispatch();
        }
      }
    }
    dispatch();
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      callbacks.onError?.('stream_error', (e as Error).message || '网络中断');
    }
  }
}

export function streamYiknowChat(
  conversationId: string | null,
  message: string,
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  return streamAICenter(
    '/ai/yiknow/chat',
    { conversationId: conversationId ?? undefined, message },
    callbacks,
    signal
  );
}

type AgentInput = Partial<Omit<AIAgent, 'id' | 'createdAt' | 'updatedAt'>>;

export const aiCenterAgentApi = {
  listMine: () => portalRequest<{ items: AIAgent[] }>('/ai/agents'),
  create: (body: AgentInput) => portalRequest<AIAgent>('/ai/agents', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: AgentInput) =>
    portalRequest<{ status: string }>(`/ai/agents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) => portalRequest<{ status: string }>(`/ai/agents/${id}`, { method: 'DELETE' })
};

export const aiCenterSquareApi = {
  agents: (params: {
    q?: string;
    sort?: 'hot' | 'new' | 'views';
    page?: number;
    pageSize?: number;
    majorId?: string;
    departmentId?: string;
    updated?: '7d' | '30d' | '180d';
  } = {}) => portalRequest<ListResponse<AIAgent>>(`/ai/square/agents${buildQuery(params as Record<string, string | number | boolean | undefined>)}`),
  kbs: (params: {
    q?: string;
    tag?: string;
    sort?: 'hot' | 'new' | 'updated' | 'docs' | 'views';
    page?: number;
    pageSize?: number;
    majorId?: string;
    departmentId?: string;
    kbType?: AIKBType;
    updated?: '7d' | '30d' | '180d';
  } = {}) => portalRequest<ListResponse<AIKnowledgeBase>>(`/ai/square/kbs${buildQuery(params as Record<string, string | number | boolean | undefined>)}`)
};

export const aiCenterAdminApi = {
  reviews: (params: { type: 'kb' | 'agent'; status?: string; page?: number; pageSize?: number }) =>
    portalRequest<ListResponse<AIAgent | AIKnowledgeBase>>(
      `/ai/admin/reviews${buildQuery(params as Record<string, string | number | boolean | undefined>)}`
    ),
  reviewAction: (type: 'kb' | 'agent', id: string, action: 'approve' | 'reject' | 'takedown', comment?: string) =>
    portalRequest<{ status: string }>(`/ai/admin/reviews/${type}/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ comment: comment ?? '' })
    }),
  overview: () => portalRequest<AIAdminOverview>('/ai/admin/overview'),
  listIntegrations: (kind?: 'agent' | 'app') =>
    portalRequest<{ items: AIIntegration[] }>(`/ai/admin/integrations${buildQuery({ kind })}`),
  createIntegration: (body: Omit<AIIntegration, 'id' | 'status' | 'createdAt'>) =>
    portalRequest<AIIntegration>('/ai/admin/integrations', { method: 'POST', body: JSON.stringify(body) }),
  updateIntegration: (id: string, body: Omit<AIIntegration, 'id' | 'status' | 'createdAt'>) =>
    portalRequest<{ status: string }>(`/ai/admin/integrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
  toggleIntegration: (id: string, status: 'active' | 'inactive') =>
    portalRequest<{ status: string }>(`/ai/admin/integrations/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ status })
    }),
  removeIntegration: (id: string) =>
    portalRequest<{ status: string }>(`/ai/admin/integrations/${id}`, { method: 'DELETE' })
};

export const aiCenterFavoriteApi = {
  status: (targetType: 'ai_kb' | 'ai_agent', id: string) =>
    portalRequest<{ isFavorite: boolean; favoriteCount: number }>(`/favorites/${targetType}/${id}`),
  toggle: (targetType: 'ai_kb' | 'ai_agent', id: string) =>
    portalRequest<{ isFavorite: boolean; favoriteCount: number }>(`/favorites/${targetType}/${id}`, {
      method: 'POST',
      body: '{}'
    })
};

export const aiCenterKbApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    portalRequest<{ items: AIKnowledgeBase[]; total?: number }>(`/ai/kb${buildQuery(params || {})}`),
  create: (body: Partial<AIKnowledgeBase>) =>
    portalRequest<AIKnowledgeBase>('/ai/kb', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => portalRequest<AIKnowledgeBase>(`/ai/kb/${id}`),
  update: (id: string, body: Partial<AIKnowledgeBase>) =>
    portalRequest<{ status: string }>(`/ai/kb/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) => portalRequest<{ status: string }>(`/ai/kb/${id}`, { method: 'DELETE' })
};
