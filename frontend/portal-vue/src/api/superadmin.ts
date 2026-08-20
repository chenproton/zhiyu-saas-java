// 超管控制台数据通道（对齐原 React 版 superadmin/page.tsx）。
// 全部走 SaaS 平台 token（saasRequest），请求前缀 /admin/tenants 对应 Java SuperAdminController；
// 主题公开读取走 SettingsController 的 /settings/theme。
import { saasRequest, buildQuery } from './http';
import type { ListResponse } from './http';

export type TenantType = 'school' | 'enterprise';
export type TenantStatus = 'active' | 'inactive';
export type AdminKind = 'school' | 'enterprise';

export interface AdminTenant {
  id: string;
  name: string;
  code: string;
  type?: TenantType;
  logoUrl?: string;
  domain?: string;
  enterpriseCode?: string;
  contact?: string;
  phone?: string;
  address?: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  adminIds?: string[];
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

/** 超管视角的企业主体信息（GET /admin/tenants/{id}/enterprise） */
export interface AdminEnterpriseProfile {
  id: string;
  tenantId: string;
  name: string;
  unifiedSocialCreditCode?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  description?: string;
  enablePublic: boolean;
}

export interface TenantAdmin {
  id: string;
  tenantId: string;
  username: string;
  loginName?: string;
  name: string;
  status: string;
  newPassword?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface SubscriptionPackage {
  id: string;
  tenantId?: string;
  name?: string;
  validUntil?: string;
  modules?: Record<string, unknown>;
  status?: string;
}

export interface CaptchaData {
  captchaId: string;
  image: string;
}

export interface SaasUserView {
  id?: string;
  username?: string;
  name?: string;
  loginName?: string;
  roleCodes?: string[];
  [key: string]: unknown;
}

export interface SaasLoginResponse {
  token: string;
  user: SaasUserView;
  [key: string]: unknown;
}

export interface CreateTenantResponse {
  tenant?: AdminTenant;
  adminUser?: { username?: string; initialPassword?: string };
  [key: string]: unknown;
}

// 平台模块清单（对齐 React navigation-config platformModuleDefs 的一级 key + label，
// 用于订阅套餐模块勾选）。
export interface PlatformModuleDef {
  id: string;
  label: string;
}

export const PLATFORM_MODULES: PlatformModuleDef[] = [
  { id: 'system', label: '系统管理' },
  { id: 'career', label: '职业岗位学习平台' },
  { id: 'scene', label: '实践场景学习平台' },
  { id: 'course', label: '数字课程服务平台' },
  { id: 'ability', label: '能力评价与测评资源管理平台' },
  { id: 'resource', label: '教学资源共享服务平台' },
  { id: 'affairs', label: '教务管理服务平台' },
  { id: 'alliance', label: '产教融合与就业服务平台' },
  { id: 'opc', label: 'OPC专区' },
  { id: 'decision', label: '敏捷决策中心' },
  { id: 'research', label: '教科研服务中心' }
];

const TENANTS_API = '/admin/tenants';

function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return saasRequest<T>(`${TENANTS_API}${path}`, options);
}

function adminBase(tenantId: string, kind: AdminKind): string {
  return kind === 'enterprise' ? `/${tenantId}/enterprise-admins` : `/${tenantId}/admins`;
}

export const superAdminApi = {
  // ---- 租户 ----
  listTenants: (params: { search?: string; type: TenantType; limit: number; offset: number }) =>
    adminFetch<ListResponse<AdminTenant>>(
      `${buildQuery({
        search: params.search || undefined,
        type: params.type,
        limit: params.limit,
        offset: params.offset
      })}`
    ),
  createTenant: (req: Record<string, unknown>) =>
    adminFetch<CreateTenantResponse>('', { method: 'POST', body: JSON.stringify(req) }),
  updateTenant: (id: string, req: Record<string, unknown>) =>
    adminFetch<AdminTenant>(`/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  updateStatus: (id: string, status: TenantStatus) =>
    adminFetch<AdminTenant>(`/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  deleteTenant: (id: string) =>
    adminFetch<Record<string, string>>(`/${id}`, { method: 'DELETE' }),
  getEnterprise: (id: string) =>
    adminFetch<{ tenant: AdminTenant; enterprise: AdminEnterpriseProfile }>(`/${id}/enterprise`),
  updateEnterprise: (id: string, req: Record<string, unknown>) =>
    adminFetch<AdminEnterpriseProfile>(`/${id}/enterprise`, { method: 'PUT', body: JSON.stringify(req) }),

  // ---- 订阅套餐 ----
  getSubscription: (tenantId: string) => adminFetch<SubscriptionPackage>(`/${tenantId}/subscription`),
  updateSubscription: (tenantId: string, req: { modules: Record<string, boolean> }) =>
    adminFetch<SubscriptionPackage>(`/${tenantId}/subscription`, { method: 'PUT', body: JSON.stringify(req) }),

  // ---- 管理员（学校 / 企业）----
  listAdmins: (tenantId: string, kind: AdminKind) =>
    adminFetch<ListResponse<TenantAdmin>>(`${adminBase(tenantId, kind)}`),
  createAdmin: (tenantId: string, kind: AdminKind, req: { username: string; name: string }) =>
    adminFetch<TenantAdmin>(`${adminBase(tenantId, kind)}`, { method: 'POST', body: JSON.stringify(req) }),
  updateAdmin: (tenantId: string, kind: AdminKind, adminId: string, req: { username: string; name: string }) =>
    adminFetch<TenantAdmin>(`${adminBase(tenantId, kind)}/${adminId}`, { method: 'PUT', body: JSON.stringify(req) }),
  deleteAdmin: (tenantId: string, kind: AdminKind, adminId: string) =>
    adminFetch<Record<string, string>>(`${adminBase(tenantId, kind)}/${adminId}`, { method: 'DELETE' }),
  resetAdminPassword: (tenantId: string, kind: AdminKind, adminId: string, password: string) =>
    adminFetch<Record<string, string>>(`${adminBase(tenantId, kind)}/${adminId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password })
    }),

  // ---- 主题色 ----
  getPlatformTheme: () => saasRequest<{ primary?: string }>('/admin/settings/theme'),
  updatePlatformTheme: (primary: string) =>
    saasRequest<{ primary?: string }>('/admin/settings/theme', { method: 'PUT', body: JSON.stringify({ primary }) }),
  updateTenantTheme: (tenantId: string, primary: string) =>
    adminFetch<Record<string, string>>(`/${tenantId}/settings/theme`, {
      method: 'PUT',
      body: JSON.stringify({ primary })
    }),
  deleteTenantTheme: (tenantId: string) =>
    adminFetch<Record<string, string>>(`/${tenantId}/settings/theme`, { method: 'DELETE' })
};

// ---- SaaS 认证 ----
export const saasAuthApi = {
  saasLogin: (req: {
    username: string;
    password: string;
    deviceId?: string;
    captchaId?: string;
    captchaCode?: string;
  }) => saasRequest<SaasLoginResponse>('/auth/saas/login', { method: 'POST', body: JSON.stringify(req) }),
  captcha: () => saasRequest<CaptchaData>('/auth/captcha', { method: 'GET' })
};

// ==================== 主题工具（对齐 React lib/theme-brand.ts） ====================

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const BRAND_COLOR_KEY = 'zhiyu-brand-color';

export const DEFAULT_BRAND_COLOR = '#4862e4';

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function cacheKey(tenantId?: string): string {
  return tenantId ? `${BRAND_COLOR_KEY}-${tenantId}` : BRAND_COLOR_KEY;
}

export function applyBrandColor(color: string, tenantId?: string): void {
  if (!isHexColor(color) || typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--brand', color);
  try {
    localStorage.setItem(cacheKey(tenantId), color);
  } catch {
    // 忽略隐私模式等场景下的存储失败
  }
}

export function getCachedBrandColor(tenantId?: string): string {
  if (typeof window === 'undefined') return DEFAULT_BRAND_COLOR;
  try {
    const keys = tenantId ? [cacheKey(tenantId), BRAND_COLOR_KEY] : [BRAND_COLOR_KEY];
    for (const key of keys) {
      const cached = localStorage.getItem(key);
      if (cached && isHexColor(cached)) return cached;
    }
  } catch {
    // 忽略存储读取失败
  }
  return DEFAULT_BRAND_COLOR;
}

export async function fetchThemeColor(tenantId?: string): Promise<string> {
  try {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await fetch(`${API_BASE}/settings/theme${query}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return getCachedBrandColor(tenantId);
    const data = (await res.json()) as { primary?: string };
    return data.primary && isHexColor(data.primary) ? data.primary : DEFAULT_BRAND_COLOR;
  } catch {
    return getCachedBrandColor(tenantId);
  }
}

// ==================== 设备标识 / JWT 解析（对齐 React lib/api + api-client device.ts） ====================

const DEVICE_ID_KEY = 'zhiyu-device-id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/** 解析 JWT payload（仅本地读取角色/字段做展示与守卫，签名校验由后端完成）。 */
export function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1];
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
