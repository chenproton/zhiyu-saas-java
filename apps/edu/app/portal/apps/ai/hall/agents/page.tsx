'use client'

// 智能体大厅（/portal/apps/ai/hall/agents）：首页「查看更多」进入的全量列表页。
// 样式对齐 docs/demo 智能体大厅原型；字段按拍板用现有数据近似
// （热度=对话数、无评分/浏览量、无专业维度故无专业筛选，spec §2.1 Q2-a）。
import { useCallback, useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { aiCenterSquareApi, type AIAgent } from '@/lib/api'
import { useToast, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { HallShell } from '../../_components/hall-shell'
import { AgentHallCard } from '../../_components/hall-cards'

const PAGE_SIZE = 12

export default function AgentHallPage() {
  const t = useT()
  const { toast } = useToast()

  const [qInput, setQInput] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [sort, setSort] = useState<'hot' | 'new'>('hot')
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (p: number, append: boolean) => {
      aiCenterSquareApi
        .agents({ q: appliedQ || undefined, sort, page: p, pageSize: PAGE_SIZE })
        .then((res) => {
          setAgents((prev) => (append ? [...prev, ...res.items] : res.items))
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
    [appliedQ, sort, toast, t],
  )

  useEffect(() => {
    load(1, false)
  }, [load])

  const totalChats = agents.reduce((sum, a) => sum + (a.chatCount || 0), 0)

  return (
    <HallShell
      title={t('智能体大厅')}
      headerIcon={<Bot className="w-6 h-6 text-white" />}
      subtitle={t('租户内已发布的全部智能体，点击「立即体验」开始对话')}
      stats={[
        { value: total, label: t('智能体总数') },
        { value: totalChats, label: t('累计对话（当前结果）') },
      ]}
      sortOptions={[
        { value: 'hot', label: t('最热') },
        { value: 'new', label: t('最新') },
      ]}
      sort={sort}
      onSortChange={(v) => setSort(v as "hot" | "new")}
      searchValue={qInput}
      onSearchChange={setQInput}
      onSearch={() => setAppliedQ(qInput.trim())}
      searchPlaceholder={t('搜索智能体')}
      total={total}
      loading={loading}
      hasMore={agents.length < total}
      onLoadMore={() => load(page + 1, true)}
    >
      {agents.length === 0 && !loading ? (
        <EmptyState
          icon={<Bot className="h-10 w-10" />}
          title={t('暂无内容')}
          description={t('还没有已发布的智能体')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <AgentHallCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </HallShell>
  )
}
