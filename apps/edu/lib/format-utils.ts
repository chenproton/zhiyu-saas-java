export function draftSuffix() {
  const d = new Date()
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return `${ds}_${c[Math.floor(Math.random() * 36)]}${c[Math.floor(Math.random() * 36)]}`
}

// formatDate 将时间值格式化为 YYYY-MM-DD，空值/非法值返回 fallback（默认 "-"）。
export function formatDate(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// formatDateTime 将时间值格式化为 zh-CN 的 YYYY/MM/DD HH:mm，空值/非法值返回 fallback（默认 "-"）。
export function formatDateTime(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * 校验外链协议白名单（http/https），防止 javascript: 等危险协议被渲染为链接。
 */
export function isSafeExternalUrl(url?: string | null): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
