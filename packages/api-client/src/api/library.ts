import type {
  ResourceLibraryItem,
  OnSiteQuestionLibraryItem,
} from "../types/library"
import { request, buildQuery, ListResponse } from "../api-helpers"

export const resourceLibraryApi = {
  list: (params?: { search?: string; resourceType?: string; uploadedBy?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ResourceLibraryItem>>(`/library/resources${buildQuery(params || {})}`),
  get: (id: string) => request<ResourceLibraryItem>(`/library/resources/${id}`),
  create: (req: Omit<ResourceLibraryItem, "id" | "tenantId" | "createdAt" | "updatedAt">) =>
    request<ResourceLibraryItem>("/library/resources", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<ResourceLibraryItem, "id" | "tenantId" | "createdAt" | "updatedAt">>) =>
    request<ResourceLibraryItem>(`/library/resources/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/library/resources/${id}`, { method: "DELETE" }),
}

export const onSiteQuestionLibraryApi = {
  list: (params?: { search?: string; questionType?: string; difficulty?: string; creatorId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<OnSiteQuestionLibraryItem>>(`/library/on-site-questions${buildQuery(params || {})}`),
  get: (id: string) => request<OnSiteQuestionLibraryItem>(`/library/on-site-questions/${id}`),
  create: (req: Omit<OnSiteQuestionLibraryItem, "id" | "tenantId" | "createdAt" | "updatedAt">) =>
    request<OnSiteQuestionLibraryItem>("/library/on-site-questions", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<OnSiteQuestionLibraryItem, "id" | "tenantId" | "createdAt" | "updatedAt">>) =>
    request<OnSiteQuestionLibraryItem>(`/library/on-site-questions/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/library/on-site-questions/${id}`, { method: "DELETE" }),
}
