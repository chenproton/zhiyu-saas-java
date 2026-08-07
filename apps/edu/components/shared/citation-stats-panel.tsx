'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, FileX2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { CitationStats, UncitedItem } from '@/lib/types/library'
import { UncitedResourcesDialog } from './uncited-resources-dialog'

interface CitationStatsPanelProps {
  /** 实体名称，如「知识点」「资源」 */
  entityLabel: string
  /** 弹窗标题，如「零引用知识点」 */
  dialogTitle: string
  fetchStats: (params?: { resourceType?: string }) => Promise<CitationStats>
  fetchUncited: (params: {
    resourceType?: string
    startDate?: string
    endDate?: string
    limit: number
    offset: number
  }) => Promise<{ items: UncitedItem[]; total: number }>
  deleteItem: (id: string) => Promise<unknown>
  /** 批量删除成功后回调（刷新页面列表/统计） */
  onDeleted?: () => void
  /** 单类型视图下按类型过滤统计 */
  resourceType?: string
}

/**
 * 库页面顶部指标：引用次数分布柱状图 + 零引用数量卡片（点击弹出管理弹窗）。
 * 引用次数由后端统计（课程/节点/题库等引用源），分桶：0/1-5/6-10/11-100/100 以上。
 */
export function CitationStatsPanel({
  entityLabel,
  dialogTitle,
  fetchStats,
  fetchUncited,
  deleteItem,
  onDeleted,
  resourceType,
}: CitationStatsPanelProps) {
  const [stats, setStats] = useState<CitationStats | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchStats(resourceType ? { resourceType } : undefined)
      setStats(res)
    } catch {
      setStats(null)
    }
  }, [fetchStats, resourceType])

  // 将首载视为外部事件：在微任务回调中分发加载，避免 effect 体内同步 setState
  useEffect(() => {
    Promise.resolve().then(loadStats)
  }, [loadStats])

  const chartData = stats?.buckets || []

  return (
    <>
      <Card className="border-0 shadow-sm flex-1 min-w-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <BarChart3 className="size-4 text-indigo-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">引用次数分布</div>
              <div className="text-xs text-slate-400">
                共 {stats?.total ?? '-'} 个{entityLabel}
              </div>
            </div>
          </div>
          <div className="h-28">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: any) => [`${value} 个`, '数量']}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-300">
                暂无统计数据
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="text-left cursor-pointer rounded-xl border-0 shadow-sm bg-gradient-to-br from-rose-50 to-orange-50 hover:from-rose-100 hover:to-orange-100 transition-colors p-4 w-52 shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
            <FileX2 className="size-4 text-rose-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-500">{stats?.zeroCount ?? '-'}</div>
            <div className="text-xs text-rose-400">零引用{entityLabel}</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-rose-300">
          点击查看并批量删除从未被引用的{entityLabel}
        </div>
      </button>

      <UncitedResourcesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        entityLabel={entityLabel}
        fetchUncited={(params) =>
          fetchUncited(resourceType ? { ...params, resourceType } : params)
        }
        deleteItem={deleteItem}
        onDeleted={() => {
          onDeleted?.()
          void loadStats()
        }}
      />
    </>
  )
}
