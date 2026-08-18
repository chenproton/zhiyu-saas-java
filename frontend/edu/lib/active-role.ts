import type { Role } from '@/lib/types/backend'

const ROLE_PRIORITY = ['school_admin', 'teacher', 'student', 'enterprise_mentor']
const STORAGE_PREFIX = 'zhiyu-active-role:'

function storageKey(userId: string) {
  return STORAGE_PREFIX + userId
}

function pickDefaultRole(roles?: Role[]): Role | undefined {
  if (!roles || roles.length === 0) return undefined
  for (const code of ROLE_PRIORITY) {
    const found = roles.find((r) => r.code === code)
    if (found) return found
  }
  return roles[0]
}

export function resolveActiveRole(userId?: string, roles?: Role[]): Role | undefined {
  if (!roles || roles.length === 0) return undefined
  if (userId && typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(storageKey(userId))
      if (saved) {
        const found = roles.find((r) => r.id === saved)
        if (found) return found
      }
    } catch {
      // ignore storage errors
    }
  }
  return pickDefaultRole(roles)
}

export function persistActiveRole(userId: string, roleId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), roleId)
  } catch {
    // ignore storage errors
  }
}
