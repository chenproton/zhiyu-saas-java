'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarRange, CalendarCheck2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@zhiyu/ui'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { teachingPlanApi } from '@/lib/api'
import type { TeachingPlan, TeachingPlanDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ScheduleGridTab } from './_components/schedule-grid-tab'
import { TimetableViewTab } from './_components/timetable-view-tab'

const STEPS = [
  { id: 'grid', label: '自定义排课', icon: CalendarRange },
  { id: 'timetable', label: '课表视图与发布', icon: CalendarCheck2 },
] as const

type StepId = (typeof STEPS)[number]['id']

function SchedulingPageInner() {
  const searchParams = useSearchParams()
  const planIdParam = searchParams.get('planId') || undefined
  const { toast } = useToast()

  const [step, setStep] = useState<StepId>('grid')
  const [plans, setPlans] = useState<TeachingPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [planDetail, setPlanDetail] = useState<TeachingPlanDetail | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  const loadPlans = useCallback(async () => {
    try {
      const res = await teachingPlanApi.list({ status: 'confirmed', limit: 200 })
      setPlans(res.items)
      const targetId = planIdParam || (res.items[0]?.id ?? '')
      setPlanId((prev) => prev || targetId)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '查询教学计划列表失败',
      })
    }
  }, [planIdParam, toast])

  const loadPlanDetail = useCallback(
    async (id: string) => {
      if (!id) {
        setPlanDetail(null)
        return
      }
      setLoadingPlan(true)
      try {
        const detail = await teachingPlanApi.get(id)
        setPlanDetail(detail)
      } catch {
        toast({ variant: 'destructive', title: '加载失败', description: '查询教学计划详情失败' })
      } finally {
        setLoadingPlan(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    ;(async () => {
      await loadPlans()
    })()
  }, [loadPlans])
  useEffect(() => {
    ;(async () => {
      await loadPlanDetail(planId)
    })()
  }, [planId, loadPlanDetail])

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId])

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="排课管理"
        description={
          selectedPlan
            ? `当前教学计划：${selectedPlan.programName} · ${selectedPlan.termName} · ${selectedPlan.majorName || ''} ${selectedPlan.entryYear}级`
            : '选择教学计划开始排课，发布后学生/教师工作台可见'
        }
        actions={
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="请选择教学计划" />
            </SelectTrigger>
            <SelectContent>
              {plans.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  暂无可用的已确认教学计划，请先在「教学计划」中生成并确认
                </SelectItem>
              ) : (
                plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.programName} · {p.termName}
                    {p.majorName ? ` · ${p.majorName}` : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        }
      />

      <div className="rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {STEPS.map((s, idx) => {
            const Icon = s.icon
            const isActive = step === s.id
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {idx + 1}
                </span>
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {step === 'grid' && !selectedPlan && (
        <div className="rounded-lg border bg-white py-16 text-center text-sm text-muted-foreground">
          请先在顶部选择已确认的教学计划
        </div>
      )}
      {step === 'grid' && selectedPlan && planDetail && (
        <ScheduleGridTab
          plan={selectedPlan}
          planEntries={planDetail.entries}
          onPlanChanged={() => loadPlanDetail(planId)}
        />
      )}
      {step === 'timetable' && selectedPlan && (
        <TimetableViewTab
          term={
            {
              id: selectedPlan.termId,
              name: selectedPlan.termName,
              startDate: '',
              endDate: '',
              weeksCount: 0,
              isCurrent: false,
              createdAt: '',
            } as any
          }
        />
      )}
    </div>
  )
}

export default function SchedulingPage() {
  return (
    <Suspense
      fallback={<div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>}
    >
      <SchedulingPageInner />
    </Suspense>
  )
}
