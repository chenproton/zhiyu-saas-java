export * from "./api-helpers"
export * from "./api/auth"
export * from "./api/job"
export * from "./api/scene"
export * from "./api/lesson"
export * from "./api/evaluation"
export * from "./api/library"
export * from "./api/import-export"
export * from "./api/portal"

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
} from "./types/backend"
import { request, buildQuery, ListResponse, Institution, Resource, Order, OrderDetail, Authorization, Banner, Withdrawal, DashboardStats, PlatformConfig } from "./api-helpers"
import { createCrudApi } from "./api-factory"

export const institutionApi = {
  list: (params?: { status?: string; type?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<Institution>>(`/institutions${buildQuery(params || {})}`),
  get: (id: string) => request<Institution>(`/institutions/${id}`),
  create: (req: Omit<Institution, "id" | "balance" | "totalSpent" | "totalIncome" | "status" | "createdAt" | "updatedAt">) =>
    request<Institution>("/institutions", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<Institution, "id" | "status" | "createdAt" | "updatedAt" | "balance" | "totalSpent" | "totalIncome">>) =>
    request<Institution>(`/institutions/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  approve: (id: string) => request<Institution>(`/institutions/${id}/approve`, { method: "POST" }),
  disable: (id: string) => request<Institution>(`/institutions/${id}/disable`, { method: "POST" }),
}

export const resourceApi = {
  list: (params?: { status?: string; category?: string; institutionId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<Resource>>(`/resources${buildQuery(params || {})}`),
  get: (id: string) => request<Resource>(`/resources/${id}`),
  create: (req: Partial<Resource>) => request<Resource>("/resources", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Resource>) => request<Resource>(`/resources/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/resources/${id}`, { method: "DELETE" }),
  submit: (id: string) => request<Resource>(`/resources/${id}/submit`, { method: "POST" }),
  review: (id: string, req: { status: "pending_publish" | "rejected"; rejectReason?: string }) =>
    request<Resource>(`/resources/${id}/review`, { method: "POST", body: JSON.stringify(req) }),
  publish: (id: string) => request<Resource>(`/resources/${id}/publish`, { method: "POST" }),
  offline: (id: string) => request<Resource>(`/resources/${id}/offline`, { method: "POST" }),
  incrementView: (id: string) => request<{ id: string }>(`/resources/${id}/view`, { method: "POST" }),
}

export const orderApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<Order>>(`/orders${buildQuery(params || {})}`),
  get: (id: string) => request<OrderDetail>(`/orders/${id}`),
  create: (resourceId: string) => request<OrderDetail>("/orders", { method: "POST", body: JSON.stringify({ resourceId }) }),
  pay: (id: string) => request<OrderDetail>(`/orders/${id}/pay`, { method: "POST" }),
  listAuthorizations: () => request<ListResponse<Authorization>>("/authorizations"),
  verifyAuthorization: (code: string) => request<Authorization>(`/authorizations/${code}`),
}

export const bannerApi = {
  list: () => request<ListResponse<Banner>>("/banners"),
  create: (req: Omit<Banner, "id">) => request<Banner>("/banners", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Omit<Banner, "id">) => request<Banner>(`/banners/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/banners/${id}`, { method: "DELETE" }),
}

export const withdrawalApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<Withdrawal>>(`/withdrawals${buildQuery(params || {})}`),
  create: (req: { amount: number; accountType: string; accountInfo: string }) =>
    request<Withdrawal>("/withdrawals", { method: "POST", body: JSON.stringify(req) }),
  updateStatus: (id: string, status: string) =>
    request<Withdrawal>(`/withdrawals/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}

export const statsApi = {
  dashboard: () => request<DashboardStats>("/stats/dashboard"),
  me: () => request<{ balance: number; totalIncome: number; totalSpent: number }>("/stats/me"),
}

export const configApi = {
  get: () => request<PlatformConfig>("/config"),
  update: (req: PlatformConfig) => request<PlatformConfig>("/config", { method: "PUT", body: JSON.stringify(req) }),
}

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
