import type {
  ResourceLibraryItem,
  OnSiteQuestionLibraryItem,
  TagItem,
  TagResourceType,
  ResourceTagRelation,
} from '../types/library'
import { request, buildQuery, ListResponse } from '../api-helpers'

export const resourceLibraryApi = {
  list: (params?: {
    search?: string
    resourceType?: string
    uploadedBy?: string
    tagIds?: string
    limit?: number
    offset?: number
  }) => request<ListResponse<ResourceLibraryItem>>(`/library/resources${buildQuery(params || {})}`),
  stats: (params?: { search?: string }) =>
    request<{ items: { resourceType: string; count: number }[] }>(
      `/library/resources/stats${buildQuery(params || {})}`,
    ),
  get: (id: string) => request<ResourceLibraryItem>(`/library/resources/${id}`),
  create: (req: Omit<ResourceLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) =>
    request<ResourceLibraryItem>('/library/resources', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  previewImport: (names: string[], resourceType: string) =>
    request<ListResponse<ResourceLibraryItem>>('/library/resources/import/preview', {
      method: 'POST',
      body: JSON.stringify({ names, resourceType }),
    }),
  update: (
    id: string,
    req: Partial<Omit<ResourceLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  ) =>
    request<ResourceLibraryItem>(`/library/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) => request<{ id: string }>(`/library/resources/${id}`, { method: 'DELETE' }),
}

export const onSiteQuestionLibraryApi = {
  list: (params?: {
    search?: string
    questionType?: string
    difficulty?: string
    creatorId?: string
    limit?: number
    offset?: number
  }) =>
    request<ListResponse<OnSiteQuestionLibraryItem>>(
      `/library/on-site-questions${buildQuery(params || {})}`,
    ),
  get: (id: string) => request<OnSiteQuestionLibraryItem>(`/library/on-site-questions/${id}`),
  create: (req: Omit<OnSiteQuestionLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) =>
    request<OnSiteQuestionLibraryItem>('/library/on-site-questions', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (
    id: string,
    req: Partial<Omit<OnSiteQuestionLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  ) =>
    request<OnSiteQuestionLibraryItem>(`/library/on-site-questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/library/on-site-questions/${id}`, { method: 'DELETE' }),
}

// 标签管理（标签 CRUD + 资源绑定维护）
export const tagApi = {
  list: () => request<{ items: TagItem[] }>(`/library/tags`),
  create: (req: { name: string; color: string }) =>
    request<TagItem>('/library/tags', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: { name: string; color: string }) =>
    request<TagItem>(`/library/tags/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/library/tags/${id}`, { method: 'DELETE' }),
  setBindings: (req: { resourceType: TagResourceType; resourceId: string; tagIds: string[] }) =>
    request<{ ok: boolean }>('/library/resource-tags', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  queryBindings: (req: { resourceType: TagResourceType; resourceIds: string[] }) =>
    request<{ items: ResourceTagRelation[] }>('/library/resource-tags/query', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
}
