'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Briefcase, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { allianceEmploymentPublicApi, fetchAllPages } from '@/lib/api'
import type { EmploymentProject } from '@/lib/types'
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  deriveEmploymentProjectPhase,
} from '@/lib/types'
import { useAsync, ErrorState } from '@zhiyu/ui'
import { PublicListShell } from '@/components/alliance/public-list-shell'
import { GradientPlaceholder } from '@/components/alliance/public-cards'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'

/** 类型筛选（全部/春招/秋招/定向/订单班） */
const TYPE_TABS = [
  { value: 'all', label: '全部' },
  { value: 'spring', label: '春招' },
  { value: 'autumn', label: '秋招' },
  { value: 'directed', label: '定向' },
  { value: 'order', label: '订单班' },
]

function phaseBadgeClass(phase: string) {
  if (phase === 'ongoing') return 'bg-emerald-500 text-white border-0'
  if (phase === 'preparing') return 'bg-amber-500 text-white border-0'
  return 'bg-slate-500 text-white border-0'
}

function EmploymentProjectCard({ project }: { project: EmploymentProject }) {
  const t = useT()
  const phase = deriveEmploymentProjectPhase(project)
  const typeLabel = EMPLOYMENT_PROJECT_TYPE_LABELS[project.type] ?? project.type
  return (
    <Link href={`/portal/alliance/employment/${project.id}`}>
      <Card className="group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0">
        <div className="relative aspect-[16/9] overflow-hidden">
          <GradientPlaceholder
            seed={project.name}
            label={project.name}
            className="w-full h-full text-4xl group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge className="bg-white/92 text-slate-800 border-0 shadow-sm text-[11px] font-medium backdrop-blur-sm">
              {typeLabel}
            </Badge>
            <Badge className={`shadow-sm text-[11px] font-medium ${phaseBadgeClass(phase)}`}>
              {EMPLOYMENT_PROJECT_PHASE_LABELS[phase]}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <h4 className="font-semibold text-slate-900 text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </h4>
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-3 min-h-[2.6em]">
            {project.description || t('暂无项目简介')}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {t('发起单位：{org}', { org: project.organizer || '-' })}
          </p>
          <div className="mt-auto flex items-center gap-1.5 text-xs text-slate-500 pt-3">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {project.startDate ?? '-'}
              {project.endDate ? ` ${t('至')} ${project.endDate}` : ''}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function AllianceEmploymentPage() {
  const t = useT()
  const { tenantId } = usePortalAuth()
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return undefined
      // 已发布项目（学生调用时后端已按 target_groups 过滤）；分页全量拉取避免截断
      return fetchAllPages((page, pageSize) =>
        allianceEmploymentPublicApi.listProjects(tenantId, {
          limit: pageSize,
          offset: page * pageSize,
        }),
      )
    },
    { deps: [tenantId], onError: () => true },
  )
  const items = useMemo(() => data ?? [], [data])

  const tabs = useMemo(
    () =>
      TYPE_TABS.map((tabItem) => ({
        value: tabItem.value,
        label: t(tabItem.label),
        count:
          tabItem.value === 'all'
            ? items.length
            : items.filter((i) => i.type === tabItem.value).length,
      })),
    [items, t],
  )

  const filtered = useMemo(() => {
    let list = items
    if (tab !== 'all') list = list.filter((i) => i.type === tab)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q) ||
          (i.organizer ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <PublicListShell
      title={t('人才与岗位供需服务大厅')}
      subtitle={t('浏览已发布的就业项目，查看项目岗位并在线投递')}
      icon={<Briefcase className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder={t('搜索项目名称、简介或发起单位...')}
      loading={loading || data === undefined}
    >
      {error ? (
        <ErrorState description={error.message} onRetry={refresh} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">{t('暂无就业项目')}</div>
          <div className="text-[13px] mt-1">{t('发布后的就业项目会展示在这里')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <EmploymentProjectCard key={item.id} project={item} />
          ))}
        </div>
      )}
    </PublicListShell>
  )
}
