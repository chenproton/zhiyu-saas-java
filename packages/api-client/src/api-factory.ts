import type { ListResponse } from "./api"
import { buildQuery, request } from "./api"

type QueryParams = Record<string, string | number | boolean | undefined>

export function createCrudApi<TItem, TCreate, TUpdate>(prefix: string) {
  return {
    list: (params?: QueryParams) =>
      request<ListResponse<TItem>>(`${prefix}${buildQuery(params || {})}`),
    get: (id: string) =>
      request<TItem>(`${prefix}/${id}`),
    create: (req: TCreate) =>
      request<TItem>(prefix, { method: "POST", body: JSON.stringify(req) }),
    update: (id: string, req: TUpdate) =>
      request<TItem>(`${prefix}/${id}`, { method: "PUT", body: JSON.stringify(req) }),
    delete: (id: string) =>
      request<{ id: string }>(`${prefix}/${id}`, { method: "DELETE" }),
  }
}

export function createContentApi<TItem, TCreate, TUpdate>(prefix: string) {
  return {
    ...createCrudApi<TItem, TCreate, TUpdate>(prefix),
    submit: (id: string) =>
      request<TItem>(`${prefix}/${id}/submit`, { method: "POST" }),
    review: (id: string, req: { status: string; comment?: string }) =>
      request<TItem>(`${prefix}/${id}/review`, { method: "POST", body: JSON.stringify(req) }),
    publish: (id: string) =>
      request<TItem>(`${prefix}/${id}/publish`, { method: "POST" }),
    archive: (id: string) =>
      request<TItem>(`${prefix}/${id}/archive`, { method: "POST" }),
    unpublish: (id: string) =>
      request<TItem>(`${prefix}/${id}/unpublish`, { method: "POST" }),
    withdraw: (id: string) =>
      request<TItem>(`${prefix}/${id}/withdraw`, { method: "POST" }),
    invite: (id: string, userId: string) =>
      request<TItem>(`${prefix}/${id}/invite`, { method: "POST", body: JSON.stringify({ userId }) }),
  }
}
