const STORAGE_KEY = 'zhiyu-portal-service-clicks'

const MAX_ENTRIES = 500

export function recordServiceClick(href: string): void {
  try {
    const counts = getServiceClickCounts()
    counts[href] = (counts[href] || 0) + 1
    if (Object.keys(counts).length > MAX_ENTRIES) {
      Object.keys(counts)
        .filter((k) => k !== href && counts[k] <= 1)
        .forEach((k) => delete counts[k])
    }
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  } catch {
    // localStorage 不可用时忽略，仅本次不记录
  }
}

export function getServiceClickCounts(): Record<string, number> {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
