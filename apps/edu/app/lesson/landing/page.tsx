"use client"

import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import {
  BookOpen, GraduationCap, FileText, Search, Layers,
  Clock, AlertCircle, BarChart3, Loader2, MapPin,
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

export default function LessonLandingPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    setError(false)
    courseApi.list({ limit: 100 }).then((res) => {
      setCourses(res.items || [])
    }).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courses
    const q = search.toLowerCase()
    return courses.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q) ||
      (c.majorName || "").toLowerCase().includes(q)
    )
  }, [courses, search])

  const publishedCourses = useMemo(() => filteredCourses.filter((c) => c.status === "published").slice(0, 6), [filteredCourses])
  const totalNodes = courses.reduce((sum, c) => sum + (c.nodeCount || 0), 0)
  const totalResources = courses.reduce((sum, c) => sum + (c.resourceCount || 0), 0)

  const stats = [
    { num: courses.length, label: "课程数量", icon: BookOpen, color: "#059669" },
    { num: publishedCourses.length, label: "已发布课程", icon: GraduationCap, color: "#0891b2" },
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
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

            <div className="mb-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-400" />
                  {search ? `搜索结果（${filteredCourses.length}）` : "精选课程"}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {publishedCourses.map((course, i) => (
                  <Link key={course.id} href={`/lesson/landing/${course.id}`} className="group block no-underline text-inherit">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-emerald-200 hover:-translate-y-0.5 transition-all h-full flex flex-col">
                      <div className="h-[120px] flex items-center justify-center shrink-0 relative" style={{ background: coverGradients[i % coverGradients.length] }}>
                        <span className="text-white text-lg font-bold drop-shadow-lg">{course.name.slice(0, 8)}</span>
                        <span className="absolute top-3 right-3 bg-white/25 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
                          已发布
                        </span>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">{course.name}</h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium border border-emerald-100">
                            {courseTypeMap[course.type] || course.type}
                          </span>
                          {course.majorName && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {course.majorName}
                            </span>
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
                ))}
                {publishedCourses.length === 0 && (
                  <div className="col-span-3 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 opacity-40" />
                    </div>
                    <div className="text-[15px] font-medium text-slate-600">{search ? "没有找到匹配的课程" : "暂无已发布课程"}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-400" />
                  平台优势
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { title: "体系化课程设计", desc: "从基础到进阶，覆盖专业核心知识体系，匹配岗位能力模型", icon: <BookOpen className="w-6 h-6" /> },
                  { title: "颗粒化知识管理", desc: "知识点精细拆分、独立管理、灵活组合，支持跨课程复用", icon: <Layers className="w-6 h-6" /> },
                  { title: "多维度教学评价", desc: "线上学习 + 线下实训，过程评价 + 结果考核，全面评估学习效果", icon: <BarChart3 className="w-6 h-6" /> },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <h3 className="text-[16px] font-semibold text-slate-800 mb-2">{item.title}</h3>
                    <p className="text-[13px] text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <PlatformFooter />
    </div>
  )
}
