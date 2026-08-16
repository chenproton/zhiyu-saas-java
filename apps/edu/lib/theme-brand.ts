const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

const BRAND_COLOR_KEY = 'zhiyu-brand-color'
export const BRAND_CHANGED_EVENT = 'zhiyu-theme-changed'
export const DEFAULT_BRAND_COLOR = '#4862e4'

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/** 本地缓存键：租户有独立主题色（按租户隔离缓存），否则用全局键。 */
function cacheKey(tenantId?: string): string {
  return tenantId ? `${BRAND_COLOR_KEY}-${tenantId}` : BRAND_COLOR_KEY
}

/** 立即应用主题色到全局 CSS 变量并缓存到 localStorage（租户缓存独立）。 */
export function applyBrandColor(color: string, tenantId?: string) {
  if (!isHexColor(color) || typeof document === 'undefined') return
  document.documentElement.style.setProperty('--brand', color)
  try {
    localStorage.setItem(cacheKey(tenantId), color)
  } catch {
    // 忽略隐私模式等场景下的存储失败
  }
}

/** 读取本地缓存的主题色：租户缓存优先，回退全局缓存与默认值。 */
export function getCachedBrandColor(tenantId?: string): string {
  if (typeof window === 'undefined') return DEFAULT_BRAND_COLOR
  try {
    const keys = tenantId ? [cacheKey(tenantId), BRAND_COLOR_KEY] : [BRAND_COLOR_KEY]
    for (const key of keys) {
      const cached = localStorage.getItem(key)
      if (cached && isHexColor(cached)) return cached
    }
  } catch {
    // 忽略存储读取失败
  }
  return DEFAULT_BRAND_COLOR
}

/** 从平台公开接口拉取主题色（不应用，仅返回值）；带 tenantId 时读取租户覆盖色。 */
export async function fetchThemeColor(tenantId?: string): Promise<string> {
  try {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
    const res = await fetch(`${API_BASE}/settings/theme${query}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return getCachedBrandColor(tenantId)
    const data = (await res.json()) as { primary?: string }
    return data.primary && isHexColor(data.primary) ? data.primary : DEFAULT_BRAND_COLOR
  } catch {
    return getCachedBrandColor(tenantId)
  }
}

/** 从平台公开接口拉取主题色并应用。 */
export async function fetchAndApplyBrandColor(tenantId?: string): Promise<string> {
  const color = await fetchThemeColor(tenantId)
  applyBrandColor(color, tenantId)
  return color
}
