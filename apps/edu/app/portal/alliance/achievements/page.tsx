'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import type { AllianceAchievement } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { AchievementCard } from '@/components/alliance/public-cards'
import { PublicListShell } from '@/components/alliance/public-list-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { fetchAllPages } from '@/lib/fetch-all'

import { useT } from '@/lib/i18n/locale-provider'
const TYPE_TABS = [
  { value: 'job', label: '岗位成果' },
  { value: 'scene', label: '场景成果' },
  { value: 'course', label: '课程成果' },
  { value: 'custom', label: '自定义成果' },
]

export default function AlliancePublicAchievementsPage() {
  const t = useT()
  const { tenantId } = usePortalAuth()
  const [items, setItems] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    // 与后台一致：仅展示本校公开且关联已链接企业的成果；分页全量拉取避免截断
    const q = tenantId ? `&tenantId=${tenantId}` : ''
    fetchAllPages((page, pageSize) =>
      portalRequest<{ items: AllianceAchievement[] }>(
        `/alliance/public/achievements?sort=latest${q}&limit=${pageSize}&offset=${page * pageSize}`,
      ),
    )
      .then((items) => setItems(items))
      .catch((err) => {
        reportError(err, { source: '加载成果列表' })
      })
      .finally(() => setLoading(false))
  }, [tenantId])

  const tabs = useMemo(
    () => [
      { value: 'all', label: t('全部成果'), count: items.length },
      ...TYPE_TABS.map((tab) => ({
        value: tab.value,
        label: t(tab.label),
        count: items.filter((i) => i.type === tab.value).length,
      })),
    ],
    [items, t],
  )

  const filtered = useMemo(() => {
    let list = items
    if (tab !== 'all') list = list.filter((i) => i.type === tab)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <PublicListShell
      title={t('合作成果')}
      subtitle={t('查看全部校企合作成果，按成果类型筛选')}
      icon={<Trophy className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder={t('搜索成果标题或描述...')}
      loading={loading}
    >
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">{t('暂无合作成果')}</div>
          <div className="text-[13px] mt-1">{t('发布后的合作成果会展示在这里')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <AchievementCard key={item.id} achievement={item} />
          ))}
        </div>
      )}
    </PublicListShell>
  )
}
