/**
 * 前端错误处理小工具：
 * - 开发环境打印完整错误栈
 * - 生产环境可继续扩展为上报 sentry / 日志服务
 * - 用于原本静默吞掉的 API/异步错误，至少保留排查线索
 */

export interface ErrorContext {
  /** 调用来源，例如 "加载题库"、"保存任务" */
  source: string
  /** 可选的补充数据，开发时会被序列化打印 */
  extras?: Record<string, unknown>
}

/** 非阻塞地记录错误，不影响 UI 流程。 */
export function reportError(err: unknown, context: string | ErrorContext): void {
  const ctx: ErrorContext = typeof context === 'string' ? { source: context } : context
  const message = err instanceof Error ? err.message : String(err)
  const payload = {
    source: ctx.source,
    message,
    error: err,
    extras: ctx.extras,
  }

  if (process.env.NODE_ENV === 'production') {
    // 生产环境可接入外部监控；目前先保持 console.error 以免完全静默
    console.error('[app-error]', payload)
  } else {
    console.error(`[app-error] ${ctx.source}:`, message, err, ctx.extras ?? '')
  }
}

/** 用于 async/await 的 catch 块：记录错误并返回 fallback。 */
export function withFallback<T>(context: string | ErrorContext, fallback: T): (err: unknown) => T {
  return (err: unknown) => {
    reportError(err, context)
    return fallback
  }
}
