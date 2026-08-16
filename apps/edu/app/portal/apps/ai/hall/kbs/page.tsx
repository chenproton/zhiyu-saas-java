'use client'

// 知识库大厅（/portal/apps/ai/hall/kbs）：首页「查看更多」进入的全量列表页。
// 样式对齐 docs/demo 知识库大厅原型；排序映射（spec §2.1 Q2-a）：
// 综合排序=hot(提问数) / 最新创建=new / 最近更新=updated / 资源最多=docs。
import { useCallback, useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { aiCenterSquareApi, type AIKnowledgeBase } from '@/lib/api'
import { useToast, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { HallShell } from '../../_components/hall-shell'
import { KbHallCard } from '../../_components/hall-cards'

const PAGE_SIZE = 12

type KbSort = 'hot' | 'new' | 'updated' | 'docs'

export default function KbHallPage() {
  const t = useT()
  const { toast } = useToast()

  const [qInput, setQInput] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [sort, setSort] = useState<KbSort>('hot')
  const [tag, setTag] = useState('')
  const [kbs, setKbs] = useState<AIKnowledgeBase[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (p: number, append: boolean) => {
      aiCenterSquareApi
        .kbs({
          q: appliedQ || undefined,
          tag: tag || undefined,
          sort,
          page: p,
          pageSize: PAGE_SIZE,
        })
        .then((res) => {
          setKbs((prev) => (append ? [...prev, ...res.items] : res.items))
          setTotal(res.total)
          setPage(p)
        })
        .catch((err: unknown) =>
          toast({
            title: t('加载失败'),
            description: err instanceof Error ? err.message : undefined,
            variant: 'destructive',
          }),
        )
        .finally(() => setLoading(false))
    },
    [appliedQ, tag, sort, toast, t],
  )

  useEffect(() => {
    load(1, false)
  }, [load])

  // 标签筛选 chips：当前结果集标签并集 + 已选标签（保证可取消）
  const tagOptions = Array.from(
    new Set([...(tag ? [tag] : []), ...kbs.flatMap((k) => k.tags || [])]),
  )
  const totalDocs = kbs.reduce((sum, k) => sum + (k.docCount || 0), 0)
  const totalAsks = kbs.reduce((sum, k) => sum + (k.askCount || 0), 0)

  return (
    <HallShell
      title={t('知识库大厅')}
      headerIcon={<BookOpen className="w-6 h-6 text-white" />}
      subtitle={t('租户内已发布的全部知识库，点击进入详情并可向知识库提问')}
      stats={[
        { value: total, label: t('知识库总数') },
        { value: totalDocs, label: t('文档总数（当前结果）') },
        { value: totalAsks, label: t('被提问次数（当前结果）') },
        { value: tagOptions.length, label: t('标签数（当前结果）') },
      ]}
      tags={tagOptions}
      activeTag={tag}
      onTagChange={setTag}
      sortOptions={[
        { value: 'hot', label: t('综合排序') },
        { value: 'new', label: t('最新创建') },
        { value: 'updated', label: t('最近更新') },
        { value: 'docs', label: t('资源最多') },
      ]}
      sort={sort}
      onSortChange={(v) => setSort(v as KbSort)}
      searchValue={qInput}
      onSearchChange={setQInput}
      onSearch={() => setAppliedQ(qInput.trim())}
      searchPlaceholder={t('搜索知识库')}
      total={total}
      loading={loading}
      hasMore={kbs.length < total}
      onLoadMore={() => load(page + 1, true)}
    >
      {kbs.length === 0 && !loading ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" />}
          title={t('暂无内容')}
          description={t('还没有已发布的知识库')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kbs.map((kb) => (
            <KbHallCard key={kb.id} kb={kb} />
          ))}
        </div>
      )}
    </HallShell>
  )
}
