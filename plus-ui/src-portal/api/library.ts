import { createCrudApi, request, buildQuery } from './http';
import type { ListResponse } from './http';
import type {
  ResourceLibraryItem,
  ResourceLibraryCreate,
  ResourceLibraryUpdate,
  TagItem,
  OnSiteQuestionLibraryItem
} from '@/types/library';

export const resourceLibraryApi = {
  ...createCrudApi<ResourceLibraryItem, ResourceLibraryCreate, ResourceLibraryUpdate>(
    '/library/resources'
  ),
  stats: (params?: { search?: string }) =>
    request<{ items: { resourceType: string; count: number }[] }>(
      `/library/resources/stats${buildQuery(params || {})}`
    )
};

export const onSiteQuestionLibraryApi = createCrudApi<
  OnSiteQuestionLibraryItem,
  Partial<Omit<OnSiteQuestionLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<OnSiteQuestionLibraryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
>('/library/on-site-questions');

export const tagApi = {
  list: () => request<{ items: TagItem[] }>('/library/tags'),
  create: (req: { name: string; color: string }) =>
    request<TagItem>('/library/tags', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: { name: string; color: string }) =>
    request<TagItem>(`/library/tags/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/library/tags/${id}`, { method: 'DELETE' }),
  setBindings: (req: { resourceType: string; resourceId: string; tagIds: string[] }) =>
    request<{ ok: boolean }>('/library/resource-tags', { method: 'POST', body: JSON.stringify(req) }),
  queryBindings: (req: { resourceType: string; resourceIds: string[] }) =>
    request<{ items: { resourceId: string; tagId: string }[] }>('/library/resource-tags/query', {
      method: 'POST',
      body: JSON.stringify(req)
    })
};
