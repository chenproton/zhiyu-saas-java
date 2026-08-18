'use client'

import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

export interface DetailPageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  backHref?: string
  backLabel?: ReactNode
  statusBadge?: ReactNode
  actions?: ReactNode
  editHref?: string
}

export function DetailPageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  statusBadge,
  actions,
  editHref,
}: DetailPageHeaderProps) {
  const t = useT()
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {backHref ? (
        <Button variant="ghost" size="sm" onClick={() => navigate(backHref)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {backLabel ?? t('返回')}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {backLabel ?? t('返回')}
        </Button>
      )}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {statusBadge}
      <div className="flex-1" />
      {editHref && (
        <Button variant="outline" size="sm" onClick={() => navigate(editHref)}>
          <Pencil className="h-4 w-4 mr-1" />
          {t('编辑')}
        </Button>
      )}
      {actions}
    </div>
  )
}
