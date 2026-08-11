'use client'

import { useEffect, useMemo, useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import type { AllianceProject } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { ProjectCard } from '@/components/alliance/public-cards'
import { PublicListShell } from '@/components/alliance/public-list-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { fetchAllPages } from '@/lib/fetch-all'

import { useT } from '@/lib/i18n/locale-provider'
const PHASE_TABS = [
  { value: 'initiation', label: '启动' },
  { value: 'execution', label: '执行中' },
  { value: 'acceptance', label: '验收' },
  { value: 'closure', label: '已完成' },
]

export default function AlliancePublicProjectsPage() {
  const t = useT()
  const { tenantId } = usePortalAuth()
  const [items, setItems] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    // 与后台一致：仅展示本校公开且关联已链接企业的项目；分页全量拉取避免截断
    const q = tenantId ? `?tenantId=${tenantId}` : ''
    fetchAllPages((page, pageSize) =>
      portalRequest<{ items: AllianceProject[] }>(
        `/alliance/public/projects${q}${q ? '&' : '?'}limit=${pageSize}&offset=${page * pageSize}`,
      ),
    )
      .then((items) => setItems(items))
      .catch((err) => {
        reportError(err, { source: '加载合作项目列表' })
      })
      .finally(() => setLoading(false))
  }, [tenantId])

  const tabs = useMemo(
    () => [
      { value: 'all', label: t('全部项目'), count: items.length },
      ...PHASE_TABS.map((tab) => ({
        value: tab.value,
        label: t(tab.label),
        count: items.filter((i) => i.phase === tab.value).length,
      })),
    ],
    [items, t],
  )

  const filtered = useMemo(() => {
    let list = items
    if (tab !== 'all') list = list.filter((i) => i.phase === tab)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <PublicListShell
      title={t('合作项目')}
      subtitle={t('查看全部校企合作项目，按项目阶段筛选')}
      icon={<FolderKanban className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder={t('搜索项目名称或描述...')}
      loading={loading}
    >
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">{t('暂无合作项目')}</div>
          <div className="text-[13px] mt-1">{t('发布后的合作项目会展示在这里')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <ProjectCard key={item.id} project={item} />
          ))}
        </div>
      )}
    </PublicListShell>
  )
}
