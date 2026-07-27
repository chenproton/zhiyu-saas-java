"use client"

import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import {
  Clock, FileText, Search, Layers, Library, ClipboardList, Loader2, PlayCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { questionBankApi, examApi } from "@/lib/api"
import type { QuestionBank, Exam } from "@/lib/types"
import { PlatformFooter } from "@/components/job/student/platform-footer"

const coverGradients = [
  "linear-gradient(135deg,#2563eb,#3b82f6)",
  "linear-gradient(135deg,#7c3aed,#8b5cf6)",
  "linear-gradient(135deg,#059669,#10b981)",
  "linear-gradient(135deg,#db2777,#ec4899)",
  "linear-gradient(135deg,#ea580c,#f97316)",
  "linear-gradient(135deg,#0891b2,#06b6d4)",
]

export default function LandingHomePage() {
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"banks" | "exams">("banks")

  useEffect(() => {
    setLoading(true)
    Promise.all([
      questionBankApi.list({ limit: 100 }).then((res) => setBanks(res.items || [])),
      examApi.list({ limit: 100 }).then((res) => setExams(res.items || [])),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const publishedBanks = useMemo(() => banks.filter((b) => b.status === "published"), [banks])
  const publishedExams = useMemo(() => exams.filter((e) => e.status === "published"), [exams])
  const totalQuestions = useMemo(() => banks.reduce((sum, b) => sum + (b.questionCount || 0), 0), [banks])

  const filteredBanks = useMemo(() => {
    if (!search) return publishedBanks.slice(0, 4)
    const q = search.toLowerCase()
    return publishedBanks.filter((b) => b.name.toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q)).slice(0, 4)
  }, [publishedBanks, search])

  const filteredExams = useMemo(() => {
    if (!search) return publishedExams.slice(0, 4)
    const q = search.toLowerCase()
    return publishedExams.filter((e) => e.name.toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q)).slice(0, 4)
  }, [publishedExams, search])

  const stats = [
    { num: publishedBanks.length, label: "已发布题库", icon: Library, color: "#2563eb" },
    { num: publishedExams.length, label: "已发布试卷", icon: ClipboardList, color: "#7c3aed" },
    { num: totalQuestions, label: "题目总数", icon: FileText, color: "#059669" },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 40%, #3b82f6 100%)" }}
      >
        <div className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="max-w-[640px] mx-auto text-center">
            <h1 className="text-[40px] font-bold text-white mb-3 tracking-tight">测评资源平台</h1>
            <p className="text-[15px] text-white/85 mb-8">海量题库与试卷资源，支持在线考试与智能组卷，助力教学测评</p>
            <div className="bg-white rounded-full p-1.5 pl-6 flex items-center shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="搜索题库、试卷名称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 border-none outline-none text-sm py-3 text-slate-700 bg-transparent"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 text-sm px-3 shrink-0">清除</button>
              )}
              <button className="bg-gradient-to-r from-blue-500 to-blue-400 text-white border-none px-8 py-3 rounded-full text-sm font-medium cursor-pointer hover:from-blue-600 hover:to-blue-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all shrink-0">
                搜索
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-6 py-10 w-full">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-[100px] w-full rounded-xl" />
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
              {stats.map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center gap-4 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.color + "15" }}>
                    <s.icon className="w-6 h-6" style={{ color: s.color }} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{s.num}</div>
                    <div className="text-[13px] text-slate-400">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex border-b border-slate-200 mb-8">
              {[
                { key: "banks", label: "题库中心", count: publishedBanks.length },
                { key: "exams", label: "试卷中心", count: publishedExams.length },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as "banks" | "exams")}
                  className={`
                    py-4 px-6 text-[14px] whitespace-nowrap relative transition-all cursor-pointer flex items-center gap-1.5
                    ${tab === t.key ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50/40"}
                  `}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${tab === t.key ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                      {t.count}
                    </span>
                  )}
                  {tab === t.key && <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-500 rounded-t-full" />}
                </button>
              ))}
              <div className="flex-1 border-b border-slate-200" />
              {tab === "exams" && (
                <Link href="/evaluation/landing/exams" className="py-4 px-4 text-[13px] text-blue-600 hover:text-blue-700 whitespace-nowrap font-medium">
                  查看全部 →
                </Link>
              )}
            </div>

            {tab === "banks" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredBanks.map((bank, i) => (
                  <Link key={bank.id} href={`/evaluation/landing/banks/${bank.id}`} className="group block no-underline text-inherit">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-blue-200 hover:-translate-y-0.5 transition-all h-full flex flex-col">
                      <div className="h-[100px] flex items-center justify-center shrink-0" style={{ background: coverGradients[i % coverGradients.length] }}>
                        <Library className="w-10 h-10 text-white/90" />
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{bank.name}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">{bank.description || "暂无描述"}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-3">
                          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {bank.questionCount} 题</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> v{bank.version}</span>
                          <span>查看详情 →</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {filteredBanks.length === 0 && (
                  <div className="col-span-4 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Library className="w-8 h-8 opacity-40" />
                    </div>
                    <div className="text-[15px] font-medium text-slate-600">暂无已发布题库</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredExams.map((exam, i) => (
                  <Link key={exam.id} href={`/evaluation/landing/exams/${exam.id}`} className="group block no-underline text-inherit">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-blue-200 hover:-translate-y-0.5 transition-all h-full flex flex-col">
                      <div className="h-[100px] flex items-center justify-center shrink-0" style={{ background: coverGradients[(i + 3) % coverGradients.length] }}>
                        <ClipboardList className="w-10 h-10 text-white/90" />
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{exam.name}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">{exam.description || "暂无描述"}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-3 mb-3">
                          <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {exam.questions.length} 题</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {exam.duration} 分钟</span>
                        </div>
                        <Button className="w-full rounded-xl h-9 text-xs bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all">
                          <PlayCircle className="w-3.5 h-3.5 mr-1" /> 去考试
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
                {filteredExams.length === 0 && (
                  <div className="col-span-4 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <ClipboardList className="w-8 h-8 opacity-40" />
                    </div>
                    <div className="text-[15px] font-medium text-slate-600">暂无已发布试卷</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <PlatformFooter />
    </div>
  )
}
