// 业务门户请求层 —— 逐字移植 frontend/packages/api-client/src/api-helpers.ts
// 与 Go/Next.js 业务门户共用同一套契约（裸 JSON、{items,total}、/api/v1、Bearer token）。

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export type AuthPlatform = 'saas' | 'portal' | 'partner';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

const TOKEN_KEYS: Record<AuthPlatform, string> = {
  saas: 'zhiyu-token',
  portal: 'zhiyu-portal-token',
  partner: 'zhiyu-partner-token'
};

// Go/Java 双栈共用同一域名，仅路径前缀不同；localStorage 按域名隔离、不按路径隔离，
// 因此 Java 版（/java/ 前缀）使用 -java 后缀的 token key，与 Go 版登录态隔离。
function isJavaPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/java/');
}

function getTokenKey(platform: AuthPlatform): string {
  const base = TOKEN_KEYS[platform];
  return isJavaPath() ? `${base}-java` : base;
}

function getDefaultPlatform(): AuthPlatform {
  if (import.meta.env.VITE_DEFAULT_PLATFORM) {
    return import.meta.env.VITE_DEFAULT_PLATFORM as AuthPlatform;
  }
  return 'portal';
}

export function getToken(platform?: AuthPlatform): string | null {
  if (typeof window === 'undefined') return null;
  const p = platform ?? getDefaultPlatform();
  return localStorage.getItem(getTokenKey(p));
}

export function setToken(token: string, platform?: AuthPlatform) {
  if (typeof window !== 'undefined') {
    const p = platform ?? getDefaultPlatform();
    localStorage.setItem(getTokenKey(p), token);
  }
}

export function removeToken(platform?: AuthPlatform) {
  if (typeof window !== 'undefined') {
    const p = platform ?? getDefaultPlatform();
    localStorage.removeItem(getTokenKey(p));
  }
}

export function isPortalPath(path?: string): boolean {
  if (typeof window === 'undefined') return false;
  const p = path ?? window.location.pathname;
  return p.startsWith('/portal') || p.startsWith('/java/portal');
}

export function isPartnerPath(path?: string): boolean {
  if (typeof window === 'undefined') return false;
  const p = path ?? window.location.pathname;
  return p.startsWith('/partner') || p.startsWith('/java/partner');
}

function resolvePlatform(): AuthPlatform {
  if (isPartnerPath()) return 'partner';
  const defaultPlatform = getDefaultPlatform();
  return defaultPlatform === 'portal' || isPortalPath() ? 'portal' : 'saas';
}

// handleUnauthorized 统一处理 401：清除对应平台 token 并跳转登录页。
export function handleUnauthorized(platform: AuthPlatform): void {
  removeToken(platform);
  const loginPath =
    platform === 'portal' ? '/portal/login' : platform === 'partner' ? '/partner/login' : '/login';
  const prefix = isJavaPath() ? '/java' : '';
  if (!window.location.pathname.startsWith(prefix + loginPath)) {
    window.location.href = prefix + loginPath;
  }
}

async function requestWithPlatform<T>(
  platform: AuthPlatform,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getToken(platform);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const signal = options.signal ?? AbortSignal.timeout(40_000);
  const res = await fetch(url, { ...options, headers, signal });
  const contentType = res.headers.get('content-type') || '';
  const hasBody = res.status !== 204 && contentType.includes('application/json');
  const data = hasBody ? await res.json().catch(() => ({ error: '请求失败' })) : ({} as T);

  if (!res.ok) {
    const errorMessage = (data as { error?: string }).error || `HTTP ${res.status}`;
    if (res.status === 401 && typeof window !== 'undefined') {
      handleUnauthorized(platform);
    }
    throw new Error(errorMessage);
  }

  return data as T;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>(resolvePlatform(), path, options);
}

export function portalRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>('portal', path, options);
}

export function partnerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>('partner', path, options);
}

export function saasRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestWithPlatform<T>('saas', path, options);
}

// authedFetch：返回原始 Response（文件上传/下载/FormData 场景），自动带 token + 401 处理
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const platform = resolvePlatform();
  const token = getToken(platform);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) || {}) }
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    handleUnauthorized(platform);
  }
  return res;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      qs.append(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

type QueryParams = Record<string, string | number | boolean | undefined>;

export function createCrudApi<TItem, TCreate, TUpdate>(prefix: string) {
  return {
    list: (params?: QueryParams) => request<ListResponse<TItem>>(`${prefix}${buildQuery(params || {})}`),
    get: (id: string) => request<TItem>(`${prefix}/${id}`),
    create: (req: TCreate) => request<TItem>(prefix, { method: 'POST', body: JSON.stringify(req) }),
    update: (id: string, req: TUpdate) =>
      request<TItem>(`${prefix}/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
    delete: (id: string) => request<{ id: string }>(`${prefix}/${id}`, { method: 'DELETE' })
  };
}

export function createContentApi<TItem, TCreate, TUpdate>(prefix: string) {
  return {
    ...createCrudApi<TItem, TCreate, TUpdate>(prefix),
    submit: (id: string) => request<TItem>(`${prefix}/${id}/submit`, { method: 'POST' }),
    review: (id: string, req: { status: string; comment?: string }) =>
      request<TItem>(`${prefix}/${id}/review`, { method: 'POST', body: JSON.stringify(req) }),
    publish: (id: string) => request<TItem>(`${prefix}/${id}/publish`, { method: 'POST' }),
    archive: (id: string) => request<TItem>(`${prefix}/${id}/archive`, { method: 'POST' }),
    unpublish: (id: string) => request<TItem>(`${prefix}/${id}/unpublish`, { method: 'POST' }),
    withdraw: (id: string) => request<TItem>(`${prefix}/${id}/withdraw`, { method: 'POST' }),
    saveDraft: (id: string) => request<TItem>(`${prefix}/${id}/save-draft`, { method: 'POST' }),
    invite: (id: string, userId: string) =>
      request<TItem>(`${prefix}/${id}/invite`, { method: 'POST', body: JSON.stringify({ userId }) })
  };
}
