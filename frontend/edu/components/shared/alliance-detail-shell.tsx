'use client'

// 联盟「门户视角」详情壳：notFound/loading/URL Tab 同步等行为能力（portal 页面组用）。
// 与 components/alliance/alliance-detail-shell.tsx（企业视角：breadcrumbs/stats/cover 渐变视觉）并存，
// 两者职责不同（行为 vs 视觉），改动前先确认目标页面组归属，避免双向漂移。

import { type ReactNode, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { DetailPageHeader } from '@/components/shared/detail-page-header'
import { LoadingView, UnderlineTabs, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

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
  notFoundMessage,
}: AllianceDetailShellProps<T>) {
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')

  // 首帧即按 URL 深链 ?tab=xxx 校验取值，避免深链在首次渲染不生效
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (urlTab && tabs.some((t) => t.key === urlTab)) return urlTab
    return defaultTab ?? tabs[0]?.key ?? ''
  })
  const [prevUrlTab, setPrevUrlTab] = useState<string | null>(urlTab)
  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab)
    if (urlTab && tabs.some((t) => t.key === urlTab)) {
      setActiveTab(urlTab)
    }
  }

  if (loading) {
    return <LoadingView />
  }

  if (notFound) {
    return (
      <EmptyState
        title={notFoundMessage ?? t('数据不存在')}
        className="py-12"
        action={
          backHref && (
            <Button variant="outline" size="sm" onClick={() => navigate(backHref)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('返回列表')}
            </Button>
          )
        }
      />
    )
  }

  const activeContent = tabs.find((t) => t.key === activeTab)?.content

  return (
    <div className="space-y-6">
      {/* Header */}
      <DetailPageHeader
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        statusBadge={statusBadge}
        actions={actions}
        editHref={editHref}
      />

      {/* Tabs */}
      <UnderlineTabs
        items={tabs.map((t) => ({ key: t.key as string, label: t.label, badge: t.badge }))}
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key)}
      />

      {/* Content */}
      {activeContent}
    </div>
  )
}
