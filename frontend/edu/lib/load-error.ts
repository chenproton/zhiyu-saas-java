// 加载失败统一处理：记录错误并弹出失败提示。
// 用法：catch (err) { handleLoadError(err, toast, t, '加载岗位/批次列表失败', { source: '加载岗位/批次列表' }) }
import type { toast } from '@zhiyu/ui'
import { reportError } from '@/lib/error-handling'

type ToastFn = typeof toast

export function handleLoadError(
  err: unknown,
  showToast: ToastFn,
  t: (key: string, vars?: Record<string, string | number>) => string,
  label: string,
  source?: string,
) {
  reportError(err, source ? { source } : label)
  showToast({
    variant: 'destructive',
    title: t('加载失败'),
    description: err instanceof Error ? err.message : t(label),
  })
}
