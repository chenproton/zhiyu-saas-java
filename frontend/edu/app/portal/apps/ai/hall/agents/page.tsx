'use client'

// 智能体大厅（/portal/apps/ai/hall/agents）：首页「查看更多」进入的全量列表页。
// 样式对齐 docs/demo 智能体大厅原型；热度=对话数、浏览量=v2.2 B5 新增，无评分/专业维度（spec §2.1 Q2-a）。
// v2.2 A3：搜索/排序/页码同步到 URL query；加载更多 → 页码分页。
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Bot } from 'lucide-react'
import { aiCenterSquareApi, type AIAgent } from '@/lib/api'
import { useToast, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { HallShell } from '../../_components/hall-shell'
import { AgentHallCard } from '../../_components/hall-cards'
import { LandingPagination } from '@/components/shared/landing-pagination'
import { LandingFilterRow } from '@/components/shared/landing-filter-row'
import { useClassifyDicts } from '../../_components/classify-dicts'

const PAGE_SIZE = 12

type AgentSort = 'hot' | 'new' | 'views'
const SORTS: AgentSort[] = ['hot', 'new', 'views']

function AgentHallInner() {
  const t = useT()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // URL 为唯一事实源（A3）
  const appliedQ = searchParams.get('q') || ''
  const rawSort = searchParams.get('sort') || 'hot'
  const sort = (SORTS.includes(rawSort as AgentSort) ? rawSort : 'hot') as AgentSort
  const majorId = searchParams.get('major') || ''
  const departmentId = searchParams.get('dept') || ''
  const updated = searchParams.get('updated') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const [qInput, setQInput] = useState(appliedQ)
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [total, setTotal] = useState(0)
  const reqKey = `${appliedQ}|${sort}|${majorId}|${departmentId}|${updated}|${page}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== reqKey

  const setQuery = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
      navigate(`?${params.toString()}`, { replace: true, preventScrollReset: true })
    },
    [navigate, searchParams],
  )

  useEffect(() => {
    let alive = true
    aiCenterSquareApi
      .agents({
        q: appliedQ || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
        majorId: majorId || undefined,
        departmentId: departmentId || undefined,
        updated: (updated || undefined) as '7d' | '30d' | '180d' | undefined,
      })
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
  }, [appliedQ, sort, page, majorId, departmentId, updated, reqKey, toast, t])

  const { majors, departments } = useClassifyDicts()
  const UPDATED_OPTIONS = [
    { v: '', label: t('全部') },
    { v: '7d', label: t('最近一周') },
    { v: '30d', label: t('最近一月') },
    { v: '180d', label: t('最近半年') },
  ]

  return (
    <HallShell
      title={t('智能体大厅')}
      headerIcon={<Bot className="w-6 h-6 text-white" />}
      subtitle={t('租户内已发布的全部智能体，点击「立即体验」开始对话')}
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
      filters={
        <>
          <LandingFilterRow
            label={t('院系')}
            items={[t('全部'), ...departments.map((d) => d.name)]}
            selected={departmentId ? departments.find((d) => d.id === departmentId)?.name || t('全部') : t('全部')}
            onSelect={(label) =>
              setQuery({ dept: departments.find((d) => d.name === label)?.id || '', page: '' })
            }
            accentColor="primary"
          />
          <LandingFilterRow
            label={t('专业')}
            items={[t('全部'), ...majors.map((m) => m.name)]}
            selected={majorId ? majors.find((m) => m.id === majorId)?.name || t('全部') : t('全部')}
            onSelect={(label) =>
              setQuery({ major: majors.find((m) => m.name === label)?.id || '', page: '' })
            }
            accentColor="primary"
          />
          <LandingFilterRow
            label={t('时间')}
            items={UPDATED_OPTIONS.map((o) => o.label)}
            selected={UPDATED_OPTIONS.find((o) => o.v === updated)?.label || t('全部')}
            onSelect={(label) =>
              setQuery({ updated: UPDATED_OPTIONS.find((o) => o.label === label)?.v || '', page: '' })
            }
            accentColor="primary"
            showBorder={false}
          />
        </>
      }
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
