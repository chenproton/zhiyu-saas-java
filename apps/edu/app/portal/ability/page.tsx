"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle, Clock, Loader2, Search } from "lucide-react"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildQuery, portalRequest, type ListResponse } from "@/lib/api"
import type { Exam, QuestionBank } from "@/lib/types/evaluation"

type AbilityKind = "all" | "bank" | "exam"

type AbilityItem =
  | ({ kind: "bank" } & QuestionBank)
  | ({ kind: "exam" } & Exam)

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  pending: "审批中",
  rejected: "已驳回",
  approved: "已通过",
  published: "已发布",
  archived: "已归档",
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status
  return (
    <Badge variant={status === "published" ? "default" : "secondary"}>
      {label}
    </Badge>
  )
}

function formatDate(value: string | Date) {
  try {
    return new Date(value).toLocaleDateString("zh-CN")
  } catch {
    return "-"
  }
}

export default function AbilityPortalPage() {
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<AbilityKind>("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [banksRes, examsRes] = await Promise.all([
        portalRequest<ListResponse<QuestionBank>>(
          `/evaluation/question-banks${buildQuery({ limit: 1000 })}`
        ),
        portalRequest<ListResponse<Exam>>(
          `/evaluation/exams${buildQuery({ status: "published", limit: 1000 })}`
        ),
      ])
      setBanks(banksRes.items || [])
      setExams(examsRes.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const allItems = useMemo<AbilityItem[]>(
    () => [
      ...banks.map((b) => ({ kind: "bank" as const, ...b })),
      ...exams.map((e) => ({ kind: "exam" as const, ...e })),
    ],
    [banks, exams]
  )

  const filtered = useMemo(() => {
    let result = allItems
    if (activeTab !== "all") {
      result = result.filter((i) => i.kind === activeTab)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      )
    }
    return result
  }, [allItems, activeTab, query])

  return (
    <div className="min-h-screen bg-[#eef1f8]">
      <div className="max-w-[1312px] mx-auto px-10 py-8 space-y-6">
        <PageHeaderCard
          title="COFA 测评中心"
          description="基于统一评价标准，精准量化评估与技能认证"
        />

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col sm:flex-row gap-4 p-5">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as AbilityKind)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full sm:w-auto grid-cols-3">
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="bank">题库</TabsTrigger>
                <TabsTrigger value="exam">试卷</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索测评资源名称 / 描述"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-slate-700">暂无测评资源</h3>
            <p className="text-sm text-slate-500">当前筛选条件下没有题库或试卷数据</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((item) =>
              item.kind === "bank" ? (
                <BankCard key={item.id} item={item} />
              ) : (
                <ExamCard key={item.id} item={item} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BankCard({ item }: { item: QuestionBank }) {
  return (
    <Link href="#" className="group block">
      <Card className="overflow-hidden border-slate-200 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md h-full flex flex-col">
        {item.coverImage ? (
          <img
            src={item.coverImage}
            alt={item.name}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="h-40 w-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-white/80" />
          </div>
        )}
        <CardContent className="p-5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-slate-900 line-clamp-1">{item.name}</h3>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm text-slate-500 line-clamp-2 mb-3 flex-1">
            {item.description || "暂无简介"}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>题目：{item.questionCount} 道</span>
            <span>版本：{item.version}</span>
            <span>更新：{formatDate(item.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function ExamCard({ item }: { item: Exam }) {
  return (
    <Link href="#" className="group block">
      <Card className="overflow-hidden border-slate-200 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md h-full flex flex-col">
        {item.coverImage ? (
          <img
            src={item.coverImage}
            alt={item.name}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="h-40 w-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Clock className="w-12 h-12 text-white/80" />
          </div>
        )}
        <CardContent className="p-5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-slate-900 line-clamp-1">{item.name}</h3>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm text-slate-500 line-clamp-2 mb-3 flex-1">
            {item.description || "暂无简介"}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.duration} 分钟
            </span>
            <span>题目：{(item.questions ?? []).length} 道</span>
            <span>总分：{item.totalScore} 分</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
