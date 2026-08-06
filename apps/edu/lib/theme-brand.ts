const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

export const BRAND_COLOR_KEY = 'zhiyu-brand-color'
export const BRAND_CHANGED_EVENT = 'zhiyu-theme-changed'
export const DEFAULT_BRAND_COLOR = '#4862e4'

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/** 立即应用主题色到全局 CSS 变量并缓存到 localStorage。 */
export function applyBrandColor(color: string) {
  if (!isHexColor(color) || typeof document === 'undefined') return
  document.documentElement.style.setProperty('--brand', color)
  try {
    localStorage.setItem(BRAND_COLOR_KEY, color)
  } catch {
    // 忽略隐私模式等场景下的存储失败
  }
}

/** 读取本地缓存的主题色（无缓存返回默认值）。 */
export function getCachedBrandColor(): string {
  if (typeof window === 'undefined') return DEFAULT_BRAND_COLOR
  try {
    const cached = localStorage.getItem(BRAND_COLOR_KEY)
    if (cached && isHexColor(cached)) return cached
  } catch {
    // 忽略存储读取失败
  }
  return DEFAULT_BRAND_COLOR
}

/** 从平台公开接口拉取主题色（不应用，仅返回值）。 */
export async function fetchThemeColor(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/settings/theme`, { cache: 'no-store' })
    if (!res.ok) return getCachedBrandColor()
    const data = (await res.json()) as { primary?: string }
    return data.primary && isHexColor(data.primary) ? data.primary : DEFAULT_BRAND_COLOR
  } catch {
    return getCachedBrandColor()
  }
}

/** 从平台公开接口拉取主题色并应用。 */
export async function fetchAndApplyBrandColor(): Promise<string> {
  const color = await fetchThemeColor()
  applyBrandColor(color)
  return color
}
