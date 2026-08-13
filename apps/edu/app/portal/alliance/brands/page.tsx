'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import type { AlliancePublicBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import {
  BrandCard,
  TalentBrandCard,
  EmployerBrandRow,
  JobBrandRow,
  MajorBrandCard,
  TeacherBrandCard,
  CultureBrandCard,
} from '@/components/alliance/public-cards'
import { PublicListShell } from '@/components/alliance/public-list-shell'

import { useT } from '@/lib/i18n/locale-provider'
const BRAND_TYPES = ['talent', 'employer', 'job', 'major', 'teacher', 'culture']

/** 每个分类 tab 下的预览卡片与 landing 页保持一致 */
function BrandPreviewCard({ item }: { item: AlliancePublicBrand }) {
  switch (item.brandType) {
    case 'talent':
      return <TalentBrandCard brand={item} />
    case 'employer':
      return <EmployerBrandRow brand={item} />
    case 'job':
      return <JobBrandRow brand={item} />
    case 'major':
      return <MajorBrandCard brand={item} />
    case 'teacher':
      return <TeacherBrandCard brand={item} />
    case 'culture':
      return <CultureBrandCard brand={item} />
    default:
      return <BrandCard brand={item} />
  }
}

function AlliancePublicBrandsList() {
  const t = useT()
  const { tenantId } = usePortalAuth()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<AlliancePublicBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>(() => {
    const type = searchParams.get('type')
    return type && BRAND_TYPES.includes(type) ? type : 'talent'
  })
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    if (!tenantId) return
    portalRequest<{ items: AlliancePublicBrand[] }>(`/alliance/public/brands?tenantId=${tenantId}`)
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载品牌列表' })
      })
      .finally(() => setLoading(false))
  }, [tenantId])

  const tabs = useMemo(
    () =>
      BRAND_TYPES.map((type) => ({
        value: type,
        label: allianceLabel('brandType', type),
        count: items.filter((i) => i.brandType === type).length,
      })),
    [items],
  )

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.brandType === tab)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q) ||
          (i.positionName ?? '').toLowerCase().includes(q) ||
          (i.enterpriseName ?? '').toLowerCase().includes(q) ||
          (Array.isArray(i.data?.tags)
            ? (i.data.tags as string[]).some((t) => t.toLowerCase().includes(q))
            : false),
      )
    }
    return list
  }, [items, tab, keyword])

  // 与 landing 页一致的布局：雇主/岗位为行卡容器，师资为紧凑多列，其余网格
  const gridClassName = useMemo(() => {
    switch (tab) {
      case 'talent':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-5'
      case 'employer':
      case 'job':
        return 'rounded-2xl border border-[#e7e5e4] bg-white shadow-sm overflow-hidden divide-y divide-slate-100'
      case 'teacher':
        return 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4'
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
    }
  }, [tab])

  const isRowLayout = tab === 'employer' || tab === 'job'

  return (
    <PublicListShell
      title={t('品牌展示')}
      subtitle={t('查看学校六大品牌模块建设成果，按品牌分类筛选')}
      icon={<Sparkles className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder={t('搜索品牌名称、描述或标签...')}
      loading={loading}
    >
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">{t('暂无品牌')}</div>
          <div className="text-[13px] mt-1">{t('发布后的品牌成果会展示在这里')}</div>
        </div>
      ) : isRowLayout ? (
        <div className={gridClassName}>
          {filtered.map((item) => (
            <BrandPreviewCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className={gridClassName}>
          {filtered.map((item) => (
            <BrandPreviewCard key={item.id} item={item} />
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
