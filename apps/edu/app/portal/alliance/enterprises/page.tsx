'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import type { AllianceEnterprise } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { EnterpriseCard } from '@/components/alliance/public-cards'
import { PublicListShell } from '@/components/alliance/public-list-shell'

const RATING_TABS = [
  { value: 'strategic', label: '战略合作' },
  { value: 'deep', label: '深度合作' },
  { value: 'general', label: '一般合作' },
]

export default function AlliancePublicEnterprisesPage() {
  const [items, setItems] = useState<AllianceEnterprise[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    portalRequest<{ items: AllianceEnterprise[] }>('/alliance/public/enterprises')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载合作企业列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  const tabs = useMemo(
    () => [
      { value: 'all', label: '全部企业', count: items.length },
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
          (i.industry ?? '').toLowerCase().includes(q) ||
          (i.region ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <PublicListShell
      title="合作企业"
      subtitle="查看全部校企合作企业，按合作等级筛选"
      icon={<Building2 className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder="搜索企业名称、行业或地区..."
      loading={loading}
    >
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">暂无合作企业</div>
          <div className="text-[13px] mt-1">发布后的合作企业会展示在这里</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <EnterpriseCard key={item.id} enterprise={item} />
          ))}
        </div>
      )}
    </PublicListShell>
  )
}
