"use client"

import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import {
  BookOpen, GraduationCap, FileText, Search, Layers,
  Clock, AlertCircle, Loader2, MapPin, ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { courseApi } from "@/lib/api"
import type { Course } from "@/lib/types"
import { PlatformFooter } from "@/components/job/student/platform-footer"

const courseTypeMap: Record<string, string> = {
  system: "体系课", granular: "颗粒课", hybrid: "混合课",
}

const coverGradients = [
  "linear-gradient(135deg,#059669,#10b981)",
  "linear-gradient(135deg,#0891b2,#06b6d4)",
  "linear-gradient(135deg,#7c3aed,#8b5cf6)",
  "linear-gradient(135deg,#db2777,#ec4899)",
  "linear-gradient(135deg,#ea580c,#f97316)",
  "linear-gradient(135deg,#2563eb,#3b82f6)",
]

interface FilterBarProps {
  label: string
  options: string[]
  selected: string
  onChange: (v: string) => void
}
function FilterBar({ label, options, selected, onChange }: FilterBarProps) {
  if (options.length <= 1) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[13px] text-slate-400 shrink-0">{label}：</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer border ${
              selected === opt
                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function CourseCard({ course, index }: { course: Course; index: number }) {
  return (
    <Link href={`/lesson/landing/${course.id}`} className="group block no-underline text-inherit">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-emerald-200 hover:-translate-y-0.5 transition-all h-full flex flex-col">
        <div className="h-[120px] flex items-center justify-center shrink-0 relative" style={{ background: coverGradients[index % coverGradients.length] }}>
          <span className="text-white text-lg font-bold drop-shadow-lg">{course.name.slice(0, 8)}</span>
          <span className="absolute top-3 right-3 bg-white/25 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
            已发布
          </span>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{course.name}</h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {course.majorName && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {course.majorName}
              </span>
            )}
            {course.industryName && (
              <span className="text-[11px] text-slate-400">{course.industryName}</span>
            )}
            {course.batchName && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-100">{course.batchName}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">{course.description || "暂无课程描述"}</p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-50 pt-3">
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {course.nodeCount} 节点</span>
            <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {course.resourceCount} 资源</span>
            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {course.studyCount} 人次</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {course.onlineHours || 0}h</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function LessonLandingPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")

  const [industryFilter, setIndustryFilter] = useState("全部")
  const [batchFilter, setBatchFilter] = useState("全部")
  const [sort, setSort] = useState<"default" | "recent" | "update">("default")

  useEffect(() => {
    setLoading(true)
    setError(false)
    courseApi.list({ status: "published", limit: 1000 } as any).then((res) => {
      setCourses(res.items || [])
    }).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  const industries = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c) => { if (c.industryName) set.add(c.industryName) })
    return ["全部", ...Array.from(set).sort()]
  }, [courses])

  const batches = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c) => { if (c.batchName) set.add(c.batchName) })
    return ["全部", ...Array.from(set).sort()]
  }, [courses])

  const filteredCourses = useMemo(() => {
    let list = courses

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.majorName || "").toLowerCase().includes(q)
      )
    }

    if (industryFilter !== "全部") {
      list = list.filter((c) => c.industryName === industryFilter)
    }

    if (batchFilter !== "全部") {
      list = list.filter((c) => c.batchName === batchFilter)
    }

    if (sort === "recent") {
      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (sort === "update") {
      list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return list
  }, [courses, search, industryFilter, batchFilter, sort])

  const systemCourses = useMemo(() => filteredCourses.filter((c) => c.type === "system"), [filteredCourses])
  const granularCourses = useMemo(() => filteredCourses.filter((c) => c.type === "granular"), [filteredCourses])

  const totalNodes = courses.reduce((sum, c) => sum + (c.nodeCount || 0), 0)
  const totalResources = courses.reduce((sum, c) => sum + (c.resourceCount || 0), 0)

  const stats = [
    { num: courses.length, label: "已发布课程", icon: BookOpen, color: "#059669" },
    { num: systemCourses.length + (filteredCourses.filter((c) => c.type === "hybrid").length), label: "体系课", icon: GraduationCap, color: "#0891b2" },
    { num: totalNodes, label: "课程节点", icon: Layers, color: "#7c3aed" },
    { num: totalResources, label: "教学资源", icon: FileText, color: "#db2777" },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #064e3b 0%, #047857 40%, #059669 100%)" }}
      >
        <div className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="max-w-[640px] mx-auto text-center">
            <h1 className="text-[40px] font-bold text-white mb-3 tracking-tight">课程教学管理平台</h1>
            <p className="text-[15px] text-white/85 mb-8">体系化课程设计、颗粒化知识点管理、多维度教学资源整合，让教与学更高效</p>
            <div className="bg-white rounded-full p-1.5 pl-6 flex items-center shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="搜索课程名称、描述、专业"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 border-none outline-none text-sm py-3 text-slate-700 bg-transparent"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 text-sm px-3 shrink-0">清除</button>
              )}
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
        ) : error ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-slate-500 mb-4">加载课程列表失败，请稍后重试</p>
            <Button onClick={() => window.location.reload()} className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/25">
              重新加载
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
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

            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 mb-8">
              <div className="flex flex-col md:flex-row md:items-center gap-4 flex-wrap">
                <FilterBar label="行业筛选" options={industries} selected={industryFilter} onChange={setIndustryFilter} />
                <FilterBar label="批次分组" options={batches} selected={batchFilter} onChange={setBatchFilter} />
                <div className="flex items-center gap-2 ml-auto">
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                  {[
                    { key: "default", label: "默认排序" },
                    { key: "recent", label: "最近收录" },
                    { key: "update", label: "最近更新" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSort(s.key as typeof sort)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer border ${
                        sort === s.key
                          ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">{search || industryFilter !== "全部" || batchFilter !== "全部" ? "没有找到匹配的课程" : "暂无已发布课程"}</div>
              </div>
            ) : (
              <>
                {systemCourses.length > 0 && (
                  <div className="mb-10">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-400" />
                        体系课
                        <span className="text-[13px] text-slate-400 font-normal ml-1">({systemCourses.length})</span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {systemCourses.map((course, i) => (
                        <CourseCard key={course.id} course={course} index={i} />
                      ))}
                    </div>
                  </div>
                )}

                {granularCourses.length > 0 && (
                  <div className="mb-10">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-1 h-6 rounded-full bg-gradient-to-b from-cyan-500 to-cyan-400" />
                        颗粒课
                        <span className="text-[13px] text-slate-400 font-normal ml-1">({granularCourses.length})</span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {granularCourses.map((course, i) => (
                        <CourseCard key={course.id} course={course} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <PlatformFooter />
    </div>
  )
}
