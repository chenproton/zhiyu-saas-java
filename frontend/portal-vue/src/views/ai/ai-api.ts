// 门户 AI 应用中心本地 API 封装（只读扩展，不修改 api/*.ts）。
// 补齐 api/ai.ts 缺失的端点（智能体详情/提交/下架/会话、知识库文档/协作者/提交/下架、
// 广场第三方服务、问答历史/智能体预览/YIKnow 会话、收藏列表），全部直连 Go/Java 共用后端契约。
// 复用 api/ai.ts 已提供的：square agents/kbs、admin reviews/overview/integrations、favorites toggle/status、
// streamAICenter/streamYiknowChat；fileApi 复用 api/import-export.ts。
import { portalRequest, request, authedFetch, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { AIAgent, AIKnowledgeBase, AIKBType, AIIntegration } from '@/types/ai';
import { majorApi, organizationApi, orgTypeApi } from '@/api/system';
import { ref } from 'vue';

export {
  aiCenterAgentApi,
  aiCenterKbApi,
  aiCenterSquareApi,
  aiCenterAdminApi,
  aiCenterFavoriteApi,
  streamAICenter,
  streamYiknowChat
} from '@/api/ai';
export { fileApi } from '@/api/import-export';

// ==================== 类型（对齐 React ai-center.ts，补齐 types/ai.ts 缺失） ====================

export type AIContentStatus = 'private' | 'pending' | 'published' | 'rejected';

export interface AIConversation {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessageSource {
  docId: string;
  docName: string;
  seq: number;
  snippet: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: AIMessageSource[];
  createdAt: string;
}

export interface AIKBDocument {
  id: string;
  kbId: string;
  name: string;
  fileSize: number;
  mime: string;
  status: 'parsing' | 'ready' | 'failed';
  error?: string;
  chunkCount: number;
  charCount: number;
  uploaderName?: string;
  createdAt: string;
}

export interface AIKBCollaborator {
  id: string;
  userId: string;
  userName?: string;
  role: 'editor' | 'viewer';
  createdAt: string;
}

export interface AIKBAsk {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

/** 知识库类型文案（对齐 React，types/ai.ts 中的旧标签已弃用） */
export const AI_KB_TYPE_LABELS: Record<AIKBType, string> = {
  course_resource: '课程资源库',
  research: '科研成果库',
  teaching_case: '教学案例库',
  qa: '问答知识库'
};

// ==================== 智能体补充 ====================

export const aiAgentExt = {
  get: (id: string) => portalRequest<AIAgent>(`/ai/agents/${id}`),
  submit: (id: string) =>
    portalRequest<{ status: string; warnings?: string[] }>(`/ai/agents/${id}/submit`, {
      method: 'POST',
      body: '{}'
    }),
  unpublish: (id: string) =>
    portalRequest<{ status: string }>(`/ai/agents/${id}/unpublish`, { method: 'POST', body: '{}' }),
  listConversations: (agentId: string) =>
    portalRequest<{ items: AIConversation[] }>(`/ai/agents/${agentId}/conversations`),
  getConversation: (convId: string) =>
    portalRequest<{ conversation: AIConversation; messages: AIMessage[] }>(
      `/ai/conversations/${convId}`
    ),
  renameConversation: (convId: string, title: string) =>
    portalRequest<{ status: string }>(`/ai/conversations/${convId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    }),
  removeConversation: (convId: string) =>
    portalRequest<{ status: string }>(`/ai/conversations/${convId}`, { method: 'DELETE' })
};

// ==================== 知识库补充 ====================

export const aiKbExt = {
  listMine: (params: { scope?: 'owned' | 'collaborating'; q?: string; page?: number; pageSize?: number } = {}) =>
    portalRequest<ListResponse<AIKnowledgeBase>>(`/ai/kb${buildQuery(params)}`),
  submit: (id: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${id}/submit`, { method: 'POST', body: '{}' }),
  unpublish: (id: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${id}/unpublish`, { method: 'POST', body: '{}' }),
  listDocuments: (kbId: string) =>
    portalRequest<{ items: AIKBDocument[] }>(`/ai/kb/${kbId}/documents`),
  uploadDocument: async (kbId: string, file: File): Promise<AIKBDocument> => {
    const form = new FormData();
    form.append('file', file);
    const res = await authedFetch(`/ai/kb/${kbId}/documents`, { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  removeDocument: (kbId: string, docId: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${kbId}/documents/${docId}`, { method: 'DELETE' }),
  listCollaborators: (kbId: string) =>
    portalRequest<{ items: AIKBCollaborator[] }>(`/ai/kb/${kbId}/collaborators`),
  addCollaborator: (kbId: string, userId: string, role: 'editor' | 'viewer') =>
    portalRequest<{ status: string }>(`/ai/kb/${kbId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    }),
  removeCollaborator: (kbId: string, userId: string) =>
    portalRequest<{ status: string }>(`/ai/kb/${kbId}/collaborators/${userId}`, { method: 'DELETE' })
};

// ==================== 广场 / v2.2 / 收藏 ====================

export const aiSquareExt = {
  integrations: (kind?: 'agent' | 'app') =>
    portalRequest<{ items: AIIntegration[] }>(`/ai/integrations${buildQuery({ kind })}`)
};

export const aiV22Ext = {
  listMyKBAsks: (kbId: string) => portalRequest<{ items: AIKBAsk[] }>(`/ai/kb/${kbId}/asks`),
  listYiknowConversations: () =>
    portalRequest<{ items: AIConversation[] }>('/ai/yiknow/conversations'),
  previewAgent: (agentId: string, systemPrompt: string, message: string) =>
    portalRequest<{ reply: string }>(`/ai/agents/${agentId}/preview`, {
      method: 'POST',
      body: JSON.stringify({ systemPrompt, message })
    })
};

export const aiFavoriteList = {
  list: () =>
    request<{ ai_kb: AIKnowledgeBase[]; ai_agent: AIAgent[]; [k: string]: unknown }>('/favorites')
};

// ==================== 工具函数（对齐 React lib/cover-gradients + format-utils） ====================

export const COVER_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#0e7490,#06b6d4)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#b91c1c,#ef4444)',
  'linear-gradient(135deg,#0f766e,#14b8a6)',
  'linear-gradient(135deg,#4338ca,#818cf8)'
];

export function coverGradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

export function formatDateTime(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isSafeExternalUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isNewContent(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 3600 * 1000;
}

/** AI 中心内容状态标签：private 私有 / pending 审核中 / published 已发布 / rejected 已驳回 */
export function aiStatusLabel(status: string): string {
  if (status === 'private') return '私有';
  if (status === 'pending') return '审核中';
  if (status === 'published') return '已发布';
  if (status === 'rejected') return '已驳回';
  return status;
}

export function aiStatusTagType(status: string): 'info' | 'warning' | 'success' | 'danger' {
  if (status === 'published') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'warning';
  return 'info';
}

// ==================== 分类字典（对齐 React classify-dicts） ====================

export interface DictOption {
  id: string;
  name: string;
}

export function useClassifyDicts() {
  const majors = ref<DictOption[]>([]);
  const departments = ref<DictOption[]>([]);

  async function load() {
    // 专业字典
    try {
      const res = await majorApi.list({ limit: 500 });
      majors.value = (res.items || []).map((m) => ({ id: m.id, name: m.name }));
    } catch {
      /* 忽略 */
    }
    // 院系：优先按类型名匹配「二级学院/院系/系部」，取该类型下组织；找不到则退化为组织树第二级
    try {
      const types = await orgTypeApi.list({ limit: 100 });
      const deptType = (types.items || []).find((t) => /二级学院|院系|系部/.test(t.name));
      if (deptType) {
        const res = await organizationApi.list({ limit: 200, typeId: deptType.id });
        departments.value = (res.items || []).map((o) => ({ id: o.id, name: o.name }));
        return;
      }
      const tree = await organizationApi.tree();
      const roots = tree.items || [];
      const level2 = roots.flatMap((r) => r.children || []);
      departments.value = level2.map((o) => ({ id: o.id, name: o.name }));
    } catch {
      /* 字典加载失败则筛选项为空 */
    }
  }

  load();
  return { majors, departments };
}
