import type {
  Tenant,
  Organization,
  OrgType,
  Role,
  Major,
  Industry,
  ResourceCode,
  SubscriptionPackage,
  AppModule,
  PlatformLink,
  Workflow,
  ApprovalRecord,
  LoginLog,
  OperationLog,
} from "../types/backend"
import { request, buildQuery, ListResponse } from "../api-helpers"
import { createCrudApi } from "../api-factory"

export const tenantApi = {
  ...createCrudApi<Tenant, Omit<Tenant, "id" | "createdAt" | "updatedAt">, Partial<Omit<Tenant, "id" | "createdAt" | "updatedAt">>>("/tenants"),
  updateStatus: (id: string, status: string) =>
    request<Tenant>(`/tenants/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}

export const orgApi = {
  ...createCrudApi<Organization, Omit<Organization, "id" | "createdAt" | "updatedAt">, Partial<Omit<Organization, "id" | "createdAt" | "updatedAt">>>("/organizations"),
  tree: (params?: { tenantId?: string; typeId?: string }) =>
    request<{ items: (Organization & { children?: (Organization & { children?: any[] })[] })[] }>(`/organizations/tree${buildQuery(params || {})}`),
}

export const orgTypeApi = createCrudApi<OrgType, Omit<OrgType, "id" | "createdAt">, Partial<Omit<OrgType, "id" | "createdAt">>>("/org-types")

export const roleApi = {
  ...createCrudApi<Role, Omit<Role, "id" | "userCount" | "createdAt">, Partial<Omit<Role, "id" | "userCount" | "createdAt">>>("/roles"),
  assign: (id: string, userId: string) =>
    request<Role>(`/roles/${id}/assign`, { method: "POST", body: JSON.stringify({ userId }) }),
}

export const majorApi = createCrudApi<Major, Omit<Major, "id" | "createdAt" | "updatedAt">, Partial<Omit<Major, "id" | "createdAt" | "updatedAt">>>("/majors")

export const industryApi = createCrudApi<Industry, Omit<Industry, "id" | "createdAt" | "updatedAt">, Partial<Omit<Industry, "id" | "createdAt" | "updatedAt">>>("/industries")

export const resourceCodeApi = createCrudApi<ResourceCode, Omit<ResourceCode, "id" | "createdAt">, Partial<Omit<ResourceCode, "id" | "createdAt">>>("/resource-codes")

export const subscriptionApi = {
  get: (tenantId: string) => request<SubscriptionPackage>(`/subscriptions?tenantId=${tenantId}`),
  update: (id: string, req: Partial<Omit<SubscriptionPackage, "id" | "createdAt" | "updatedAt">>) =>
    request<SubscriptionPackage>(`/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(req) }),
}

export const logApi = {
  loginLogs: (params?: { tenantId?: string; userId?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<LoginLog>>(`/logs/login${buildQuery(params || {})}`),
  operationLogs: (params?: { tenantId?: string; userId?: string; module?: string; action?: string; limit?: number; offset?: number }) =>
    request<ListResponse<OperationLog>>(`/logs/operation${buildQuery(params || {})}`),
}

export const workflowApi = createCrudApi<Workflow, Omit<Workflow, "id" | "usageCount" | "createdAt">, Partial<Omit<Workflow, "id" | "usageCount" | "createdAt">>>("/workflows")

export const approvalApi = {
  list: (params?: { targetType?: string; targetId?: string; status?: string; submitterId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ApprovalRecord>>(`/approvals${buildQuery(params || {})}`),
  get: (id: string) => request<ApprovalRecord>(`/approvals/${id}`),
  create: (req: { targetType: string; targetId: string; workflowId?: string }) =>
    request<ApprovalRecord>("/approvals", { method: "POST", body: JSON.stringify(req) }),
  review: (id: string, req: { status: "approved" | "rejected"; comment?: string; stepIdx?: number }) =>
    request<ApprovalRecord>(`/approvals/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action: req.status, remark: req.comment, nextStepIdx: req.stepIdx }),
    }),
}

export const platformLinkApi = {
  list: () => request<ListResponse<PlatformLink>>("/platform-links"),
  get: (id: string) => request<PlatformLink>(`/platform-links/${id}`),
  create: (req: Omit<PlatformLink, "id">) =>
    request<PlatformLink>("/platform-links", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<PlatformLink, "id">>) =>
    request<PlatformLink>(`/platform-links/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/platform-links/${id}`, { method: "DELETE" }),
}

export const appModuleApi = {
  list: (params?: { platform?: string }) =>
    request<ListResponse<AppModule>>(`/app-modules${buildQuery(params || {})}`),
}
