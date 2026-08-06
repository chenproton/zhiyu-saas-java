'use client'

import { useEffect, useMemo, useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import type { AllianceProject } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { ProjectCard } from '@/components/alliance/public-cards'
import { PublicListShell } from '@/components/alliance/public-list-shell'

const PHASE_TABS = [
  { value: 'initiation', label: '启动' },
  { value: 'execution', label: '执行中' },
  { value: 'acceptance', label: '验收' },
  { value: 'closure', label: '已完成' },
]

export default function AlliancePublicProjectsPage() {
  const [items, setItems] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    portalRequest<{ items: AllianceProject[] }>('/alliance/public/projects')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载合作项目列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  const tabs = useMemo(
    () => [
      { value: 'all', label: '全部项目', count: items.length },
      ...PHASE_TABS.map((t) => ({
        value: t.value,
        label: t.label,
        count: items.filter((i) => i.phase === t.value).length,
      })),
    ],
    [items],
  )

  const filtered = useMemo(() => {
    let list = items
    if (tab !== 'all') list = list.filter((i) => i.phase === tab)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <PublicListShell
      title="合作项目"
      subtitle="查看全部校企合作项目，按项目阶段筛选"
      icon={<FolderKanban className="w-7 h-7 text-white" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      placeholder="搜索项目名称或描述..."
      loading={loading}
    >
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
          <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <div className="text-[15px] font-medium text-[#475569]">暂无合作项目</div>
          <div className="text-[13px] mt-1">发布后的合作项目会展示在这里</div>
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
