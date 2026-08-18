'use client'

import { type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

export interface FormPageShellProps {
  title: ReactNode
  description?: ReactNode
  backHref?: string
  children: ReactNode
  sidebar?: ReactNode
  footer?: ReactNode
}

export function FormPageShell({
  title,
  description,
  backHref,
  children,
  sidebar,
  footer,
}: FormPageShellProps) {
  const t = useT()
  const router = useRouter()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        {backHref ? (
          <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('返回')}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('返回')}
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">{children}</div>
        {sidebar && <div className="space-y-6">{sidebar}</div>}
      </div>
      {footer}
    </div>
  )
}
