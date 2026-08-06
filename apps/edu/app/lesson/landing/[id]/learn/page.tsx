'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import {
  BookOpen,
  FileText,
  Clock,
  FolderOpen,
  BrainCircuit,
  BarChart3,
  ListChecks,
  ArrowLeft,
  Eye,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { SCENE_DIFFICULTY, RESOURCE_TYPE_SHORT_LABELS } from '@/lib/types'
import { evalRuleConfigToMethods } from '@/lib/types'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/error-handling'
import { useToast } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import { Footer } from '@/components/portal/footer'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'
import {
  EvalMethodCard,
  EvalMethodSubmitDialog,
  EvalMethodSubmitPayload,
  EvalMethodViewModel,
  EvalMethodResultModel,
  UploadedFile,
} from '@/components/shared/eval-method-card'

import { courseApi, courseNodeApi, nodeEvaluationResultApi, fileApi } from '@/lib/api'
import type { Course } from '@/lib/types'
import type {
  SystemCourseNode,
  KnowledgePoint as NodeKnowledgePoint,
  NodeResource,
} from '@/lib/types/lesson-source'
import type { NodeEvaluationResult } from '@zhiyu/api-client'

/* ---------- constants ---------- */

const resourceTypeIcons: Record<string, string> = {
  document: 'text-primary bg-primary/5',
  video: 'text-[#f59e0b] bg-primary/5',
  link: 'text-[#8b5cf6] bg-purple-50',
  file: 'text-[#10b981] bg-emerald-50',
  spreadsheet: 'text-[#16a34a] bg-green-50',
  presentation: 'text-[#f97316] bg-orange-50',
  image: 'text-[#ec4899] bg-pink-50',
  audio: 'text-[#06b6d4] bg-cyan-50',
  pdf: 'text-[#ef4444] bg-red-50',
}

/* ---------- page ---------- */

export default function LessonLearnPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const targetNodeId = searchParams.get('node')
  const { toast } = useToast()
  const { user } = useAuth()

  const [course, setCourse] = useState<Course | null>(null)
  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(targetNodeId || null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const [myResults, setMyResults] = useState<NodeEvaluationResult[]>([])

  useEffect(() => {
    ;(async () => {
      if (!id) return
      setLoading(true)
      try {
        const c = await courseApi.get(id)
        setCourse(c)
      } catch {
        setCourse(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  useEffect(() => {
    if (!id || !course) return
    courseNodeApi
      .list({ courseId: id, limit: 1000 })
      .then((res) => {
        const list = (res.items || []).sort((a, b) => (a.order || 0) - (b.order || 0))
        setNodes(list)
        setActiveNodeId((prev) => {
          if (targetNodeId && list.find((n) => n.id === targetNodeId)) {
            return targetNodeId
          }
          if (list.length > 0 && !prev) {
            return list[0].id
          }
          return prev
        })
      })
      .catch(() => setNodes([]))
  }, [id, course, targetNodeId])

  const activeNode = useMemo(() => nodes.find((n) => n.id === activeNodeId), [nodes, activeNodeId])
  const totalHours = useMemo(() => nodes.reduce((s, n) => s + (n.estimatedHours || 0), 0), [nodes])

  const evalMethods = useMemo(() => {
    const config = activeNode?.evalData?.evalRuleConfig
    if (!config || !Array.isArray(config.evaluationMethods)) return []
    try {
      return evalRuleConfigToMethods(config as any).filter((m) => m.isEnabled !== false)
    } catch (err) {
      reportError(err, '解析节点测评配置')
      return []
    }
  }, [activeNode])

  useEffect(() => {
    if (!activeNodeId) return
    nodeEvaluationResultApi
      .list({ nodeId: activeNodeId, evaluateeId: user?.id, limit: 50 })
      .then((res) => setMyResults(res.items || []))
      .catch((err) => {
        reportError(err, '加载我的测评结果')
        toast({ title: '测评结果加载失败', variant: 'destructive' })
      })
  }, [activeNodeId, user?.id, toast])

  const nodeKnowledgePoints = useMemo(() => {
    if (!activeNode) return []
    return (activeNode.knowledgePoints || []) as NodeKnowledgePoint[]
  }, [activeNode])

  const nodeResources = useMemo(() => {
    if (!activeNode) return []
    return (activeNode.resources || []) as NodeResource[]
  }, [activeNode])

  const nodeEvalMethods = useMemo(() => {
    return {
      methods: evalMethods.map((m) => m.methodKey),
      weights: Object.fromEntries(evalMethods.map((m) => [m.methodKey, m.weight])),
    }
  }, [evalMethods])

  const nodeAggregate = useMemo(() => {
    let totalScore = 0
    let totalWeight = 0
    let evaluatedCount = 0
    let pendingCount = 0
    for (const m of evalMethods) {
      const weight = m.weight || 0
      totalWeight += weight
      const r = myResults.find((x) => x.methodKey === m.methodKey)
      if (r?.status === 'evaluated' && r.maxScore > 0) {
        totalScore += ((r.totalScore || 0) / r.maxScore) * weight
        evaluatedCount++
      } else if (r) {
        pendingCount++
      }
    }
    return {
      score: totalWeight > 0 ? Math.round(totalScore * 100) / 100 : 0,
      maxScore: totalWeight,
      evaluatedCount,
      pendingCount,
      totalMethods: evalMethods.length,
    }
  }, [evalMethods, myResults])

  const selectNode = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId)
  }, [])

  /* ---------- eval method submit dialog state ---------- */
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [activeMethodKey, setActiveMethodKey] = useState<string | null>(null)
  const [submittedMethodKeys, setSubmittedMethodKeys] = useState<Set<string>>(new Set())
  const [uploadingFile, setUploadingFile] = useState(false)

  const activeMethod = useMemo(
    () => evalMethods.find((m) => m.methodKey === activeMethodKey),
    [evalMethods, activeMethodKey],
  )

  const toEvalMethodView = (m: any): EvalMethodViewModel => ({
    methodKey: m.methodKey,
    weight: m.weight,
    resourceConfig: m.resourceConfig,
    reviewSteps: m.reviewSteps,
    evalPoints: m.evalPoints,
  })

  const toEvalResultModel = (r?: NodeEvaluationResult): EvalMethodResultModel | undefined => {
    if (!r) return undefined
    return {
      status: r.status,
      totalScore: r.totalScore,
      maxScore: r.maxScore,
    }
  }

  const getExamHref = (m: any, nodeId: string, courseId: string) => {
    const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(m.methodKey)
    if (!isExamMethod) return undefined
    const examId = m.methodKey === 'paper' ? m.resourceConfig?.paperId : m.resourceConfig?.examId
    const usageId = m.resourceConfig?.usageId
    if (!examId) return undefined
    return `/evaluation/landing/exams/${examId}?node=${nodeId}&method=${m.methodKey}&usage=${usageId || ''}&course=${courseId}`
  }

  const handleSubmitMethod = async (payload: EvalMethodSubmitPayload) => {
    if (!user?.id || !activeNodeId) return
    await nodeEvaluationResultApi.submit({
      nodeId: activeNodeId,
      methodKey: payload.methodKey,
      evaluateeId: user.id,
      maxScore: payload.maxScore,
      subjectiveContent: payload.subjectiveContent,
    })
    setSubmittedMethodKeys((prev) => new Set([...Array.from(prev), payload.methodKey]))
  }

  const handleFileUpload = async (file: File): Promise<UploadedFile | null> => {
    setUploadingFile(true)
    try {
      const res = await fileApi.upload(file)
      return { name: file.name, url: res.url, size: res.size || file.size }
    } catch {
      return null
    } finally {
      setUploadingFile(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col relative" style={{ background: '#F1FAFF' }}>
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-120px] right-[5%] w-[480px] h-[480px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-80px] left-[5%] w-[360px] h-[360px] rounded-full bg-primary/10 blur-[100px]" />
        </div>
        <header className="relative z-10 bg-white border-b border-gray-200/60 shrink-0 h-16 flex items-center px-6">
          <Skeleton className="h-5 w-48" />
        </header>
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row p-4 gap-4">
          <div className="w-full lg:w-[300px] shrink-0 rounded-2xl border border-[#e7e5e4] bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] h-48 lg:h-auto">
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
          <div className="flex-1 min-w-0 p-0 lg:p-4">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col relative" style={{ background: '#F1FAFF' }}>
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-120px] right-[5%] w-[480px] h-[480px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-80px] left-[5%] w-[360px] h-[360px] rounded-full bg-primary/10 blur-[100px]" />
        </div>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/15 opacity-40 blur-xl" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/10 opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-white/80" />
            </div>
          </div>
          <div className="text-lg font-semibold text-gray-600">课程不存在</div>
          <Link
            href="/lesson/landing"
            className="text-primary hover:text-primary mt-2 text-sm font-medium transition-colors"
          >
            返回课程列表
          </Link>
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: '#F1FAFF' }}>
      {/* ---------- ambient background ---------- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-120px] right-[5%] w-[480px] h-[480px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-80px] left-[5%] w-[360px] h-[360px] rounded-full bg-primary/10 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* ---------- header ---------- */}
      <header className="bg-white border-b border-gray-200/60 shrink-0 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <Link
                replace
                href={`/lesson/landing/${id}`}
                className="group flex items-center gap-2.5 text-sm text-gray-500 hover:text-primary transition-all duration-200"
              >
                <span className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200/60 flex items-center justify-center group-hover:bg-primary/5 group-hover:border-primary/30 group-hover:text-primary transition-all duration-200">
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
                </span>
                <span className="font-semibold truncate max-w-[200px] sm:max-w-[360px] lg:max-w-[520px] text-gray-800 group-hover:text-primary transition-colors">
                  {course.name}
                </span>
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeNode && (
                <>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />{' '}
                    {SCENE_DIFFICULTY[activeNode.difficulty ?? 3]?.label ||
                      `Lv.${activeNode.difficulty ?? 3}`}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                    <Clock className="w-3.5 h-3.5 text-primary" /> {activeNode.estimatedHours || 0}{' '}
                    课时
                  </span>
                </>
              )}
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200/80">
                <ListChecks className="w-3.5 h-3.5 text-primary" /> {nodes.length} 个节点
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200/80">
                <Clock className="w-3.5 h-3.5 text-primary" /> {totalHours} 课时
              </span>
            </div>
          </div>
          {activeNode?.background && (
            <div className="text-sm text-gray-600 leading-relaxed line-clamp-2 whitespace-pre-line">
              {activeNode.background}
            </div>
          )}
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row max-w-[1400px] mx-auto w-full">
        {/* ---------- left sidebar: node list ---------- */}
        <aside
          className={cn(
              'flex flex-col rounded-2xl border border-[#e7e5e4] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 overflow-hidden w-[calc(100%-2rem)] mt-4 mx-4 lg:flex-shrink-0 lg:sticky lg:self-start lg:h-[calc(100vh-8rem)] lg:mx-4',
              sidebarCollapsed ? 'lg:w-[68px]' : 'h-[50vh] lg:w-[300px]',
          )}
          style={{ top: '7rem' }}
        >
          {/* sidebar header */}
          <div className="relative border-b border-gray-100 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary to-primary/70 shadow-sm" />
            <div
              className={cn(
                'flex items-center',
                sidebarCollapsed ? 'px-2 py-3 justify-center' : 'px-5 py-3',
              )}
            >
              {!sidebarCollapsed && (
                <div className="flex-1 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Layers className="w-3 h-3" />
                    {nodes.length} 个节点
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {totalHours} 课时
                  </span>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed((v) => !v)}
                className={cn(
                  'flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all duration-200',
                  sidebarCollapsed
                    ? 'w-9 h-9 text-gray-500 hover:text-primary'
                    : 'w-8 h-8 ml-auto',
                )}
                title={sidebarCollapsed ? '展开节点列表' : '折叠节点列表'}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* node list */}
          <ScrollArea className="flex-1">
            <div
              className={cn(
                'py-1',
                sidebarCollapsed && 'flex flex-row flex-wrap gap-1.5 px-3 py-2 lg:block lg:gap-0 lg:px-0 lg:py-1',
              )}
            >
              {nodes.map((node, idx) => {
                const isActive = activeNodeId === node.id
                const diff = SCENE_DIFFICULTY[node.difficulty ?? 3] || SCENE_DIFFICULTY[3]

                if (sidebarCollapsed) {
                  return (
                    <div key={node.id} className="flex justify-center py-1.5">
                      <button
                        onClick={() => selectNode(node.id)}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold transition-all duration-200',
                          isActive
                            ? 'bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg shadow-primary/30'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600 hover:-translate-y-0.5',
                        )}
                        title={`${idx + 1}. ${node.name} (${diff.label}, ${node.estimatedHours || 0}h)`}
                      >
                        {idx + 1}
                      </button>
                    </div>
                  )
                }

                return (
                  <button
                    key={node.id}
                    onClick={() => selectNode(node.id)}
                    className={cn(
                      'relative flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 group',
                      isActive
                        ? 'bg-gradient-to-r from-primary/5 via-primary/5 to-transparent'
                        : 'hover:bg-gray-50/80 hover:pl-5',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-gradient-to-b from-primary to-primary/70 rounded-r-full shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                    )}
                    <div
                      className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-200',
                        isActive
                          ? 'bg-gradient-to-br from-primary to-primary/70 text-white shadow-md shadow-primary/25'
                          : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-600 group-hover:-translate-y-0.5',
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'text-[13px] font-semibold truncate transition-colors duration-200',
                          isActive ? 'text-primary' : 'text-gray-700 group-hover:text-gray-900',
                        )}
                      >
                        {node.name}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {node.estimatedHours || 0}h
                        </span>
                        <span
                          className="text-[10px] flex items-center gap-1"
                          style={{ color: diff.color }}
                        >
                          <BarChart3 className="h-2.5 w-2.5" />
                          {diff.label}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* ---------- right main area ---------- */}
        <main className="flex flex-1 flex-col overflow-y-auto relative min-w-0">
          {!activeNode ? (
            <div className="flex flex-col items-center justify-center flex-1 p-4 sm:p-8">
              <div className="relative w-28 h-28 mb-6">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/15 opacity-40 blur-xl animate-pulse" />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/10 opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-white/80" />
                </div>
              </div>
              <p className="text-base font-semibold text-gray-600">选择一个节点开始学习</p>
              <p className="text-sm text-gray-400 mt-1.5">从左侧节点列表中点击节点</p>
            </div>
          ) : (
            <>
              {/* collapsed layout: left 2 cards + right sticky tab card */}
              <div className="flex flex-1 gap-4 p-4">
                {/* left column: 2 cards */}
                <div className="flex-1 space-y-4">
                  {/* 节点说明书 */}
                  <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] transition-all duration-300 py-0 gap-0 flex flex-col bg-white">
                    <CardHeader className="border-b border-gray-100 px-6 py-5 shrink-0 bg-white">
                      <CardTitle className="text-base flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="text-gray-800 font-semibold text-lg">节点说明书</span>
                        {activeNode.descriptionPdf && (
                          <button
                            onClick={() =>
                              addPreviewResource({
                                id: `pdf-${Date.now()}`,
                                url: activeNode.descriptionPdf,
                                name: '节点说明书 PDF',
                                type: 'pdf',
                              } as any)
                            }
                            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 shadow-sm transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            查看 PDF
                          </button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-8 flex-1 bg-white">
                      <ScrollArea className="h-full">
                        {activeNode.detailedDescription ? (
                          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-loose">
                            {activeNode.detailedDescription}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">暂无节点说明书</p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* 节点测评 */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-800">节点测评</h3>
                      {nodeAggregate.totalMethods > 0 && (
                        <div className="ml-auto flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            已评分 {nodeAggregate.evaluatedCount}/{nodeAggregate.totalMethods}
                          </span>
                          {nodeAggregate.evaluatedCount > 0 && (
                            <span className="text-sm font-semibold text-primary">
                              综合 {nodeAggregate.score}/{nodeAggregate.maxScore}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {nodeEvalMethods.methods.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {nodeEvalMethods.methods.map((mk) => {
                          const method = evalMethods.find((m) => m.methodKey === mk)
                          if (!method) return null
                          const r = myResults.find((x) => x.methodKey === mk)
                          const alreadySubmitted = submittedMethodKeys.has(mk)
                          const overriddenResult: EvalMethodResultModel | undefined =
                            r && !alreadySubmitted
                              ? toEvalResultModel(r)
                              : alreadySubmitted
                                ? { status: 'pending' }
                                : undefined
                          return (
                            <EvalMethodCard
                              key={mk}
                              method={toEvalMethodView(method)}
                              result={overriddenResult}
                              examHref={getExamHref(method, activeNodeId!, id)}
                              onAction={() => {
                                setActiveMethodKey(mk)
                                setSubmitDialogOpen(true)
                              }}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <Card className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-4 sm:p-8 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                          <ClipboardList className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            该节点暂未设置评价方式
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            教师配置后，测评入口将显示在此处
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* right panel: sticky tabs - outside main, same level as sidebar */}
        {sidebarCollapsed && activeNode && (
          <div
            className="flex w-[calc(100%-2rem)] lg:w-[360px] flex-shrink-0 lg:sticky lg:self-start mt-4 mx-4 lg:mx-4"
            style={{ top: '7rem', maxHeight: 'calc(100vh - 8rem)' }}
          >
            <Card className="rounded-2xl border border-[#e7e5e4] shadow-[0_8px_32px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col w-full">
              <Tabs defaultValue="collapsed-knowledge" className="w-full flex flex-col h-full">
                <CardHeader className="border-b border-gray-100 p-2 shrink-0">
                  <TabsList className="bg-transparent p-0 h-auto gap-1 w-full">
                    <TabsTrigger
                      value="collapsed-knowledge"
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/5 data-[state=active]:to-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                    >
                      <BrainCircuit className="mr-1 h-3.5 w-3.5" />
                      知识点
                    </TabsTrigger>
                    <TabsTrigger
                      value="collapsed-resource"
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/5 data-[state=active]:to-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                    >
                      <FolderOpen className="mr-1 h-3.5 w-3.5" />
                      资源
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-3">
                  <TabsContent value="collapsed-knowledge" className="mt-0 space-y-2">
                    {nodeKnowledgePoints.length > 0 ? (
                      nodeKnowledgePoints.map((kp, i) => (
                        <div
                          key={kp.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">{kp.name}</p>
                            {kp.description && (
                              <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                                {kp.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">暂无知识点</p>
                    )}
                  </TabsContent>
                  <TabsContent value="collapsed-resource" className="mt-0 space-y-2">
                    {nodeResources.length > 0 ? (
                      nodeResources.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                          onClick={() => addPreviewResource(r as any)}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${resourceTypeIcons[r.type] || 'text-gray-400 bg-gray-50'}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{r.name}</p>
                            <p className="text-[11px] text-gray-400">
                              {RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type}
                              {r.size ? ` · ${r.size}` : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">暂无资源</p>
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>

      {activeMethod && (
        <EvalMethodSubmitDialog
          open={submitDialogOpen}
          onOpenChange={setSubmitDialogOpen}
          method={toEvalMethodView(activeMethod)}
          uploading={uploadingFile}
          onFileUpload={handleFileUpload}
          onSubmit={handleSubmitMethod}
          onSubmitted={() => {
            if (activeMethodKey) {
              setSubmittedMethodKeys((prev) => new Set([...Array.from(prev), activeMethodKey]))
            }
          }}
        />
      )}

      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}

      <Footer className="mt-auto" />
    </div>
  )
}
