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
import { useToast, EmptyState } from '@zhiyu/ui'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { teachingPlanApi, termApi } from '@/lib/api'
import type { TeachingPlan, TeachingPlanDetail, AffairsTerm } from '@/lib/types'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/error-handling'
import { ScheduleGridTab } from './_components/schedule-grid-tab'
import { TimetableViewTab } from './_components/timetable-view-tab'
import { useT } from '@/lib/i18n/locale-provider'

const STEPS = [
  { id: 'grid', label: '自定义排课', icon: CalendarRange },
  { id: 'timetable', label: '课表视图与发布', icon: CalendarCheck2 },
] as const

type StepId = (typeof STEPS)[number]['id']

function SchedulingPageInner() {
  const searchParams = useSearchParams()
  const planIdParam = searchParams.get('planId') || undefined
  const { toast } = useToast()
  const t = useT()

  const [step, setStep] = useState<StepId>('grid')
  const [plans, setPlans] = useState<TeachingPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [planDetail, setPlanDetail] = useState<TeachingPlanDetail | null>(null)

  const loadPlans = useCallback(async () => {
    try {
      const res = await teachingPlanApi.list({ status: 'published', limit: 200 })
      setPlans(res.items)
      const targetId = planIdParam || (res.items[0]?.id ?? '')
      setPlanId((prev) => prev || targetId)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err.message || t('查询教学计划列表失败'),
      })
    }
  }, [planIdParam, toast, t])

  const loadPlanDetail = useCallback(
    async (id: string) => {
      if (!id) {
        setPlanDetail(null)
        return
      }
      try {
        const detail = await teachingPlanApi.get(id)
        setPlanDetail(detail)
      } catch {
        toast({
          variant: 'destructive',
          title: t('加载失败'),
          description: t('查询教学计划详情失败'),
        })
      }
    },
    [toast, t],
  )

  useEffect(() => {
    ;(async () => {
      await loadPlans()
    })()
  }, [loadPlans])
  // planId 参数变化时同步切换选中计划：SPA 内后续跳转携带不同 ?planId= 也能跟随，
  // 而不是仅在首次加载时 setPlanId(prev => prev || targetId)
  useEffect(() => {
    if (planIdParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 参数驱动的受控同步
      setPlanId(planIdParam)
    }
  }, [planIdParam])
  useEffect(() => {
    ;(async () => {
      await loadPlanDetail(planId)
    })()
  }, [planId, loadPlanDetail])

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId])
  const [selectedTerm, setSelectedTerm] = useState<AffairsTerm | null>(null)

  // 选中计划变化时拉取完整 term（周数/日期用于课表视图）
  // 异步加载不回写同步 setState；termId 变化时由 term 查询结果驱动
  useEffect(() => {
    if (!selectedPlan?.termId) return
    let cancelled = false
    termApi
      .list({ search: selectedPlan.termId })
      .then((res) => {
        if (!cancelled) {
          const t = (res.items || []).find((x) => x.id === selectedPlan.termId)
          setSelectedTerm(t ?? null)
        }
      })
      .catch((err) => {
        if (!cancelled) reportError(err, '加载学期信息')
      })
    return () => {
      cancelled = true
    }
  }, [selectedPlan?.termId])

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title={t('排课管理')}
        description={
          selectedPlan
            ? t('当前教学计划：{name} · {term} · {major} {n}级', {
                name: selectedPlan.programName || '',
                term: selectedPlan.termName || '',
                major: selectedPlan.majorName || '',
                n: selectedPlan.entryYear,
              })
            : t('选择教学计划开始排课，发布后学生/教师工作台可见')
        }
        actions={
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder={t('请选择教学计划')} />
            </SelectTrigger>
            <SelectContent>
              {plans.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  {t('暂无可用的已确认教学计划，请先在「教学计划」中生成并确认')}
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
                    ? 'bg-primary text-white shadow-sm'
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
                {t(s.label)}
              </button>
            )
          })}
        </div>
      </div>

      {step === 'grid' && !selectedPlan && (
        <EmptyState
          title={t('请先在顶部选择已确认的教学计划')}
          className="rounded-lg border bg-white py-16"
        />
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
            selectedTerm ?? {
              id: selectedPlan.termId,
              name: selectedPlan.termName || '',
              startDate: '',
              endDate: '',
              weeksCount: 16,
              isCurrent: false,
              createdAt: '',
            } as AffairsTerm
          }
        />
      )}
    </div>
  )
}

export default function SchedulingPage() {
  const t = useT()
  return (
    <Suspense
      fallback={<div className="py-16 text-center text-sm text-muted-foreground">{t('加载中...')}</div>}
    >
      <SchedulingPageInner />
    </Suspense>
  )
}