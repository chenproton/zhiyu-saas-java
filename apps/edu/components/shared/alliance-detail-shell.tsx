'use client'

import { type ReactNode, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil } from 'lucide-react'

export interface AllianceDetailShellTab<T extends string = string> {
  key: T
  label: string
  content: ReactNode
  badge?: number | string
}

export interface AllianceDetailShellProps<T extends string = string> {
  title: string
  subtitle?: string
  statusBadge?: ReactNode
  backHref?: string
  editHref?: string
  actions?: ReactNode
  tabs: AllianceDetailShellTab<T>[]
  defaultTab?: T
  loading?: boolean
  notFound?: boolean
  notFoundMessage?: string
}

export function AllianceDetailShell<T extends string = string>({
  title,
  subtitle,
  statusBadge,
  backHref,
  editHref,
  actions,
  tabs,
  defaultTab,
  loading,
  notFound,
  notFoundMessage = '数据不存在',
}: AllianceDetailShellProps<T>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab')

  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.key ?? '')
  const [prevUrlTab, setPrevUrlTab] = useState<string | null>(urlTab)
  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab)
    if (urlTab && tabs.some((t) => t.key === urlTab)) {
      setActiveTab(urlTab)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  }

  if (notFound) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{notFoundMessage}</p>
        {backHref && (
          <Button variant="outline" size="sm" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回列表
          </Button>
        )}
      </div>
    )
  }

  const activeContent = tabs.find((t) => t.key === activeTab)?.content

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        {backHref ? (
          <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        )}
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {statusBadge}
        <div className="flex-1" />
        {editHref && (
          <Button variant="outline" size="sm" onClick={() => router.push(editHref)}>
            <Pencil className="h-4 w-4 mr-1" />
            编辑
          </Button>
        )}
        {actions}
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key as string}
            onClick={() => setActiveTab(t.key as string)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.key
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeContent}
    </div>
  )
}
