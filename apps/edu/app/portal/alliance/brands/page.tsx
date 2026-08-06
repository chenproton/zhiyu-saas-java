'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { BrandCard } from '@/components/alliance/public-cards'
import { PublicListShell } from '@/components/alliance/public-list-shell'

const BRAND_TYPES = ['talent', 'employer', 'job', 'major', 'teacher', 'culture']

function AlliancePublicBrandsList() {
  const searchParams = useSearchParams()
  const [items, setItems] = useState<AllianceBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>(() => {
    const type = searchParams.get('type')
    return type && BRAND_TYPES.includes(type) ? type : 'all'
  })
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    portalRequest<{ items: AllianceBrand[] }>('/alliance/public/brands')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载品牌列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  const tabs = useMemo(
    () => [
      { value: 'all', label: '全部品牌', count: items.length },
      ...BRAND_TYPES.map((type) => ({
        value: type,
        label: allianceLabel('brandType', type),
        count: items.filter((i) => i.brandType === type).length,
      })),
    ],
    [items],
  )

  const filtered = useMemo(() => {
    let list = items
    if (tab !== 'all') list = list.filter((i) => i.brandType === tab)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q) ||
          (Array.isArray(i.data?.tags)
            ? (i.data.tags as string[]).some((t) => t.toLowerCase().includes(q))
            : false),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <PublicListShell
      title="品牌展示"
      subtitle="查看学校六大品牌模块建设成果，按品牌分类筛选"
      icon={<Sparkles className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder="搜索品牌名称、描述或标签..."
      loading={loading}
    >
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">暂无品牌</div>
          <div className="text-[13px] mt-1">发布后的品牌成果会展示在这里</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <BrandCard key={item.id} brand={item} />
          ))}
        </div>
      )}
    </PublicListShell>
  )
}

export default function AlliancePublicBrandsPage() {
  return (
    <Suspense fallback={null}>
      <AlliancePublicBrandsList />
    </Suspense>
  )
}
