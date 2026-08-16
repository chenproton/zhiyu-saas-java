'use client'

// 知识库大厅（/portal/apps/ai/hall/kbs）：首页「查看更多」进入的全量列表页。
// 样式对齐 docs/demo 知识库大厅原型；排序映射（spec §2.1 Q2-a）：
// 综合排序=hot(提问数) / 最新创建=new / 最近更新=updated / 资源最多=docs / 浏览最多=views(v2.2)。
// v2.2 A3：搜索/标签/排序/页码全部同步到 URL query，刷新/分享不丢状态；加载更多 → 页码分页。
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { aiCenterSquareApi, type AIKnowledgeBase } from '@/lib/api'
import { useToast, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { HallShell } from '../../_components/hall-shell'
import { KbHallCard } from '../../_components/hall-cards'
import { LandingPagination } from '@/components/shared/landing-pagination'

const PAGE_SIZE = 12

type KbSort = 'hot' | 'new' | 'updated' | 'docs' | 'views'
const SORTS: KbSort[] = ['hot', 'new', 'updated', 'docs', 'views']

function KbHallInner() {
  const t = useT()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL 为唯一事实源（A3）
  const appliedQ = searchParams.get('q') || ''
  const rawSort = searchParams.get('sort') || 'hot'
  const sort = (SORTS.includes(rawSort as KbSort) ? rawSort : 'hot') as KbSort
  const tag = searchParams.get('tag') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const [qInput, setQInput] = useState(appliedQ)
  const [kbs, setKbs] = useState<AIKnowledgeBase[]>([])
  const [total, setTotal] = useState(0)
  // 加载态派生：已完成请求钥匙 ≠ 当前参数钥匙 即加载中（避免 effect 内同步 setState）
  const reqKey = `${appliedQ}|${tag}|${sort}|${page}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== reqKey

  const setQuery = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  useEffect(() => {
    let alive = true
    aiCenterSquareApi
      .kbs({
        q: appliedQ || undefined,
        tag: tag || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!alive) return
        setKbs(res.items)
        setTotal(res.total)
      })
      .catch((err: unknown) =>
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        }),
      )
      .finally(() => {
        if (alive) setLoadedKey(reqKey)
      })
    return () => {
      alive = false
    }
  }, [appliedQ, tag, sort, page, reqKey, toast, t])

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
        { value: totalDocs, label: t('文档总数（当前页）') },
        { value: totalAsks, label: t('被提问次数（当前页）') },
        { value: tagOptions.length, label: t('标签数（当前页）') },
      ]}
      tags={tagOptions}
      activeTag={tag}
      onTagChange={(v) => setQuery({ tag: v, page: '' })}
      sortOptions={[
        { value: 'hot', label: t('综合排序') },
        { value: 'new', label: t('最新创建') },
        { value: 'updated', label: t('最近更新') },
        { value: 'docs', label: t('资源最多') },
        { value: 'views', label: t('浏览最多') },
      ]}
      sort={sort}
      onSortChange={(v) => setQuery({ sort: v === 'hot' ? '' : v, page: '' })}
      searchValue={qInput}
      onSearchChange={setQInput}
      onSearch={() => setQuery({ q: qInput.trim(), page: '' })}
      searchPlaceholder={t('搜索知识库')}
      total={total}
      loading={loading}
    >
      {kbs.length === 0 && !loading ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" />}
          title={t('暂无内容')}
          description={t('还没有已发布的知识库，去工坊创建第一个吧')}
          action={
            <a
              href="/portal/apps/ai/landing#studio"
              className="inline-flex items-center rounded-full bg-primary text-white px-5 h-9 text-sm font-medium hover:bg-primary/90"
            >
              {t('去创建')}
            </a>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {kbs.map((kb) => (
              <KbHallCard key={kb.id} kb={kb} />
            ))}
          </div>
          <div className="flex justify-center pt-2 pb-6">
            <LandingPagination
              currentPage={page}
              totalPages={Math.ceil(total / PAGE_SIZE)}
              onPageChange={(p) => setQuery({ page: p > 1 ? String(p) : '' })}
            />
          </div>
        </>
      )}
    </HallShell>
  )
}

export default function KbHallPage() {
  return (
    <Suspense>
      <KbHallInner />
    </Suspense>
  )
}
