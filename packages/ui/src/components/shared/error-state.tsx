'use client'

import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

/**
 * 错误态（带重试）：列表/详情页加载失败的统一展示。
 * 与 LoadingView（加载态）、Empty（空态）配套使用。
 */
export function ErrorState({ title = '加载失败', description, onRetry }: ErrorStateProps) {
  return (
    <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          {description && <p className="mt-0.5 opacity-90">{description}</p>}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-4 w-4 mr-1" />
            重试
          </Button>
        )}
      </div>
    </div>
  )
}
