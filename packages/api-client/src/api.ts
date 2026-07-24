import type {
  Tenant,
  Organization,
  OrgType,
  Role,
  UserExtensionField,
  UserRelation,
  StaffTitle,
  LoginLog,
  OperationLog,
  Major,
  Industry,
  ResourceCode,
  SubscriptionPackage,
  AppModule,
  PlatformLink,
  Workflow,
  ApprovalRecord,
} from "./types/backend"
import type {
  CareerPosition,
  PositionCertificate,
  CertificateLibraryItem,
  PositionResponsibility,
  AbilityPoint,
  PositionAbilityBinding,
  AbilityDomain,
  JobBatch,
  PositionRecommendation,
  BannerConfig,
  LearnRoad,
} from "./types/job"
import type {
  Scenario,
  ScenarioTask,
  TaskDeliverable,
  TaskEvaluationMethod,
  TaskEvalPoint,
  TaskReviewStep,
  RubricTemplate,
  TaskResource,
  TaskResourceBinding,
  TaskKnowledgeBinding,
  TaskAbilityBinding,
  ScenarioWeightConfig,
  ScenarioGradeMapping,
  SceneArchive,
  SceneBatch,
} from "./types/scene"
import type {
  Course,
  KnowledgePoint,
  SystemCourseNode,
  NodeQuiz,
  NodeQuizQuestion,
  NodeHomework,
  HybridNodeModule,
  NodeResource,
  CourseKnowledgeBinding,
  LessonBatch,
  LessonBehaviorRecord,
  LessonBehaviorAggregate,
} from "./types/lesson"
import type {
  QuestionBank,
  Question,
  Exam,
  ExamQuestion,
  ExamUsage,
  ExamResult,
  EvaluationMethodCategory,
  EvaluationMethod,
  SceneEvaluationResult,
  JobAbilityResult,
  CertificationRule,
  CertificationAbilityItem,
  CertificationAbilityPoint,
  CertificationRelatedTask,
  StudentAbilityPortrait,
  StudentAbilityArchive,
  GraduationProjectTopic,
  GraduationProjectArchive,
  GraduationProjectEvaluation,
  GraduationQueryResult,
  MicroCertTemplate,
  CertIssuanceRecord,
  CreditConversionRule,
  AppealRecord,
  EvaluationBatch,
  RandomDrawQuestion,
} from "./types/evaluation"
import type { WorkspaceDashboard } from "./types/portal"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1"

function getCurrentOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin
  }
  return ""
}

export function getMarketplaceBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MARKETPLACE_URL) {
    return process.env.NEXT_PUBLIC_MARKETPLACE_URL
  }
  const origin = getCurrentOrigin()
  if (origin.includes(":3020")) return origin.replace(":3020", ":3010")
  if (origin.includes(":3010")) return origin
  return "http://localhost:3010"
}

export function getEduBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_EDU_URL) {
    return process.env.NEXT_PUBLIC_EDU_URL
  }
  const origin = getCurrentOrigin()
  if (origin.includes(":3010")) return origin.replace(":3010", ":3020")
  if (origin.includes(":3020")) return origin
  return "http://localhost:3020"
}

export interface ApiError {
  error: string
}

export interface UploadResponse {
  url: string
  name: string
  size: number
  mimeType: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
  needsTenantSelection?: boolean
  preAuthToken?: string
  tenants?: TenantOption[]
}

export interface TenantOption {
  tenantId: string
  tenantName: string
  userId: string
}

export interface SelectTenantRequest {
  preAuthToken: string
  tenantId: string
}

export interface User {
  id: string
  tenantId?: string
  institutionId?: string
  orgNodeId?: string
  majorId?: string
  role: "school" | "enterprise" | "operator"
  platform: "saas" | "portal"
  roleIds?: string[]
  roleCodes?: string[]
  roleNames?: string[]
  loginName?: string
  username: string
  name: string
  email: string
  phone?: string
  avatarUrl?: string
  studentNo?: string
  workId?: string
  idCard?: string
  titleIds?: string[]
  oauth?: Record<string, any>
  status: string
  graduateYear?: number
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface MeResponse {
  user: User
  institution?: Institution
  tenant?: import("./types/backend").Tenant
  orgNode?: import("./types/backend").Organization
  major?: import("./types/backend").Major
  roles?: import("./types/backend").Role[]
}

export type InstitutionStatus = "pending" | "approved" | "disabled"

export interface Institution {
  id: string
  type: "school" | "enterprise"
  name: string
  creditCode: string
  logo?: string
  intro: string
  contactName: string
  contactPhone: string
  contactEmail: string
  qualificationFile?: string
  expertiseTags: string[]
  status: InstitutionStatus
  orgCode: string
  balance: number
  totalSpent: number
  totalIncome: number
  createdAt: string
  updatedAt: string
}

export interface ResourceTag {
  id?: string
  resourceId?: string
  tagType: "major" | "industry" | "level" | "difficulty"
  tagValue: string
}

export interface Resource {
  id: string
  institutionId: string
  name: string
  intro: string
  category: string
  coverImage?: string
  attachment?: string
  attachmentName?: string
  price: number
  version: string
  status: "draft" | "reviewing" | "rejected" | "pending_publish" | "published" | "offlined"
  rejectReason?: string
  salesCount: number
  tags?: ResourceTag[]
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  orderNo: string
  buyerId: string
  sellerId: string
  resourceId: string
  price: number
  platformFee: number
  sellerIncome: number
  status: "pending" | "paid" | "cancelled" | "refunded"
  paidAt?: string
  createdAt: string
}

export interface OrderDetail {
  order: Order
  buyer: Institution
  seller: Institution
  resource: Resource
  authorization?: Authorization
}

export interface Authorization {
  id: string
  orderId: string
  buyerId: string
  resourceId: string
  authCode: string
  status: number
  createdAt: string
  resourceName?: string
  sellerName?: string
}

export interface Banner {
  id: string
  title: string
  image: string
  link: string
  sort: number
  enabled: boolean
}

export interface Withdrawal {
  id: string
  institutionId: string
  amount: number
  accountType: string
  accountInfo: string
  status: "pending" | "approved" | "paid" | "rejected"
  handledAt?: string
  createdAt: string
}

export interface DashboardStats {
  totalInstitutions: number
  schoolCount: number
  enterpriseCount: number
  pendingInstitutions: number
  totalResources: number
  publishedResources: number
  reviewingResources: number
  totalGMV: number
  monthlyGMV: number
  totalOrders: number
  pendingWithdrawals: number
}

export interface PlatformConfig {
  platformFeeRate: number
  minWithdrawalAmount: number
}

export interface ListResponse<T> {
  items: T[]
  total: number
}

export type AuthPlatform = "saas" | "portal"

const TOKEN_KEYS: Record<AuthPlatform, string> = {
  saas: "zhiyu-token",
  portal: "zhiyu-portal-token",
}

function getDefaultPlatform(): AuthPlatform {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEFAULT_PLATFORM) {
    return process.env.NEXT_PUBLIC_DEFAULT_PLATFORM as AuthPlatform
  }
  return "saas"
}

export function getToken(platform?: AuthPlatform): string | null {
  if (typeof window === "undefined") return null
  const p = platform ?? getDefaultPlatform()
  return localStorage.getItem(TOKEN_KEYS[p])
}

export function isPortalPath(path?: string): boolean {
  if (typeof window === "undefined") return false
  const p = path ?? window.location.pathname
  return p.startsWith("/portal")
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // SaaS 页面使用 saas token；Portal 页面（包括工作台和系统管理）使用 portal token。
  // 这样即使浏览器同时存在两种 token，也不会因 token 污染导致 401。
  // 在 monorepo 多应用场景下，可通过 NEXT_PUBLIC_DEFAULT_PLATFORM 为整个应用指定默认平台。
  const defaultPlatform = getDefaultPlatform()
  const platform = defaultPlatform === "portal" || isPortalPath() ? "portal" : "saas"
  return requestWithPlatform<T>(platform, path, options)
}

export async function portalRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>("portal", path, options)
}

async function requestWithPlatform<T>(platform: AuthPlatform, path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`
  const token = getToken(platform)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({ error: "请求失败" }))

  if (!res.ok) {
    // 仅在确实携带了 token 时才把 401 视为会话过期：
    // 未登录状态下的请求（如登录页上各数据 Provider 的预加载）返回 401
    // 不应清 token 或跳转登录页，否则会在 /login 上形成无限重载循环。
    if (res.status === 401 && typeof window !== "undefined" && token) {
      localStorage.removeItem(TOKEN_KEYS[platform])
      const loginPath = platform === "portal" ? "/portal/login" : "/login"
      if (!window.location.pathname.startsWith(loginPath)) {
        window.location.href = loginPath
      }
    }
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data as T
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      qs.append(key, String(value))
    }
  }
  const s = qs.toString()
  return s ? `?${s}` : ""
}

import { createCrudApi, createContentApi } from "./api-factory"

// ==================== Core APIs (unchanged) ====================

export const authApi = {
  login: (req: LoginRequest) => request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(req) }),
  saasLogin: (req: LoginRequest) => request<LoginResponse>("/auth/saas/login", { method: "POST", body: JSON.stringify(req) }),
  portalLogin: (req: LoginRequest) => portalRequest<LoginResponse>("/auth/portal/login", { method: "POST", body: JSON.stringify(req) }),
  selectTenant: (req: SelectTenantRequest) => request<LoginResponse>("/auth/select-tenant", { method: "POST", body: JSON.stringify(req) }),
  me: () => request<MeResponse>("/auth/me"),
  saasMe: () => request<MeResponse>("/auth/saas/me"),
  portalMe: () => portalRequest<MeResponse>("/auth/portal/me"),
}

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

export function setToken(token: string, platform?: AuthPlatform) {
  if (typeof window !== "undefined") {
    const p = platform ?? getDefaultPlatform()
    localStorage.setItem(TOKEN_KEYS[p], token)
  }
}

export function removeToken(platform?: AuthPlatform) {
  if (typeof window !== "undefined") {
    const p = platform ?? getDefaultPlatform()
    localStorage.removeItem(TOKEN_KEYS[p])
  }
}


// ==================== Phase 1: Unified backend management APIs ====================

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

export interface CreateUserRequest {
  tenantId?: string
  institutionId?: string
  roleId: string
  orgNodeId?: string
  majorId?: string
  role: "school" | "enterprise" | "operator"
  platform?: "saas" | "portal"
  loginName: string
  username?: string
  password: string
  name: string
  email?: string
  phone?: string
  avatarUrl?: string
  studentNo?: string
  workId?: string
  idCard?: string
  titleIds?: string[]
  status?: string
}

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
    request<{ count: number }>("/users/batch", { method: "POST", body: JSON.stringify({ items: reqs }) }),
}

// Portal-scoped variants: use the portal JWT so school-internal admin pages stay
// decoupled from the SaaS login token.
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
    portalRequest<{ count: number }>("/users/batch", { method: "POST", body: JSON.stringify({ items: reqs }) }),
  batchGraduate: (req: { userIds: string[]; graduateYear?: number }) =>
    portalRequest<{ count: number }>("/users/batch-graduate", { method: "POST", body: JSON.stringify(req) }),
  batchDelete: (userIds: string[]) =>
    portalRequest<{ count: number }>("/users/batch-delete", { method: "POST", body: JSON.stringify({ userIds }) }),
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

export interface UserRelationItem {
  id: string
  initiatorId: string
  initiatorName: string
  initiatorDept: string
  targetId: string
  targetName: string
  targetDept: string
  relationType: string
  createdAt: string
}

export const portalUserRelationApi = {
  list: (params?: { search?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<UserRelationItem>>(`/user-relations${buildQuery(params || {})}`),
  create: (req: { initiatorId: string; targetId: string; relationType: string; description?: string }) =>
    portalRequest<{ id: string }>("/user-relations", { method: "POST", body: JSON.stringify(req) }),
  delete: (id: string) => portalRequest<{ id: string }>(`/user-relations/${id}`, { method: "DELETE" }),
}

export const roleApi = {
  ...createCrudApi<Role, Omit<Role, "id" | "userCount" | "createdAt">, Partial<Omit<Role, "id" | "userCount" | "createdAt">>>("/roles"),
  assign: (id: string, userIds: string[]) =>
    request<Role>(`/roles/${id}/assign`, { method: "POST", body: JSON.stringify({ userIds }) }),
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

export const portalLogApi = {
  loginLogs: (params?: { tenantId?: string; userId?: string; status?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<LoginLog>>(`/logs/login${buildQuery(params || {})}`),
  operationLogs: (params?: { tenantId?: string; userId?: string; module?: string; action?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<OperationLog>>(`/logs/operation${buildQuery(params || {})}`),
}

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

// ==================== Phase 3.2: Job APIs ====================

// Public read-only views for unauthenticated students.
export const publicPositionApi = createCrudApi<CareerPosition, never, never>("/job/public/positions")

export const positionApi = {
  ...createContentApi<CareerPosition, Omit<CareerPosition, "id" | "createdAt" | "updatedAt">, Partial<Omit<CareerPosition, "id" | "createdAt" | "updatedAt">>>("/job/positions"),
  clone: (id: string, body?: { name?: string }) =>
    request<CareerPosition>(`/job/positions/${id}/clone`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  saveFull: (id: string, req: {
    batchId: string
    name: string
    shortName: string
    industry: string
    majors: string[]
    positionType: string
    salaryRange: [number, number]
    coverImage?: string
    description?: string
    requirements: string[]
    careerPath?: string
    version: string
    collaborators: string[]
    responsibilities: { id: string; name: string; description?: string }[]
    certificates: { id: string; name: string; url?: string; description?: string; image?: string }[]
    abilityBindings: {
      id: string
      responsibilityId: string
      source: string
      publicAbilityId?: string
      abilityPointId?: string
      name: string
      category: string
      level: string
      rubricDescription?: string
      description?: string
      attributes?: string[]
      domain?: string
    }[]
    abilityDomains: { id: string; name: string; description?: string; bindingIds: string[] }[]
  }) => request<{ position: CareerPosition }>(`/job/positions/${id}/save-full`, { method: "PUT", body: JSON.stringify(req) }),
  getFavorite: (id: string) => request<{ isFavorite: boolean; favoriteCount: number }>(`/job/positions/${id}/favorite`),
  favorite: (id: string) => request<{ isFavorite: boolean; favoriteCount: number }>(`/job/positions/${id}/favorite`, { method: "POST" }),
  listFavorites: () => request<ListResponse<CareerPosition>>("/job/positions/favorites"),
}

export const abilityApi = {
  list: (params?: { category?: string; isPublic?: boolean; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<AbilityPoint>>(`/job/abilities${buildQuery(params || {})}`),
  get: (id: string) => request<AbilityPoint>(`/job/abilities/${id}`),
  create: (req: Omit<AbilityPoint, "id" | "createdAt">) =>
    request<AbilityPoint>("/job/abilities", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<AbilityPoint, "id" | "createdAt">>) =>
    request<AbilityPoint>(`/job/abilities/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/job/abilities/${id}`, { method: "DELETE" }),
  listBindings: (params?: { careerPositionId?: string; responsibilityId?: string }) =>
    request<ListResponse<PositionAbilityBinding>>(`/job/position-abilities${buildQuery(params || {})}`),
  createBinding: (req: Omit<PositionAbilityBinding, "id">) =>
    request<PositionAbilityBinding>("/job/position-abilities", { method: "POST", body: JSON.stringify(req) }),
  updateBinding: (id: string, req: Partial<Omit<PositionAbilityBinding, "id">>) =>
    request<PositionAbilityBinding>(`/job/position-abilities/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteBinding: (id: string) => request<{ id: string }>(`/job/position-abilities/${id}`, { method: "DELETE" }),
  listDomains: (careerPositionId: string) =>
    request<ListResponse<AbilityDomain>>(`/job/ability-domains?careerPositionId=${careerPositionId}`),
  createDomain: (req: Omit<AbilityDomain, "id">) =>
    request<AbilityDomain>("/job/ability-domains", { method: "POST", body: JSON.stringify(req) }),
  updateDomain: (id: string, req: Partial<Omit<AbilityDomain, "id">>) =>
    request<AbilityDomain>(`/job/ability-domains/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteDomain: (id: string) => request<{ id: string }>(`/job/ability-domains/${id}`, { method: "DELETE" }),
}

export const positionResponsibilityApi = {
  list: (params?: { careerPositionId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<PositionResponsibility>>(`/job/position-responsibilities${buildQuery(params || {})}`),
  get: (id: string) => request<PositionResponsibility>(`/job/position-responsibilities/${id}`),
  create: (req: Omit<PositionResponsibility, "id">) =>
    request<PositionResponsibility>("/job/position-responsibilities", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<PositionResponsibility, "id">>) =>
    request<PositionResponsibility>(`/job/position-responsibilities/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/job/position-responsibilities/${id}`, { method: "DELETE" }),
}

export const positionCertificateApi = {
  list: (params?: { careerPositionId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<PositionCertificate>>(`/job/position-certificates${buildQuery(params || {})}`),
  get: (id: string) => request<PositionCertificate>(`/job/position-certificates/${id}`),
  create: (req: Omit<PositionCertificate, "id">) =>
    request<PositionCertificate>("/job/position-certificates", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<PositionCertificate, "id">>) =>
    request<PositionCertificate>(`/job/position-certificates/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/job/position-certificates/${id}`, { method: "DELETE" }),
}

export const certificateLibraryApi = {
  list: (params?: { search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<CertificateLibraryItem>>(`/job/certificate-library${buildQuery(params || {})}`),
  get: (id: string) => request<CertificateLibraryItem>(`/job/certificate-library/${id}`),
  create: (req: Omit<CertificateLibraryItem, "id" | "tenantId" | "createdAt">) =>
    request<CertificateLibraryItem>("/job/certificate-library", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<CertificateLibraryItem, "id" | "tenantId" | "createdAt">>) =>
    request<CertificateLibraryItem>(`/job/certificate-library/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/job/certificate-library/${id}`, { method: "DELETE" }),
}

export const batchApi = {
  ...createCrudApi<JobBatch, Omit<JobBatch, "id" | "positionCount" | "publishedCount" | "pendingCount" | "createdAt" | "updatedAt">, Partial<Omit<JobBatch, "id" | "createdAt" | "updatedAt">>>("/job/batches"),
  updateStatus: (id: string, status: string) =>
    request<JobBatch>(`/job/batches/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}

export const recommendApi = createCrudApi<PositionRecommendation, Omit<PositionRecommendation, "id" | "createdAt" | "updatedAt">, Partial<Omit<PositionRecommendation, "id" | "createdAt" | "updatedAt">>>("/job/recommendations")

export const learnRoadApi = createCrudApi<LearnRoad, Omit<LearnRoad, "id" | "createdAt" | "updatedAt">, Partial<Omit<LearnRoad, "id" | "createdAt" | "updatedAt">>>("/job/learn-roads")

export const jobBannerApi = createCrudApi<BannerConfig, Omit<BannerConfig, "id" | "createdAt" | "updatedAt">, Partial<Omit<BannerConfig, "id" | "createdAt" | "updatedAt">>>("/job/banners")

// ==================== Phase 3.3: Scene APIs ====================

export const scenarioApi = {
  ...createContentApi<Scenario, Omit<Scenario, "id" | "createdAt" | "updatedAt">, Partial<Omit<Scenario, "id" | "createdAt" | "updatedAt">>>("/scene/scenarios"),
  clone: (id: string, body?: { name?: string; code?: string }) =>
    request<Scenario>(`/scene/scenarios/${id}/clone`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
}

export const taskApi = {
  list: (params?: { scenarioId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ScenarioTask>>(`/scene/tasks${buildQuery(params || {})}`),
  get: (id: string) => request<ScenarioTask>(`/scene/tasks/${id}`),
  create: (req: Omit<ScenarioTask, "id">) =>
    request<ScenarioTask>("/scene/tasks", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<ScenarioTask, "id">>) =>
    request<ScenarioTask>(`/scene/tasks/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/scene/tasks/${id}`, { method: "DELETE" }),
  reorder: (scenarioId: string, taskIds: string[]) =>
    request<{ ok: boolean }>("/scene/tasks/reorder", { method: "POST", body: JSON.stringify({ scenarioId, taskIds }) }),
}

export const sceneBatchApi = {
  ...createCrudApi<SceneBatch, Omit<SceneBatch, "id" | "createdAt" | "updatedAt">, Partial<Omit<SceneBatch, "id" | "createdAt" | "updatedAt">>>("/scene/batches"),
  updateStatus: (id: string, status: string) =>
    request<SceneBatch>(`/scene/batches/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}

export const taskResourceApi = {
  listResources: (params?: { taskId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<TaskResource>>(`/scene/task-resources${buildQuery(params || {})}`),
  create: (req: Omit<TaskResource, "id" | "uploadedAt">) =>
    request<TaskResource>("/scene/task-resources/create", { method: "POST", body: JSON.stringify(req) }),
  bindResource: (data: { taskId: string; resourceId: string }) =>
    request<TaskResourceBinding>(`/scene/task-resources`, { method: "POST", body: JSON.stringify(data) }),
  unbindResource: (id: string) =>
    request<{ id: string }>(`/scene/task-resources/${id}`, { method: "DELETE" }),
}

export const taskKnowledgeAbilityApi = {
  bindKnowledge: (data: { taskId: string; knowledgePointId: string }) =>
    request<TaskKnowledgeBinding>(`/scene/task-bindings/knowledge`, { method: "POST", body: JSON.stringify(data) }),
  unbindKnowledge: (id: string) =>
    request<{ id: string }>(`/scene/task-bindings/knowledge/${id}`, { method: "DELETE" }),
  bindAbility: (data: { taskId: string; abilityPointId: string }) =>
    request<TaskAbilityBinding>(`/scene/task-bindings/ability`, { method: "POST", body: JSON.stringify(data) }),
  unbindAbility: (id: string) =>
    request<{ id: string }>(`/scene/task-bindings/ability/${id}`, { method: "DELETE" }),
}

export const taskEvaluationApi = {
  listMethods: (taskId: string) =>
    request<{ methods: TaskEvaluationMethod[] }>(`/scene/tasks/${taskId}/evaluation-methods`),
  saveMethods: (taskId: string, data: { methods: any[] }) =>
    request<{ methods: TaskEvaluationMethod[] }>(`/scene/tasks/${taskId}/evaluation-methods`, { method: "PUT", body: JSON.stringify(data) }),

  listTemplates: (params?: { limit?: number; offset?: number; keyword?: string }) =>
    request<{ items: RubricTemplate[]; total: number }>(`/scene/rubric-templates${buildQuery(params || {})}`),
  getTemplate: (id: string) =>
    request<RubricTemplate>(`/scene/rubric-templates/${id}`),
  createTemplate: (data: { name: string; mode: string; types?: string[]; description?: string; data: Record<string, any> }) =>
    request<RubricTemplate>(`/scene/rubric-templates`, { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: { name: string; mode: string; types?: string[]; description?: string; data: Record<string, any> }) =>
    request<RubricTemplate>(`/scene/rubric-templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    request<{ id: string }>(`/scene/rubric-templates/${id}`, { method: "DELETE" }),
}

export const scenarioWeightApi = {
  listWeights: (params?: { scenarioId?: string; taskId?: string; limit?: number; offset?: number }) =>
    request<{ items: ScenarioWeightConfig[]; total: number }>(`/scene/weights${buildQuery(params || {})}`),
  upsertWeight: (data: Partial<ScenarioWeightConfig>) =>
    request<ScenarioWeightConfig>(`/scene/weights`, { method: "POST", body: JSON.stringify(data) }),
}

export const scenarioGradeApi = {
  listGradeMappings: (params?: { scenarioId?: string; taskId?: string; limit?: number; offset?: number }) =>
    request<{ items: ScenarioGradeMapping[]; total: number }>(`/scene/grade-mappings${buildQuery(params || {})}`),
  upsertGradeMapping: (data: Partial<ScenarioGradeMapping>) =>
    request<ScenarioGradeMapping>(`/scene/grade-mappings`, { method: "POST", body: JSON.stringify(data) }),
  deleteGradeMapping: (id: string) =>
    request<{ id: string }>(`/scene/grade-mappings/${id}`, { method: "DELETE" }),
}

// ==================== Phase 3.4: Lesson APIs ====================

export const courseApi = createContentApi<Course, Omit<Course, "id" | "nodeCount" | "resourceCount" | "studyCount" | "createdAt" | "updatedAt">, Partial<Omit<Course, "id" | "createdAt" | "updatedAt">>>("/lesson/courses")

export const knowledgeApi = createCrudApi<KnowledgePoint, Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt">, Partial<Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt">>>("/lesson/knowledge-points")

export const courseNodeApi = {
  ...createCrudApi<SystemCourseNode, Omit<SystemCourseNode, "id" | "createdAt" | "updatedAt">, Partial<Omit<SystemCourseNode, "id" | "createdAt" | "updatedAt">>>("/lesson/nodes"),
  reorder: (courseId: string, nodeIds: string[]) =>
    request<{ ok: boolean }>("/lesson/nodes/reorder", { method: "POST", body: JSON.stringify({ courseId, nodeIds }) }),
}

export const lessonBatchApi = {
  ...createCrudApi<LessonBatch, Omit<LessonBatch, "id" | "createdAt" | "updatedAt">, Partial<Omit<LessonBatch, "id" | "createdAt" | "updatedAt">>>("/lesson/batches"),
  updateStatus: (id: string, status: string) =>
    request<LessonBatch>(`/lesson/batches/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}

export const lessonBehaviorApi = {
  aggregate: (params: { courseId: string; startDate?: string; endDate?: string }) =>
    request<LessonBehaviorAggregate>(`/lesson/behavior-collection/aggregate${buildQuery(params)}`),
  create: (req: Omit<LessonBehaviorRecord, "id" | "createdAt" | "updatedAt">) =>
    request<LessonBehaviorRecord>("/lesson/behavior-collection/records", { method: "POST", body: JSON.stringify(req) }),
}

export const fileApi = {
  upload: async (file: File): Promise<UploadResponse> => {
    const form = new FormData()
    form.append("file", file)
    const token = getToken()
    const headers: HeadersInit = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/files/upload`, { method: "POST", body: form, headers })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
}

export const importExportApi = {
  export: (entity: string) => {
    const token = getToken()
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    return fetch(`${API_BASE}/export/${entity}`, { headers })
  },
  import: async (entity: string, file: File): Promise<{ created: number; failed: number; entity: string }> => {
    const form = new FormData()
    form.append("file", file)
    const token = getToken()
    const headers: HeadersInit = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/import/${entity}`, { method: "POST", body: form, headers })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
  importExcel: async (entity: string, file: File): Promise<{
    created: number; failed: number; skipped: number; entity: string;
    positionCreated?: number; responsibilities?: number; abilityBindings?: number;
    scenarioCreated?: number; taskCreated?: number;
  }> => {
    const form = new FormData()
    form.append("file", file)
    const token = getToken()
    const headers: HeadersInit = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/import/${entity}/excel`, { method: "POST", body: form, headers })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
  downloadTemplate: (entity: "positions" | "scenarios") => {
    const token = getToken()
    return fetch(`${API_BASE}/templates/${entity}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
  exportScenariosExcel: (ids: string[]) => {
    const token = getToken()
    return fetch(`${API_BASE}/export/scenarios/excel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids }),
    })
  },
  exportPositionsExcel: (ids: string[]) => {
    const token = getToken()
    return fetch(`${API_BASE}/export/positions/excel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids }),
    })
  },
}

export const portalApi = {
  workspaceDashboard: (params?: { role?: string }) =>
    request<WorkspaceDashboard>(`/portal/workspace/dashboard${buildQuery(params || {})}`),
}

// ==================== Phase 3.5: Evaluation APIs ====================

export const questionBankApi = createContentApi<QuestionBank, Omit<QuestionBank, "id" | "questionCount" | "createdAt" | "updatedAt">, Partial<Omit<QuestionBank, "id" | "questionCount" | "createdAt" | "updatedAt">>>("/evaluation/question-banks")

export const questionApi = {
  ...createCrudApi<Question, Omit<Question, "id" | "createdAt">, Partial<Omit<Question, "id" | "createdAt">>>("/evaluation/questions"),
  batchCreate: (bankId: string, items: Omit<Question, "id" | "bankId" | "createdAt">[]) =>
    request<{ count: number }>("/evaluation/questions/batch", { method: "POST", body: JSON.stringify({ bankId, items }) }),
}

export const randomDrawQuestionApi = createCrudApi<
  RandomDrawQuestion,
  Omit<RandomDrawQuestion, "id" | "createdAt" | "updatedAt">,
  Partial<Omit<RandomDrawQuestion, "id" | "createdAt" | "updatedAt">>
>("/evaluation/random-draw-questions")

export const examApi = {
  ...createContentApi<Exam, Omit<Exam, "id" | "totalScore" | "createdAt" | "updatedAt">, Partial<Omit<Exam, "id" | "totalScore" | "createdAt" | "updatedAt">>>("/evaluation/exams"),
  addQuestion: (id: string, questionId: string, score: number) =>
    request<Exam>(`/evaluation/exams/${id}/questions`, { method: "POST", body: JSON.stringify({ questionId, score }) }),
  removeQuestion: (id: string, questionId: string) =>
    request<Exam>(`/evaluation/exams/${id}/questions/${questionId}`, { method: "DELETE" }),
  updateQuestionScore: (examId: string, questionId: string, score: number) =>
    request<Exam>(`/evaluation/exams/${examId}/questions/${questionId}`, { method: "PUT", body: JSON.stringify({ score }) }),
  updateQuestionScores: (examId: string, scores: Record<string, number>) =>
    request<Exam>(`/evaluation/exams/${examId}/questions/scores`, { method: "PUT", body: JSON.stringify(scores) }),
  publish: (id: string) => request<Exam>(`/evaluation/exams/${id}/publish`, { method: "POST" }),
}

export const examUsageApi = {
  list: (params?: { examId?: string; status?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ExamUsage>>(`/evaluation/exam-usages${buildQuery(params || {})}`),
  get: (id: string) => request<ExamUsage>(`/evaluation/exam-usages/${id}`),
  create: (req: Omit<ExamUsage, "id" | "createdAt" | "updatedAt">) =>
    request<ExamUsage>("/evaluation/exam-usages", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<ExamUsage, "id" | "createdAt" | "updatedAt">>) =>
    request<ExamUsage>(`/evaluation/exam-usages/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/evaluation/exam-usages/${id}`, { method: "DELETE" }),
  start: (id: string) => request<ExamUsage>(`/evaluation/exam-usages/${id}/start`, { method: "POST" }),
  finish: (id: string) => request<ExamUsage>(`/evaluation/exam-usages/${id}/finish`, { method: "POST" }),
}

export const examResultApi = {
  list: (params?: { usageId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ExamResult>>(`/evaluation/exam-results${buildQuery(params || {})}`),
  submit: (req: { examUsageId: string; answers: Record<string, string | string[]> }) =>
    request<ExamResult>("/evaluation/exam-results", { method: "POST", body: JSON.stringify(req) }),
}

export const evaluationResultApi = {
  list: (params?: { taskId?: string; sceneId?: string; evaluateeId?: string; methodKey?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<SceneEvaluationResult>>(`/evaluation/results${buildQuery(params || {})}`),
  get: (id: string) => request<SceneEvaluationResult>(`/evaluation/results/${id}`),
  submit: (req: { taskId: string; sceneId?: string; methodKey: string; evaluateeId: string; maxScore?: number; objectiveAnswers?: Record<string, any>; subjectiveContent?: Record<string, any>; drawnQuestions?: Record<string, any>; evalPointScores?: Record<string, any> }) =>
    request<SceneEvaluationResult>("/evaluation/results", { method: "POST", body: JSON.stringify(req) }),
  grade: (id: string, req: { score: number; evalPointScores?: Record<string, any>; comment?: string }) =>
    request<SceneEvaluationResult>(`/evaluation/results/${id}/grade`, { method: "POST", body: JSON.stringify(req) }),
  batchGrade: (items: { id: string; score: number; evalPointScores?: Record<string, any>; comment?: string }[]) =>
    request<{ count: number }>("/evaluation/results/batch-grade", { method: "POST", body: JSON.stringify({ items }) }),
}

export interface CertificationFullRuleItem {
  id: string
  name: string
  sortOrder: number
  abilityName?: string
  points: CertificationFullPoint[]
}

export interface CertificationFullPoint {
  id: string
  name: string
  description: string
  mappingType: string
  customLevelMapping?: any[]
  requiredLevel: string
  weight: number
  tasks?: CertificationRelatedTask[]
}

export interface CertificationFullRuleResponse {
  rule: CertificationRule
  items: CertificationFullRuleItem[]
}

export const certApi = {
  listRules: (params?: { careerPositionId?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<CertificationRule>>(`/evaluation/certifications${buildQuery(params || {})}`),
  getRule: (id: string) => request<CertificationRule>(`/evaluation/certifications/${id}`),
  createRule: (req: Omit<CertificationRule, "id" | "createdAt" | "updatedAt">) =>
    request<CertificationRule>("/evaluation/certifications", { method: "POST", body: JSON.stringify(req) }),
  updateRule: (id: string, req: Partial<Omit<CertificationRule, "id" | "createdAt" | "updatedAt">>) =>
    request<CertificationRule>(`/evaluation/certifications/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteRule: (id: string) => request<{ id: string }>(`/evaluation/certifications/${id}`, { method: "DELETE" }),
  listItems: (ruleId: string) => request<ListResponse<CertificationAbilityItem>>(`/evaluation/certifications/${ruleId}/items`),
  upsertItem: (ruleId: string, req: Partial<CertificationAbilityItem>) =>
    request<CertificationAbilityItem>(`/evaluation/certifications/${ruleId}/items`, { method: "POST", body: JSON.stringify(req) }),
  deleteItem: (id: string) => request<{ id: string }>(`/evaluation/certifications/items/${id}`, { method: "DELETE" }),
  getFullRule: (id: string) => request<CertificationFullRuleResponse>(`/evaluation/certifications/${id}/full`),
}

export interface LandingExamItem {
  id: string
  name: string
  status: string
  type: string
  time: string
  duration: number
  questionCount: number
  description: string
  college: string
  major: string
  targetAudience: string
}

export interface CompItem {
  name: string
  target: number
  current: number
  desc: string
}

export interface CompGroup {
  duty: string
  items: CompItem[]
}

export interface LeaderboardEntry {
  id: string
  studentName: string
  className: string
  major: string
  achievementRate: number
  grade: string
}

export interface CertGradeData {
  totalPoints: number
  avgRate: number
  lastUpdated: string
  compData: CompGroup[]
  leaderboard: LeaderboardEntry[]
}

export const landingApi = {
  listExams: (params?: { search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<LandingExamItem>>(`/evaluation/landing/exams${buildQuery(params || {})}`),
  getCertGrades: (positionId: string) =>
    request<{ grades: Record<string, CertGradeData> }>(`/evaluation/landing/certifications/${positionId}/grades`),
}

export const graduationApi = {
  listTopics: (params?: { careerPositionId?: string; status?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationProjectTopic>>(`/evaluation/graduation/topics${buildQuery(params || {})}`),
  getTopic: (id: string) => request<GraduationProjectTopic>(`/evaluation/graduation/topics/${id}`),
  createTopic: (req: Omit<GraduationProjectTopic, "id" | "appliedCount" | "createdAt">) =>
    request<GraduationProjectTopic>("/evaluation/graduation/topics", { method: "POST", body: JSON.stringify(req) }),
  updateTopic: (id: string, req: Partial<Omit<GraduationProjectTopic, "id" | "appliedCount" | "createdAt">>) =>
    request<GraduationProjectTopic>(`/evaluation/graduation/topics/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteTopic: (id: string) => request<{ id: string }>(`/evaluation/graduation/topics/${id}`, { method: "DELETE" }),
  applyTopic: (id: string) => request<GraduationProjectTopic>(`/evaluation/graduation/topics/${id}/apply`, { method: "POST" }),
  listArchives: (params?: { topicId?: string; userId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationProjectArchive>>(`/evaluation/graduation/archives${buildQuery(params || {})}`),
  upsertArchive: (req: Partial<GraduationProjectArchive>) =>
    request<GraduationProjectArchive>("/evaluation/graduation/archives", { method: "POST", body: JSON.stringify(req) }),
  listEvaluations: (params?: { topicId?: string; userId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationProjectEvaluation>>(`/evaluation/graduation/evaluations${buildQuery(params || {})}`),
  upsertEvaluation: (req: Partial<GraduationProjectEvaluation>) =>
    request<GraduationProjectEvaluation>("/evaluation/graduation/evaluations", { method: "POST", body: JSON.stringify(req) }),
  queryResults: (params?: { userId?: string; className?: string; majorName?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationQueryResult>>(`/evaluation/graduation/query${buildQuery(params || {})}`),
}

export const portraitApi = {
  list: (params?: { userId?: string; careerPositionId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<StudentAbilityPortrait>>(`/evaluation/portraits${buildQuery(params || {})}`),
  get: (id: string) => request<StudentAbilityPortrait>(`/evaluation/portraits/${id}`),
  generate: (userId: string, careerPositionId: string) =>
    request<StudentAbilityPortrait>("/evaluation/portraits/generate", { method: "POST", body: JSON.stringify({ userId, careerPositionId }) }),
  listArchives: (params?: { userId?: string; materialType?: string; limit?: number; offset?: number }) =>
    request<ListResponse<StudentAbilityArchive>>(`/evaluation/portraits/archives${buildQuery(params || {})}`),
  upsertArchive: (req: Partial<StudentAbilityArchive>) =>
    request<StudentAbilityArchive>("/evaluation/portraits/archives", { method: "POST", body: JSON.stringify(req) }),
}

export const microCertApi = {
  listTemplates: (params?: { search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<MicroCertTemplate>>(`/evaluation/certificates/templates${buildQuery(params || {})}`),
  createTemplate: (req: Omit<MicroCertTemplate, "id" | "createdAt" | "updatedAt">) =>
    request<MicroCertTemplate>("/evaluation/certificates/templates", { method: "POST", body: JSON.stringify(req) }),
  updateTemplate: (id: string, req: Partial<Omit<MicroCertTemplate, "id" | "createdAt" | "updatedAt">>) =>
    request<MicroCertTemplate>(`/evaluation/certificates/templates/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteTemplate: (id: string) => request<{ id: string }>(`/evaluation/certificates/templates/${id}`, { method: "DELETE" }),
  issue: (templateId: string, userIds: string[]) =>
    request<{ count: number }>("/evaluation/certificates/issue", { method: "POST", body: JSON.stringify({ templateId, userIds }) }),
  listHistory: (params?: { userId?: string; templateId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<CertIssuanceRecord>>(`/evaluation/certificates/history${buildQuery(params || {})}`),
}

export const evaluationMethodApi = {
  listCategories: () => request<ListResponse<EvaluationMethodCategory>>("/evaluation/methods/categories"),
  listMethods: (params?: { categoryId?: string; enabled?: boolean }) =>
    request<ListResponse<EvaluationMethod>>(`/evaluation/methods${buildQuery(params || {})}`),
  toggle: (id: string, enabled: boolean) =>
    request<EvaluationMethod>(`/evaluation/methods/${id}/toggle`, { method: "POST", body: JSON.stringify({ enabled }) }),
}

export const appealApi = {
  list: (params?: { userId?: string; type?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<AppealRecord>>(`/evaluation/appeals${buildQuery(params || {})}`),
  get: (id: string) => request<AppealRecord>(`/evaluation/appeals/${id}`),
  create: (req: Omit<AppealRecord, "id" | "status" | "createdAt">) =>
    request<AppealRecord>("/evaluation/appeals", { method: "POST", body: JSON.stringify(req) }),
  process: (id: string, req: { status: string; remark?: string }) =>
    request<AppealRecord>(`/evaluation/appeals/${id}/process`, { method: "POST", body: JSON.stringify(req) }),
}

export const evaluationBatchApi = {
  ...createCrudApi<EvaluationBatch, Omit<EvaluationBatch, "id" | "createdAt" | "updatedAt">, Partial<Omit<EvaluationBatch, "id" | "createdAt" | "updatedAt">>>("/evaluation/batches"),
  updateStatus: (id: string, status: string) =>
    request<EvaluationBatch>(`/evaluation/batches/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}
