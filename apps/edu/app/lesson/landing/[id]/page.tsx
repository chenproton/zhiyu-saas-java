"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, ListChecks, FolderOpen, GitBranch, Target,
  Clock, Layers, BookOpen, Sparkles, PlayCircle, FileText,
  Send, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  courseApi,
  courseAssessmentsApi,
  courseHomeworkApi,
  courseNodeApi,
  courseResourceApi,
  knowledgeApi,
} from "@/lib/api"
import type {
  Course,
  SystemCourseNode,
  NodeResource,
  KnowledgePoint,
} from "@/lib/types"
import type { CourseAssessmentsResponse, CourseAssessmentHomework, CourseHomeworkSubmission } from "@zhiyu/api-client"
import { useAuth } from "@/contexts/auth-context"
import { PlatformFooter } from "@/components/job/student/platform-footer"

const TABS = [
  { value: "nodes", label: "课程目录", icon: ListChecks },
  { value: "resources", label: "课程资源", icon: FolderOpen },
  { value: "knowledge", label: "知识图谱", icon: GitBranch },
  { value: "evaluation", label: "评价标准", icon: Target },
]

const coverGradients = [
  "linear-gradient(135deg,#059669,#10b981)",
  "linear-gradient(135deg,#0891b2,#06b6d4)",
  "linear-gradient(135deg,#7c3aed,#8b5cf6)",
  "linear-gradient(135deg,#db2777,#ec4899)",
  "linear-gradient(135deg,#ea580c,#f97316)",
]

const courseTypeLabels: Record<string, string> = {
  system: "体系课", granular: "颗粒课", hybrid: "混合课",
}

const difficultyMap: Record<number, { color: string; label: string }> = {
  1: { color: "#22c55e", label: "入门" },
  2: { color: "#eab308", label: "初级" },
  3: { color: "#f97316", label: "中级" },
  4: { color: "#ef4444", label: "高级" },
  5: { color: "#8b5cf6", label: "专家" },
}

const resourceTypeLabels: Record<string, string> = {
  document: "文档", video: "视频", link: "链接", file: "文件",
  spreadsheet: "表格", presentation: "演示", image: "图片",
  audio: "音频", pdf: "PDF", venue: "场所", facility: "设施",
  software: "软件",
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "-"
  return dateStr.split("T")[0] || dateStr.split(" ")[0] || dateStr
}

function KnowledgeTab({ knowledgeList }: { knowledgeList: KnowledgePoint[] }) {
  if (knowledgeList.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
          <GitBranch className="w-8 h-8 opacity-40" />
        </div>
        <div className="text-[15px] font-medium text-slate-600">暂无关联知识点</div>
        <div className="text-[13px] mt-1">该课程暂未关联知识点</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-100">
        <div className="flex items-center gap-2 text-emerald-800 font-bold mb-2">
          <Sparkles className="w-5 h-5" />
          知识体系说明
        </div>
        <p className="text-sm text-[#475569]">
          本课程涵盖 <strong className="text-emerald-600">{knowledgeList.length}</strong> 个知识点，帮助学生系统掌握专业知识体系。
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {knowledgeList.map((kp) => (
          <div key={kp.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-emerald-200 hover:shadow-md transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="font-semibold text-sm text-slate-800">{kp.name}</div>
            </div>
            {kp.code && <div className="text-[11px] text-slate-400 mb-1 font-mono">ID：{kp.code}</div>}
            {kp.description && <div className="text-xs text-slate-500 leading-relaxed line-clamp-3">{kp.description}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CourseDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const { user } = useAuth()
  const isStudent = user?.currentRole?.name === "student"

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("nodes")

  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [resources, setResources] = useState<NodeResource[]>([])
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [assessments, setAssessments] = useState<CourseAssessmentsResponse | null>(null)
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)

  const [submitOpen, setSubmitOpen] = useState(false)
  const [activeHomework, setActiveHomework] = useState<CourseAssessmentHomework | null>(null)
  const [submitContent, setSubmitContent] = useState("")
  const [submitUrls, setSubmitUrls] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [gradeOpen, setGradeOpen] = useState(false)
  const [submissions, setSubmissions] = useState<CourseHomeworkSubmission[]>([])
  const [gradeSubmission, setGradeSubmission] = useState<CourseHomeworkSubmission | null>(null)
  const [gradeScore, setGradeScore] = useState("")
  const [gradeComment, setGradeComment] = useState("")
  const [grading, setGrading] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const c = await courseApi.get(id)
        if (!cancelled) setCourse(c)
      } catch {
        if (!cancelled) setCourse(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id || !course) return

    courseNodeApi.list({ courseId: id, limit: 1000 } as any)
      .then((res) => setNodes((res.items || []) as any))
      .catch(() => setNodes([]))

    courseResourceApi.list({ courseId: id, limit: 10000 })
      .then((res) => setResources(res.items || []))
      .catch(() => setResources([]))

    knowledgeApi.list({ limit: 1000 })
      .then((res) => {
        const m = new Map<string, KnowledgePoint>()
        ;(res.items || []).forEach((k) => m.set(k.id, k))
        setKnowledgeMap(m)
      })
      .catch(() => setKnowledgeMap(new Map()))

    if (course.type === "system" && activeTab === "evaluation") {
      setAssessmentsLoading(true)
      courseAssessmentsApi.get(id)
        .then(setAssessments)
        .catch(() => setAssessments({ exams: [], homeworks: [] }))
        .finally(() => setAssessmentsLoading(false))
    }
  }, [id, course, activeTab])

  const totalResources = resources.length
  const courseKnowledgeList = useMemo(() => {
    const ids = new Set(course?.knowledgePointIds || [])
    nodes.forEach((n) => n.knowledgePointIds?.forEach((kid) => ids.add(kid)))
    return Array.from(ids).map((kid) => knowledgeMap.get(kid)).filter(Boolean) as KnowledgePoint[]
  }, [course, nodes, knowledgeMap])

  const totalEvalCount = useMemo(() => {
    let count = 0
    nodes.forEach((n) => {
      if (n.teachingGoals) count++ // count nodes with evaluation configs
    })
    return count
  }, [nodes])

  const diff = difficultyMap[course?.difficulty ?? 3] || difficultyMap[3]

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <Skeleton className="h-[320px] w-full" />
        <div className="max-w-[1400px] mx-auto px-6 py-6 w-full flex-1">
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
        <PlatformFooter />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-20 h-20 mb-5 rounded-3xl bg-slate-100 flex items-center justify-center">
            <BookOpen className="w-10 h-10 opacity-40" />
          </div>
          <div className="text-lg font-semibold text-slate-600">课程不存在或暂未公开</div>
          <Link href="/lesson/landing" className="text-emerald-600 hover:text-emerald-700 mt-3 text-sm font-medium">返回课程列表</Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  const coverStyle = course.coverImage
    ? { backgroundImage: `url('${course.coverImage}')` }
    : { background: coverGradients[0] }

  const renderTabContent = () => {
    switch (activeTab) {
      case "nodes":
        return (
          <div>
            {nodes.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <ListChecks className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">暂无课程节点</div>
                <div className="text-[13px] mt-1">该课程暂未配置章节节点</div>
              </div>
            ) : (
              <div className="space-y-3">
                {nodes.sort((a, b) => a.sortOrder - b.sortOrder).map((node, idx) => {
                  const nodeResources = resources.filter((r) => (r as any).nodeId === node.id)
                  const nodeKnow = node.knowledgePointIds?.length || 0
                  return (
                    <div key={node.id} className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-emerald-200 transition-all">
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-lg shadow-emerald-500/25">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="text-[15px] font-semibold text-slate-800 truncate">{node.name}</div>
                            {node.refType === "original" && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium border bg-purple-50 text-purple-600 border-purple-200 shrink-0">引用颗粒课</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            {node.duration && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{node.duration} 课时</span>}
                            {nodeResources.length > 0 && <span className="flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" />{nodeResources.length} 个资源</span>}
                            {nodeKnow > 0 && <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" />{nodeKnow} 个知识点</span>}
                          </div>
                          {node.teachingGoals && (
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{node.teachingGoals}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case "resources":
        return (
          <div>
            <div className="text-sm text-slate-500 mb-4">
              共 <strong className="text-emerald-600">{totalResources}</strong> 个资源
            </div>
            {totalResources === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">暂无关联资源</div>
                <div className="text-[13px] mt-1">该课程暂未配置学习资源</div>
              </div>
            ) : (
              <div className="space-y-5">
                {(() => {
                  const nodeMap = new Map<string, string>()
                  nodes.forEach((n) => nodeMap.set(n.id, n.name))
                  const byNode = new Map<string, NodeResource[]>()
                  resources.forEach((r) => {
                    const nid = (r as any).nodeId || "course"
                    const list = byNode.get(nid) || []
                    list.push(r)
                    byNode.set(nid, list)
                  })
                  return Array.from(byNode.entries()).map(([nid, resList]) => {
                    const nodeName = nid === "course" ? "课程全局资源" : (nodeMap.get(nid) || nid)
                    return (
                      <div key={nid}>
                        <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-emerald-500" />
                          {nodeName}
                          <span className="text-xs text-slate-400 font-normal">({resList.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {resList.map((r) => {
                            const typeColors: Record<string, string> = {
                              document: "bg-blue-50 text-blue-600 border-blue-100",
                              video: "bg-amber-50 text-amber-600 border-amber-100",
                              link: "bg-purple-50 text-purple-600 border-purple-100",
                              file: "bg-emerald-50 text-emerald-600 border-emerald-100",
                            }
                            return (
                              <div key={r.id} className="group bg-slate-50 rounded-xl p-3.5 border border-slate-100 hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 mb-1.5 truncate">{r.name}</div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeColors[r.type] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                        {resourceTypeLabels[r.type] || r.type}
                                      </span>
                                      {r.size && <span>{r.size < 1024 ? `${r.size}B` : r.size < 1048576 ? `${(r.size / 1024).toFixed(1)}KB` : `${(r.size / 1048576).toFixed(1)}MB`}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>
        )

      case "knowledge":
        return <KnowledgeTab knowledgeList={courseKnowledgeList} />

      case "evaluation":
        return (
          <div className="space-y-6">
            {/* 课程级测评任务 */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-semibold text-slate-800">课程测评任务</h3>
              </div>
              {assessmentsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : !assessments || (assessments.exams.length === 0 && assessments.homeworks.length === 0) ? (
                <div className="text-center py-10 text-slate-400 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <div className="text-[14px] font-medium text-slate-600">暂无课程级测评任务</div>
                  <div className="text-[12px] mt-1">发布系统课后将自动生成考试/作业安排</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {assessments.exams.map((exam) => (
                    <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{exam.name}</div>
                          <div className="text-[11px] text-slate-400">{exam.isTemp ? "动态组卷" : "固定试卷"} · {exam.duration ? `${exam.duration} 分钟` : "不限时"}</div>
                        </div>
                      </div>
                      <Link
                        href={isStudent ? `/evaluation/exams/${exam.id}/take` : `/evaluation/exam-usages/${exam.id}`}
                        className="inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        {isStudent ? "进入考试 →" : "查看安排 →"}
                      </Link>
                    </div>
                  ))}
                  {assessments.homeworks.map((hw) => (
                    <div key={hw.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{hw.title}</div>
                          {hw.requirement && <div className="text-[11px] text-slate-400 line-clamp-1">{hw.requirement}</div>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setActiveHomework(hw)
                          if (isStudent) {
                            setSubmitContent("")
                            setSubmitUrls("")
                            setSubmitOpen(true)
                          } else {
                            try {
                              const res = await courseHomeworkApi.listSubmissions(id, hw.id)
                              setSubmissions(res.items || [])
                              setGradeOpen(true)
                            } catch {
                              setSubmissions([])
                              setGradeOpen(true)
                            }
                          }
                        }}
                        className="inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        {isStudent ? "提交作业 →" : "批改作业 →"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 节点评价标准 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800">节点评价标准</h3>
                <span className="text-sm text-slate-500">共 <strong className="text-emerald-600">{totalEvalCount}</strong> 个节点</span>
              </div>
              {totalEvalCount === 0 ? (
                <div className="text-center py-10 text-slate-400 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <div className="text-[14px] font-medium text-slate-600">暂未配置节点评价标准</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {nodes.filter((n) => n.teachingGoals).map((node) => (
                    <div key={node.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-400 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          <Target className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{node.name}</div>
                          {node.duration && <span className="text-[11px] text-slate-400">预计 {node.duration} 课时</span>}
                        </div>
                      </div>
                      {node.teachingGoals && (
                        <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3">{node.teachingGoals}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      <div className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center gap-2 mb-5 text-sm text-slate-500">
            <button onClick={() => router.back()} className="hover:text-emerald-600 transition-colors flex items-center gap-1 cursor-pointer">
              <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">←</span> 返回上一页
            </button>
            <span className="text-slate-300">/</span>
            <Link href="/lesson/landing" className="hover:text-emerald-600 transition-colors">课程列表</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-medium truncate">{course.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            <div className="flex-1 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="flex flex-col sm:flex-row gap-6 p-6">
                  <div
                    className="w-full sm:w-[280px] h-[190px] rounded-2xl bg-cover bg-center flex items-center justify-center shrink-0 self-stretch shadow-[0_12px_40px_rgba(0,0,0,0.15)] relative overflow-hidden"
                    style={coverStyle}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    {!course.coverImage && (
                      <BookOpen className="w-16 h-16 text-white/90 relative z-10" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))" }} />
                    )}
                    <span className="absolute bottom-3 right-3 z-10 bg-black/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] border border-white/10">
                      v{course.version || "1.0"}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <h1 className="text-[26px] font-bold text-slate-900 truncate">{course.name}</h1>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 font-medium shrink-0 border border-emerald-200">
                          {courseTypeLabels[course.type] || course.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1.5">创建人：{course.creatorId.slice(0, 8)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 更新于 {formatDate(course.updatedAt)}</span>
                      <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {course.nodeCount} 节点</span>
                    </div>

                    {course.description && (
                      <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">{course.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                      {course.majorName && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">适用专业：</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">{course.majorName}</span>
                        </div>
                      )}
                      {course.difficulty && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">难度等级：</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] border font-medium"
                            style={{ backgroundColor: diff.color + "15", color: diff.color, borderColor: diff.color + "30" }}>
                            {diff.label}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-auto pt-5">
                      <Button className="rounded-xl px-7 h-11 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all">
                        <PlayCircle className="w-4 h-4 mr-1.5" /> 开始学习
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-[320px] shrink-0 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">课程统计</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">课程节点</span>
                    <span className="text-sm font-bold text-emerald-600">{nodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">教学资源</span>
                    <span className="text-sm font-bold text-emerald-600">{totalResources}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">知识点</span>
                    <span className="text-sm font-bold text-emerald-600">{courseKnowledgeList.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">线上课时</span>
                    <span className="text-sm font-bold text-emerald-600">{course.onlineHours || 0}h</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">线下课时</span>
                    <span className="text-sm font-bold text-emerald-600">{course.offlineHours || 0}h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-6 py-6 w-full">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex border-b border-slate-100 px-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`
                  py-4 px-5 text-[14px] whitespace-nowrap relative transition-all cursor-pointer flex items-center gap-1.5
                  ${activeTab === t.value ? "text-emerald-600 font-semibold" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/40"}
                `}
              >
                <t.icon className={`w-4 h-4 ${activeTab === t.value ? "text-emerald-500" : "text-slate-400"}`} />
                {t.label}
                {t.value === "nodes" && nodes.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{nodes.length}</span>
                )}
                {t.value === "resources" && totalResources > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{totalResources}</span>
                )}
                {t.value === "knowledge" && courseKnowledgeList.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${activeTab === t.value ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{courseKnowledgeList.length}</span>
                )}
                {activeTab === t.value && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-emerald-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-6 min-h-[500px]">
            {renderTabContent()}
          </div>
        </div>
      </main>

      {/* Student submit homework dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>提交作业：{activeHomework?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">作业要求</Label>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{activeHomework?.requirement || "无"}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">作答内容</Label>
              <Textarea value={submitContent} onChange={(e) => setSubmitContent(e.target.value)} placeholder="请输入作业内容" className="min-h-[120px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">附件链接（多个用逗号分隔）</Label>
              <Input value={submitUrls} onChange={(e) => setSubmitUrls(e.target.value)} placeholder="https://..." className="text-sm h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSubmitOpen(false)}>取消</Button>
            <Button
              size="sm"
              disabled={submitting}
              onClick={async () => {
                if (!activeHomework) return
                setSubmitting(true)
                try {
                  await courseHomeworkApi.submit(id, activeHomework.id, {
                    content: submitContent,
                    attachmentUrls: submitUrls.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                  setSubmitOpen(false)
                } catch {
                  alert("提交失败")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              <Send className="h-3.5 w-3.5 mr-1" />{submitting ? "提交中..." : "提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher grade homework dialog */}
      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批改作业：{activeHomework?.title}</DialogTitle>
          </DialogHeader>
          {gradeSubmission ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">学生作答</Label>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 min-h-[80px]">{gradeSubmission.content || "无内容"}</p>
              </div>
              {gradeSubmission.attachmentUrls && gradeSubmission.attachmentUrls.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">附件</Label>
                  <div className="flex flex-wrap gap-2">
                    {gradeSubmission.attachmentUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline">附件 {i + 1}</a>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">得分</Label>
                  <Input type="number" value={gradeScore} onChange={(e) => setGradeScore(e.target.value)} placeholder="0-100" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">评语</Label>
                  <Input value={gradeComment} onChange={(e) => setGradeComment(e.target.value)} placeholder="评语" className="h-9 text-sm" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {submissions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">暂无提交记录</p>
              ) : (
                submissions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setGradeSubmission(s)
                      setGradeScore(s.score !== undefined ? String(s.score) : "")
                      setGradeComment(s.comment || "")
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.studentName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "graded" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                        {s.status === "graded" ? `已批 ${s.score}分` : "待批改"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">{s.content || "无内容"}</p>
                  </button>
                ))
              )}
            </div>
          )}
          <DialogFooter>
            {gradeSubmission ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setGradeSubmission(null)}>返回列表</Button>
                <Button
                  size="sm"
                  disabled={grading || gradeScore === ""}
                  onClick={async () => {
                    if (!activeHomework || !gradeSubmission) return
                    setGrading(true)
                    try {
                      await courseHomeworkApi.grade(id, activeHomework.id, gradeSubmission.id, {
                        score: parseFloat(gradeScore),
                        comment: gradeComment,
                      })
                      setGradeSubmission(null)
                      const res = await courseHomeworkApi.listSubmissions(id, activeHomework.id)
                      setSubmissions(res.items || [])
                    } catch {
                      alert("批改失败")
                    } finally {
                      setGrading(false)
                    }
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{grading ? "保存中..." : "保存评分"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setGradeOpen(false)}>关闭</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlatformFooter />
    </div>
  )
}
