'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/error-handling'
import { translate, type Locale } from '@/lib/i18n/locale-provider'

function readLocale(): Locale {
  if (typeof document === 'undefined') return 'zh'
  const v = document.documentElement.dataset.locale
  if (v === 'en' || v === 'zh') return v
  try {
    return localStorage.getItem('zhiyu-lang') === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale] = useState<Locale>(readLocale)
  useEffect(() => {
    reportError(error, 'route-error')
  }, [error])

  return (
    <html lang={locale === 'en' ? 'en' : 'zh-CN'}>
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-5xl">{translate('应用出错了', locale)}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {translate('应用发生严重异常，已记录错误信息，请刷新重试', locale)}
          </p>
          <Button onClick={() => reset()}>
            <RefreshCw className="mr-1 size-3.5" />
            {translate('刷新重试', locale)}
          </Button>
        </div>
      </body>
    </html>
  )
}
