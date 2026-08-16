'use client'

// 智能体大厅（/portal/apps/ai/hall/agents）：首页「查看更多」进入的全量列表页。
// 样式对齐 docs/demo 智能体大厅原型；热度=对话数、浏览量=v2.2 B5 新增，无评分/专业维度（spec §2.1 Q2-a）。
// v2.2 A3：搜索/排序/页码同步到 URL query；加载更多 → 页码分页。
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bot } from 'lucide-react'
import { aiCenterSquareApi, type AIAgent } from '@/lib/api'
import { useToast, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { HallShell } from '../../_components/hall-shell'
import { AgentHallCard } from '../../_components/hall-cards'
import { LandingPagination } from '@/components/shared/landing-pagination'

const PAGE_SIZE = 12

type AgentSort = 'hot' | 'new' | 'views'
const SORTS: AgentSort[] = ['hot', 'new', 'views']

function AgentHallInner() {
  const t = useT()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL 为唯一事实源（A3）
  const appliedQ = searchParams.get('q') || ''
  const rawSort = searchParams.get('sort') || 'hot'
  const sort = (SORTS.includes(rawSort as AgentSort) ? rawSort : 'hot') as AgentSort
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const [qInput, setQInput] = useState(appliedQ)
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [total, setTotal] = useState(0)
  const reqKey = `${appliedQ}|${sort}|${page}`
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
      .agents({ q: appliedQ || undefined, sort, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setAgents(res.items)
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
  }, [appliedQ, sort, page, reqKey, toast, t])

  const totalChats = agents.reduce((sum, a) => sum + (a.chatCount || 0), 0)

  return (
    <HallShell
      title={t('智能体大厅')}
      headerIcon={<Bot className="w-6 h-6 text-white" />}
      subtitle={t('租户内已发布的全部智能体，点击「立即体验」开始对话')}
      stats={[
        { value: total, label: t('智能体总数') },
        { value: totalChats, label: t('累计对话（当前页）') },
      ]}
      sortOptions={[
        { value: 'hot', label: t('最热') },
        { value: 'new', label: t('最新') },
        { value: 'views', label: t('浏览最多') },
      ]}
      sort={sort}
      onSortChange={(v) => setQuery({ sort: v === 'hot' ? '' : v, page: '' })}
      searchValue={qInput}
      onSearchChange={setQInput}
      onSearch={() => setQuery({ q: qInput.trim(), page: '' })}
      searchPlaceholder={t('搜索智能体')}
      total={total}
      loading={loading}
    >
      {agents.length === 0 && !loading ? (
        <EmptyState
          icon={<Bot className="h-10 w-10" />}
          title={t('暂无内容')}
          description={t('还没有已发布的智能体，去工坊创建第一个吧')}
          action={
            <a
              href="/portal/apps/ai/studio/agents/new"
              className="inline-flex items-center rounded-full bg-primary text-white px-5 h-9 text-sm font-medium hover:bg-primary/90"
            >
              {t('去创建')}
            </a>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {agents.map((a) => (
              <AgentHallCard key={a.id} agent={a} />
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

export default function AgentHallPage() {
  return (
    <Suspense>
      <AgentHallInner />
    </Suspense>
  )
}
