'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import type { AllianceExpert } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { ExpertCard } from '@/components/alliance/public-cards'
import { PublicListShell } from '@/components/alliance/public-list-shell'

const RATING_TABS = [
  { value: 'gold', label: '金牌专家' },
  { value: 'silver', label: '银牌专家' },
  { value: 'copper', label: '铜牌专家' },
]

export default function AlliancePublicExpertsPage() {
  const [items, setItems] = useState<AllianceExpert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    portalRequest<{ items: AllianceExpert[] }>('/alliance/public/experts')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载企业专家列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  const tabs = useMemo(
    () => [
      { value: 'all', label: '全部专家', count: items.length },
      ...RATING_TABS.map((t) => ({
        value: t.value,
        label: t.label,
        count: items.filter((i) => i.rating === t.value).length,
      })),
    ],
    [items],
  )

  const filtered = useMemo(() => {
    let list = items
    if (tab !== 'all') list = list.filter((i) => i.rating === tab)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.title ?? '').toLowerCase().includes(q) ||
          (i.position ?? '').toLowerCase().includes(q) ||
          (i.industry ?? '').toLowerCase().includes(q) ||
          (i.specialties ?? []).some((s) => s.toLowerCase().includes(q)),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <PublicListShell
      title="企业专家"
      subtitle="查看全部产业专家与校企专家资源，按专家评级筛选"
      icon={<Users className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder="搜索专家姓名、职务、行业或专长..."
      loading={loading}
    >
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">暂无专家</div>
          <div className="text-[13px] mt-1">发布后的专家资源会展示在这里</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <ExpertCard key={item.id} expert={item} />
          ))}
        </div>
      )}
    </PublicListShell>
  )
}
