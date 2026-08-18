'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/locale-provider'

export default function NotFound() {
  const t = useT()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl">404</p>
      <p className="text-sm text-muted-foreground">{t('页面不存在或已被移除')}</p>
      <Button asChild variant="outline">
        <Link href="/portal/workspace">{t('返回工作台')}</Link>
      </Button>
    </div>
  )
}
