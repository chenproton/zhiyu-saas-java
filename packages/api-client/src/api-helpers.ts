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
  SystemCourseNode as BackendSystemCourseNode,
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
import type { SystemCourseNode } from "./types/lesson-source"
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
import type {
  ResourceLibraryItem,
  OnSiteQuestionLibraryItem,
} from "./types/library"
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
  creditHoursRatio?: number
}

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

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const defaultPlatform = getDefaultPlatform()
  const platform = defaultPlatform === "portal" || isPortalPath() ? "portal" : "saas"
  const token = getToken(platform)
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (!(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> || {}) },
  })

  if (res.status === 401 && typeof window !== "undefined" && token) {
    localStorage.removeItem(TOKEN_KEYS[platform as keyof typeof TOKEN_KEYS])
    const loginPath = platform === "portal" ? "/portal/login" : "/login"
    if (!window.location.pathname.startsWith(loginPath)) {
      window.location.href = loginPath
    }
  }
  return res
}

export { authedFetch }

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
