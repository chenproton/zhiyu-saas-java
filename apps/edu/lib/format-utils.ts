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
    hour12: false,
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

/** 格式化为 YYYY-MM-DD（本地时区）。 */
export function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 秒数格式化为 mm:ss（超过 1 小时为 h:mm:ss）。 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** 计算展示总分：考试结果分 > 考试总分 > 题目分数求和。 */
export function computeTotalScore(
  examResultTotal: number | undefined,
  examTotal: number | undefined,
  questions: Array<{ score?: number | null }>,
): number {
  return examResultTotal ?? examTotal ?? questions.reduce((sum, q) => sum + (q.score ?? 0), 0)
}

const NT_VERSION: Record<string, string> = {
  '6.1': '7',
  '6.2': '8',
  '6.3': '8.1',
  '10.0': '10',
}

/**
 * 将 User-Agent 解析为人类可读的设备描述，如：
 *   iOS 17.2 · Chrome 126.0.0.0
 *   Android 14 · Safari 17.2
 *   PC web · Windows 10 · Edge 126.0.0.0
 *   PC web · macOS 14.2.1 · Firefox 127.0
 * 非原始 UA（已格式化/空值）原样返回。
 */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return ''
  if (!/Mozilla/i.test(ua)) return ua

  const parts: string[] = []

  // 平台与系统版本
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/CPU OS (\d+)[_](\d+)(?:[_](\d+))?/)
    parts.push(m ? `iOS ${m[1]}.${m[2]}` : 'iOS')
  } else if (/Android/i.test(ua)) {
    const m = ua.match(/Android (\d+(?:\.\d+)?)/)
    parts.push(m ? `Android ${m[1]}` : 'Android')
  } else if (/Windows/i.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/)
    const ver = m ? NT_VERSION[m[1]] || m[1] : ''
    parts.push(`PC web · Windows${ver ? ' ' + ver : ''}`)
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    const m = ua.match(/Mac OS X (\d+)[_](\d+)(?:[_](\d+))?/)
    parts.push(m ? `PC web · macOS ${m[1]}.${m[2]}` : 'PC web · macOS')
  } else if (/Linux/i.test(ua)) {
    parts.push('PC web · Linux')
  } else {
    parts.push('未知设备')
  }

  // 浏览器型号与版本
  if (/MicroMessenger/i.test(ua)) {
    parts.push('微信内置浏览器')
  } else if (/Edg\//i.test(ua)) {
    const v = ua.match(/Edg\/([\d.]+)/)?.[1]
    parts.push(v ? `Edge ${v}` : 'Edge')
  } else if (/OPR\//i.test(ua)) {
    const v = ua.match(/OPR\/([\d.]+)/)?.[1]
    parts.push(v ? `Opera ${v}` : 'Opera')
  } else if (/Chrome\//i.test(ua)) {
    const v = ua.match(/Chrome\/([\d.]+)/)?.[1]
    parts.push(v ? `Chrome ${v}` : 'Chrome')
  } else if (/Firefox\//i.test(ua)) {
    const v = ua.match(/Firefox\/([\d.]+)/)?.[1]
    parts.push(v ? `Firefox ${v}` : 'Firefox')
  } else if (/Safari\//i.test(ua)) {
    const v = ua.match(/Version\/([\d.]+)/)?.[1]
    parts.push(v ? `Safari ${v}` : 'Safari')
  } else {
    parts.push('其他浏览器')
  }

  return parts.join(' · ')
}

export function formatSize(bytes?: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
