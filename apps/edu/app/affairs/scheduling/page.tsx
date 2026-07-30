"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarCog, CalendarRange, CalendarCheck2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@zhiyu/ui"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { termApi } from "@/lib/api"
import type { AffairsTerm } from "@/lib/types"
import { cn } from "@/lib/utils"
import { VenuePeriodConfigTab } from "./_components/venue-period-config-tab"
import { ScheduleGridTab } from "./_components/schedule-grid-tab"
import { TimetableViewTab } from "./_components/timetable-view-tab"

const STEPS = [
  { id: "config", label: "教务基础配置", icon: CalendarCog },
  { id: "grid", label: "自定义排课", icon: CalendarRange },
  { id: "timetable", label: "课表视图与发布", icon: CalendarCheck2 },
] as const

type StepId = (typeof STEPS)[number]["id"]

function SchedulingPageInner() {
  const searchParams = useSearchParams()
  const planId = searchParams.get("planId") || undefined
  const { toast } = useToast()

  const [step, setStep] = useState<StepId>(planId ? "grid" : "config")
  const [terms, setTerms] = useState<AffairsTerm[]>([])
  const [termId, setTermId] = useState("")

  const loadTerms = useCallback(async () => {
    try {
      const res = await termApi.list({ limit: 100 })
      setTerms(res.items)
      setTermId((prev) => {
        if (prev && res.items.some((t) => t.id === prev)) return prev
        return res.items.find((t) => t.isCurrent)?.id || res.items[0]?.id || ""
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "查询学期列表失败" })
    }
  }, [toast])

  useEffect(() => {
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadTerms()
    })()
  }, [loadTerms])

  const currentTerm = useMemo(() => terms.find((t) => t.id === termId) || null, [terms, termId])

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="排课管理"
        description="按「基础配置 → 自定义排课 → 课表视图与发布」三步完成排课，发布后学生/教师工作台可见"
        actions={
          <Select value={termId} onValueChange={setTermId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="请选择学期" />
            </SelectTrigger>
            <SelectContent>
              {terms.length === 0 ? (
                <SelectItem value="__empty" disabled>
                  暂无学期，请先在「教务基础配置」中创建
                </SelectItem>
              ) : (
                terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.isCurrent ? "（当前学期）" : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        }
      />

      {/* 步骤导航条 */}
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
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  isActive ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
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

      {step === "config" && <VenuePeriodConfigTab onTermsChanged={loadTerms} />}
      {step === "grid" && <ScheduleGridTab term={currentTerm} planId={planId} />}
      {step === "timetable" && <TimetableViewTab term={currentTerm} />}
    </div>
  )
}

export default function SchedulingPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>}>
      <SchedulingPageInner />
    </Suspense>
  )
}
