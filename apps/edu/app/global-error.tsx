'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/error-handling'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, 'route-error')
  }, [error])

  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-5xl">应用出错了</p>
          <p className="max-w-md text-sm text-muted-foreground">
            应用发生严重异常，已记录错误信息，请刷新重试
          </p>
          <Button onClick={() => reset()}>
            <RefreshCw className="mr-1 size-3.5" />
            刷新重试
          </Button>
        </div>
      </body>
    </html>
  )
}
