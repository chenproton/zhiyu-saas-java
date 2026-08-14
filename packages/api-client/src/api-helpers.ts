const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

type ApiErrorHandler = (message: string, status: number, path: string, code?: string) => void
let globalErrorHandler: ApiErrorHandler | null = null

export function setGlobalErrorHandler(handler: ApiErrorHandler | null) {
  globalErrorHandler = handler
}

/** 带后端统一错误码的 API 错误（code 字段，见后端 handler/error_codes.go）。 */
export interface ApiErrorWithCode extends Error {
  code?: string
  status?: number
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
  captchaId?: string
  captchaCode?: string
  /** 持久化设备标识：新设备登录后端要求验证码，常用设备免验证码 */
  deviceId?: string
}

/** 字符验证码数据（GET /auth/captcha）。 */
export interface CaptchaData {
  captchaId: string
  image: string
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

// User 的权威定义在 @zhiyu/shared-types（shared-models.ts），此处仅 re-export 以保持既有导入路径
import type { User } from '../../shared-types/src/shared-models'
export type { User }

export interface MeResponse {
  user: User
  institution?: Institution
  tenant?: import('./types/backend').Tenant
  orgNode?: import('./types/backend').Organization
  major?: import('./types/backend').Major
  roles?: import('./types/backend').Role[]
}

export type InstitutionStatus = 'pending' | 'approved' | 'disabled'

export interface Institution {
  id: string
  type: 'school' | 'enterprise'
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

export interface CreateUserRequest {
  tenantId?: string
  institutionId?: string
  roleId: string
  orgNodeId?: string
  majorId?: string
  role: 'school' | 'enterprise' | 'operator'
  platform?: 'saas' | 'portal'
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

export type AuthPlatform = 'saas' | 'portal' | 'partner'

const TOKEN_KEYS: Record<AuthPlatform, string> = {
  saas: 'zhiyu-token',
  portal: 'zhiyu-portal-token',
  partner: 'zhiyu-partner-token',
}

function getDefaultPlatform(): AuthPlatform {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_PLATFORM) {
    return process.env.NEXT_PUBLIC_DEFAULT_PLATFORM as AuthPlatform
  }
  // edu 应用（管理后台）所有页面都面向 portal 用户（学校/教师/学生），
  // 默认使用 portal token，避免 /portal 登录后跳转到 /job、/scene 等模块时因 token 不一致被踢回登录页。
  return 'portal'
}

export function getToken(platform?: AuthPlatform): string | null {
  if (typeof window === 'undefined') return null
  const p = platform ?? getDefaultPlatform()
  return localStorage.getItem(TOKEN_KEYS[p])
}

// handleUnauthorized 统一处理 401：清除对应平台 token 并跳转登录页。
// requestWithPlatform 与 authedFetch 共用，避免登录跳转逻辑双份维护漂移。
function handleUnauthorized(platform: AuthPlatform): void {
  localStorage.removeItem(TOKEN_KEYS[platform])
  const loginPath =
    platform === 'portal' ? '/portal/login' : platform === 'partner' ? '/partner/login' : '/login'
  if (!window.location.pathname.startsWith(loginPath)) {
    window.location.href = loginPath
  }
}

export function isPortalPath(path?: string): boolean {
  if (typeof window === 'undefined') return false
  const p = path ?? window.location.pathname
  return p.startsWith('/portal')
}

export function isPartnerPath(path?: string): boolean {
  if (typeof window === 'undefined') return false
  const p = path ?? window.location.pathname
  return p.startsWith('/partner')
}

/** 依据当前路由段解析请求应使用的平台 token（partner 独立 token 体系） */
function resolvePlatform(): AuthPlatform {
  if (isPartnerPath()) return 'partner'
  const defaultPlatform = getDefaultPlatform()
  return defaultPlatform === 'portal' || isPortalPath() ? 'portal' : 'saas'
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>(resolvePlatform(), path, options)
}

export async function portalRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>('portal', path, options)
}

export async function partnerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>('partner', path, options)
}

export async function saasRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>('saas', path, options)
}

async function requestWithPlatform<T>(
  platform: AuthPlatform,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`
  const token = getToken(platform)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // 客户端超时：网络挂起时不让 UI 无限等待（后端超时 30s，前端放宽到 40s）
  const signal = options.signal ?? AbortSignal.timeout(40_000)
  const res = await fetch(url, { ...options, headers, signal })
  // chunked 响应无 content-length，按 Content-Type 判断响应体是否 JSON，
  // 避免非 JSON 成功响应被 json().catch 兜底成 {error:'请求失败'} 当作业务数据
  const contentType = res.headers.get('content-type') || ''
  const hasBody = res.status !== 204 && contentType.includes('application/json')
  const data = hasBody ? await res.json().catch(() => ({ error: '请求失败' })) : ({} as T)

  if (!res.ok) {
    const errorMessage = (data as any).error || `HTTP ${res.status}`
    const err: ApiErrorWithCode = new Error(errorMessage)
    err.code = (data as any).code
    err.status = res.status
    if (res.status === 401 && typeof window !== 'undefined') {
      handleUnauthorized(platform)
    } else if (globalErrorHandler) {
      globalErrorHandler(errorMessage, res.status, path, err.code)
    }
    throw err
  }

  return data as T
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      qs.append(key, String(value))
    }
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** 触发浏览器下载 Blob 文件 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    a.remove()
    window.URL.revokeObjectURL(url)
  }, 1000)
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const platform = resolvePlatform()
  const token = getToken(platform)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) || {}) },
  })

  if (res.status === 401 && typeof window !== 'undefined') {
    handleUnauthorized(platform)
  }
  return res
}

export { authedFetch }

export function setToken(token: string, platform?: AuthPlatform) {
  if (typeof window !== 'undefined') {
    const p = platform ?? getDefaultPlatform()
    localStorage.setItem(TOKEN_KEYS[p], token)
  }
}

export function removeToken(platform?: AuthPlatform) {
  if (typeof window !== 'undefined') {
    const p = platform ?? getDefaultPlatform()
    localStorage.removeItem(TOKEN_KEYS[p])
  }
}
