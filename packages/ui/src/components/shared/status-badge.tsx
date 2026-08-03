'use client'

import { Loader2 } from 'lucide-react'
import { getStatusConfig } from '@zhiyu/shared-types'

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label?: string
  className?: string
}) {
  const config = getStatusConfig(status)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className || ''}`}
      style={{ background: config.bg, color: config.color }}
    >
      {label ?? config.label}
    </span>
  )
}

export function LoadingView({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-sm text-gray-400">
      <Loader2 className="h-8 w-8 animate-spin mb-3" />
      {text && <p>{text}</p>}
    </div>
  )
}
