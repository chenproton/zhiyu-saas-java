import { request, buildQuery, ListResponse, Institution, Resource, Order, OrderDetail, Authorization, Banner, Withdrawal, DashboardStats, PlatformConfig } from "../api-helpers"

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
