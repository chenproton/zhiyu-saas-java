'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useT()
  useEffect(() => {
    reportError(error, 'route-error')
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl">{t('页面出错了')}</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('页面渲染过程中发生异常，已记录错误信息，请重试')}
      </p>
      <Button onClick={reset}>
        <RefreshCw className="mr-1 size-3.5" />
        {t('重试')}
      </Button>
    </div>
  )
}
