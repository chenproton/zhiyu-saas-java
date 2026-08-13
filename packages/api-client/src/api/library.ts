import type {
  ResourceLibraryItem,
  OnSiteQuestionLibraryItem,
  TagItem,
  TagResourceType,
  ResourceTagRelation,
} from '../types/library'
import type { CitationStats, UncitedItem } from '../types/citation'
import { request, buildQuery, ListResponse } from '../api-helpers'
import { createCrudApi } from '../api-factory'

export const resourceLibraryApi = {
  ...createCrudApi<
    ResourceLibraryItem,
    Omit<ResourceLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<ResourceLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
  >('/library/resources'),
  stats: (params?: { search?: string }) =>
    request<{ items: { resourceType: string; count: number }[] }>(
      `/library/resources/stats${buildQuery(params || {})}`,
    ),
  citationStats: (params?: { resourceType?: string }) =>
    request<CitationStats>(`/library/resources/citation-stats${buildQuery(params || {})}`),
  uncited: (params?: {
    resourceType?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) =>
    request<ListResponse<UncitedItem>>(`/library/resources/uncited${buildQuery(params || {})}`),
  previewImport: (names: string[], resourceType: string) =>
    request<ListResponse<ResourceLibraryItem>>('/library/resources/import/preview', {
      method: 'POST',
      body: JSON.stringify({ names, resourceType }),
    }),
}

export const onSiteQuestionLibraryApi = createCrudApi<
  OnSiteQuestionLibraryItem,
  Omit<OnSiteQuestionLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<OnSiteQuestionLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
>('/library/on-site-questions')

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
