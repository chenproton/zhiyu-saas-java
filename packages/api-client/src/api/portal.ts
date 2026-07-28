import type {
  UserExtensionField,
  StaffTitle,
  LoginLog,
  OperationLog,
} from "../types/backend"
import type { WorkspaceDashboard } from "../types/portal"
import { request, portalRequest, buildQuery, ListResponse, CreateUserRequest, UserRelationItem } from "../api-helpers"
import type { User } from "../api-helpers"

export const userManagementApi = {
  list: (params?: { tenantId?: string; roleId?: string; roleCode?: string; orgNodeId?: string; majorId?: string; search?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<User>>(`/users${buildQuery(params || {})}`),
  get: (id: string) => request<User>(`/users/${id}`),
  create: (req: CreateUserRequest) => request<User>("/users", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<CreateUserRequest>) => request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/users/${id}`, { method: "DELETE" }),
  updateStatus: (id: string, status: string) =>
    request<User>(`/users/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  batchCreate: (reqs: CreateUserRequest[]) =>
    request<{ count: number }>("/users/batch", { method: "POST", body: JSON.stringify({ users: reqs }) }),
}

export const portalUserManagementApi = {
  list: (params?: { tenantId?: string; institutionId?: string; roleId?: string; roleCode?: string; orgNodeId?: string; majorId?: string; search?: string; status?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<User>>(`/users${buildQuery(params || {})}`),
  get: (id: string) => portalRequest<User>(`/users/${id}`),
  create: (req: CreateUserRequest) => portalRequest<User>("/users", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<CreateUserRequest>) => portalRequest<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => portalRequest<{ id: string }>(`/users/${id}`, { method: "DELETE" }),
  updateStatus: (id: string, status: string) =>
    portalRequest<User>(`/users/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  resetPassword: (id: string, password: string) =>
    portalRequest<User>(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  bindRoles: (id: string, roleIds: string[]) =>
    portalRequest<User>(`/users/${id}/roles`, { method: "POST", body: JSON.stringify({ roleIds }) }),
  batchCreate: (reqs: CreateUserRequest[]) =>
    portalRequest<{ count: number }>("/users/batch", { method: "POST", body: JSON.stringify({ users: reqs }) }),
  batchGraduate: (req: { userIds: string[]; graduateYear?: number }) =>
    portalRequest<{ count: number }>("/users/batch-graduate", { method: "POST", body: JSON.stringify(req) }),
  batchDelete: (userIds: string[]) =>
    portalRequest<{ count: number }>("/users/batch-delete", { method: "POST", body: JSON.stringify({ userIds }) }),
  batchUpdateOrgNode: (req: { userIds: string[]; orgNodeId?: string }) =>
    portalRequest<{ count: number }>("/users/batch-org-node", { method: "POST", body: JSON.stringify(req) }),
}

export const portalStaffTitleApi = {
  list: (params?: { tenantId?: string; search?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<StaffTitle>>(`/staff-titles${buildQuery(params || {})}`),
  get: (id: string) => portalRequest<StaffTitle>(`/staff-titles/${id}`),
  create: (req: Omit<StaffTitle, "id" | "userCount" | "createdAt">) =>
    portalRequest<StaffTitle>("/staff-titles", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<StaffTitle, "id" | "userCount" | "createdAt">>) =>
    portalRequest<StaffTitle>(`/staff-titles/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => portalRequest<{ id: string }>(`/staff-titles/${id}`, { method: "DELETE" }),
  toggleStatus: (id: string, status: string) =>
    portalRequest<StaffTitle>(`/staff-titles/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}

export const portalUserExtensionFieldApi = {
  list: (params?: { tenantId?: string }) =>
    portalRequest<ListResponse<UserExtensionField>>(`/user-extension-fields${buildQuery(params || {})}`),
  update: (id: string, req: Partial<Omit<UserExtensionField, "id" | "tenantId" | "slotNumber" | "fieldKey" | "fieldType" | "createdAt">>) =>
    portalRequest<UserExtensionField>(`/user-extension-fields/${id}`, { method: "PUT", body: JSON.stringify(req) }),
}

export const portalUserRelationApi = {
  list: (params?: { search?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<UserRelationItem>>(`/user-relations${buildQuery(params || {})}`),
  create: (req: { initiatorId: string; targetId: string; relationType: string; description?: string }) =>
    portalRequest<{ id: string }>("/user-relations", { method: "POST", body: JSON.stringify(req) }),
  delete: (id: string) => portalRequest<{ id: string }>(`/user-relations/${id}`, { method: "DELETE" }),
}

export const portalLogApi = {
  loginLogs: (params?: { tenantId?: string; userId?: string; status?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<LoginLog>>(`/logs/login${buildQuery(params || {})}`),
  operationLogs: (params?: { tenantId?: string; userId?: string; module?: string; action?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<OperationLog>>(`/logs/operation${buildQuery(params || {})}`),
}

export const portalApi = {
  workspaceDashboard: (params?: { role?: string }) =>
    request<WorkspaceDashboard>(`/portal/workspace/dashboard${buildQuery(params || {})}`),
}
