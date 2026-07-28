import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix?: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  return prefix ? `${prefix}-${suffix}` : suffix
}

export function formatFileSize(size: string | undefined | null): string {
  if (!size) return ""
  const bytes = Number(size)
  if (Number.isNaN(bytes)) return ""
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
