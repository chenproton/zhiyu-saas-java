import { request, portalRequest } from '../api-helpers'
import type {
  LoginRequest,
  LoginResponse,
  SelectTenantRequest,
  MeResponse,
  CaptchaData,
} from '../api-helpers'

export const authApi = {
  login: (req: LoginRequest) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(req) }),
  saasLogin: (req: LoginRequest) =>
    request<LoginResponse>('/auth/saas/login', { method: 'POST', body: JSON.stringify(req) }),
  portalLogin: (req: LoginRequest) =>
    portalRequest<LoginResponse>('/auth/portal/login', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  captcha: () => request<CaptchaData>('/auth/captcha', { method: 'GET' }),
  selectTenant: (req: SelectTenantRequest) =>
    request<LoginResponse>('/auth/select-tenant', { method: 'POST', body: JSON.stringify(req) }),
  me: () => request<MeResponse>('/auth/me'),
  saasMe: () => request<MeResponse>('/auth/saas/me'),
  portalMe: () => portalRequest<MeResponse>('/auth/portal/me'),
}
