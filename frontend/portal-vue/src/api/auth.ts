import { request } from './http';

// 精简类型：完整 shared-types 移植在 Phase 0 types 步骤补全，此处仅登录/me 所需最小集。
export interface LoginRequest {
  username: string;
  password: string;
  captchaId?: string;
  captchaCode?: string;
  deviceId?: string;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  loginName?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: unknown;
}

export interface TenantOption {
  tenantId: string;
  tenantName: string;
  userId: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  needsTenantSelection?: boolean;
  preAuthToken?: string;
  tenants?: TenantOption[];
}

export interface CaptchaData {
  captchaId: string;
  image: string;
}

export interface MeResponse {
  user: User;
  [key: string]: unknown;
}

export const authApi = {
  portalLogin: (req: LoginRequest) =>
    request<LoginResponse>('/auth/portal/login', { method: 'POST', body: JSON.stringify(req) }),
  portalMe: () => request<MeResponse>('/auth/portal/me'),
  captcha: () => request<CaptchaData>('/auth/captcha', { method: 'GET' }),
  selectTenant: (req: { preAuthToken: string; tenantId: string }) =>
    request<LoginResponse>('/auth/select-tenant', { method: 'POST', body: JSON.stringify(req) })
};
