'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'

import {
  BookOpen,
  FileText,
  Clock,
  FolderOpen,
  Target,
  BrainCircuit,
  BarChart3,
  ListChecks,
  ArrowLeft,
  Eye,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  ChevronRight,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { SCENE_DIFFICULTY, RESOURCE_TYPE_SHORT_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'
import { fileApi } from '@/lib/api'
import { Footer } from '@/components/portal/footer'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'
import {
  EvalMethodCard,
  EvalMethodSubmitDialog,
  EvalMethodResultModel,
  EvalMethodSubmitPayload,
  EvalMethodViewModel,
  UploadedFile,
} from '@/components/shared/eval-method-card'
import type { AbilityPoint, Course, KnowledgePoint } from '@/lib/types'

/* ---------- constants ---------- */

/** 课程学习页（lesson）资源类型图标配色 */
export const LESSON_RESOURCE_TYPE_ICONS: Record<string, string> = {
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

/** 场景学习页（scene）资源类型图标配色 */
export const SCENE_RESOURCE_TYPE_ICONS: Record<string, string> = {
  document: 'text-primary bg-primary/5',
  video: 'text-[#f59e0b] bg-amber-50',
  link: 'text-[#8b5cf6] bg-purple-50',
  file: 'text-[#10b981] bg-emerald-50',
  spreadsheet: 'text-[#16a34a] bg-green-50',
  presentation: 'text-[#f97316] bg-orange-50',
  image: 'text-[#ec4899] bg-pink-50',
  audio: 'text-[#06b6d4] bg-cyan-50',
  pdf: 'text-[#ef4444] bg-red-50',
}

/* ---------- types ---------- */

/** 学习单元（课程节点 / 场景任务）的归一化视图模型 */
export interface LearnUnit {
  id: string
  name: string
  difficulty?: number
  estimatedHours?: number
  background?: string
  descriptionPdf?: string
  /** 说明书正文（调用方需预先做好字段回退，如 detailedDescription || description） */
  description?: string
  knowledgePoints: KnowledgePoint[]
  /** 仅场景学习页提供；提供后右侧面板会多出“能力点”页签 */
  abilityPoints?: AbilityPoint[]
  resources: Array<{ id: string; name: string; type: string; size?: string | number }>
  /** 仅场景任务使用：任务类型徽标（assessment=考核，其余=训练） */
  taskType?: string
}

/** 测评结果的最小结构（NodeEvaluationResult / SceneEvaluationResult 均兼容） */
export interface LearnEvalResult {
  methodKey: string
  status: string
  totalScore?: number
  maxScore?: number
}

/** 两个学习页文案差异点（i18n key 不同处一律用函数注入，保证 key 不变） */
export interface LearnPageLabels {
  notFoundText: string
  backText: string
  sidebarExpandTitle: string
  sidebarCollapseTitle: string
  emptyTitle: string
  emptyHint: string
  descriptionTitle: string
  descriptionPdfName: string
  noDescriptionText: string
  evalTitle: string
  noEvalMethodsText: string
  formatUnitCount: (n: number) => string
  formatUnitTooltip: (idx: number, name: string, diffLabel: string, hours: number) => string
  formatEvaluatedCount: (evaluated: number, total: number) => string
  formatAggregateScore: (score: number, max: number) => string
  formatKnowledgeCode: (code: string) => string
}

/** 交给调用方渲染附加弹窗时可复用的文件上传能力 */
export interface LearnPageFileHelpers {
  uploading: boolean
  onFileUpload: (file: File) => Promise<UploadedFile | null>
}

export interface LearnPageProps {
  loading: boolean
  /** 实体加载失败（不存在） */
  notFound: boolean
  entityName?: string
  /** 头部返回链接（详情页） */
  detailHref: string
  /** 空态返回链接（列表页） */
  backHref: string
  units: LearnUnit[]
  activeUnitId: string | null
  onSelectUnit: (id: string) => void
  labels: LearnPageLabels
  evalMethods: EvalMethodViewModel[]
  evalResults: LearnEvalResult[]
  getExamHref: (method: EvalMethodViewModel) => string | undefined
  onSubmit: (payload: EvalMethodSubmitPayload) => Promise<void>
  granularCourseMap: Map<string, Course>
  resourceTypeIcons: Record<string, string>
  /** 侧边栏当前单元的激活指示条发光样式（两页配色不同） */
  activeIndicatorGlowClass: string
  /** 头部当前单元附加徽标（场景页的任务类型 chip），渲染在难度 chip 之前 */
  headerUnitBadges?: ReactNode
  /** 侧边栏单元条目附加徽标（场景页的任务类型徽标） */
  renderUnitBadges?: (unit: LearnUnit) => ReactNode
  /** 隐藏右侧知识点/资源面板（混合课） */
  hideRightPanel?: boolean
  /** 替换主区域说明书+测评区块的内容（混合课模块视图） */
  mainOverride?: ReactNode
  /** 附加弹窗（混合课测评提交弹窗） */
  renderExtraDialogs?: (helpers: LearnPageFileHelpers) => ReactNode
  /** 默认展开左侧列表（混合课） */
  expandSidebar?: boolean
  /** 资源预览弹层 backdrop 配置（场景页为 false；不传则保持组件默认） */
  previewModalBackdrop?: boolean
}

/* ---------- component ---------- */

export function LearnPage({
  loading,
  notFound,
  entityName,
  detailHref,
  backHref,
  units,
  activeUnitId,
  onSelectUnit,
  labels,
  evalMethods,
  evalResults,
  getExamHref,
  onSubmit,
  granularCourseMap,
  resourceTypeIcons,
  activeIndicatorGlowClass,
  headerUnitBadges,
  renderUnitBadges,
  hideRightPanel,
  mainOverride,
  renderExtraDialogs,
  expandSidebar,
  previewModalBackdrop,
}: LearnPageProps) {
  const t = useT()

  // 用户未手动折叠/展开时取默认值：混合课（expandSidebar）默认展开左侧列表，其余默认折叠
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null)
  const sidebarCollapsed = collapsedOverride ?? !expandSidebar
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const [activeKnowledgePoint, setActiveKnowledgePoint] = useState<KnowledgePoint | null>(null)

  /* ---------- eval method submit dialog state ---------- */
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [activeMethodKey, setActiveMethodKey] = useState<string | null>(null)
  const [submittedMethodKeys, setSubmittedMethodKeys] = useState<Set<string>>(new Set())
  const [uploadingFile, setUploadingFile] = useState(false)

  const activeUnit = useMemo(() => units.find((u) => u.id === activeUnitId), [units, activeUnitId])
  const totalHours = useMemo(() => units.reduce((s, u) => s + (u.estimatedHours || 0), 0), [units])

  const aggregate = useMemo(() => {
    let totalScore = 0
    let totalWeight = 0
    let evaluatedCount = 0
    let pendingCount = 0
    for (const m of evalMethods) {
      const weight = m.weight || 0
      totalWeight += weight
      const r = evalResults.find((x) => x.methodKey === m.methodKey)
      if (r?.status === 'evaluated' && (r.maxScore ?? 0) > 0) {
        totalScore += ((r.totalScore || 0) / (r.maxScore ?? 1)) * weight
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
  }, [evalMethods, evalResults])

  const activeMethod = useMemo(
    () => evalMethods.find((m) => m.methodKey === activeMethodKey),
    [evalMethods, activeMethodKey],
  )

  const activeKnowledgePointCourses = useMemo(() => {
    if (!activeKnowledgePoint) return []
    return (activeKnowledgePoint.granularLessonIds || [])
      .map((cid) => granularCourseMap.get(cid))
      .filter(Boolean) as Course[]
  }, [activeKnowledgePoint, granularCourseMap])

  const handleSubmitMethod = async (payload: EvalMethodSubmitPayload) => {
    await onSubmit(payload)
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

  const fileHelpers: LearnPageFileHelpers = { uploading: uploadingFile, onFileUpload: handleFileUpload }

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

  if (notFound) {
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
          <div className="text-lg font-semibold text-gray-600">{labels.notFoundText}</div>
          <Link
            href={backHref}
            className="text-primary hover:text-primary mt-2 text-sm font-medium transition-colors"
          >
            {labels.backText}
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
                href={detailHref}
                className="group flex items-center gap-2.5 text-sm text-gray-500 hover:text-primary transition-all duration-200"
              >
                <span className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200/60 flex items-center justify-center group-hover:bg-primary/5 group-hover:border-primary/30 group-hover:text-primary transition-all duration-200">
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
                </span>
                <span className="font-semibold truncate max-w-[200px] sm:max-w-[360px] lg:max-w-[520px] text-gray-800 group-hover:text-primary transition-colors">
                  {entityName}
                </span>
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeUnit && (
                <>
                  {headerUnitBadges}
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />{' '}
                    {SCENE_DIFFICULTY[activeUnit.difficulty ?? 3]?.label ||
                      `Lv.${activeUnit.difficulty ?? 3}`}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                    <Clock className="w-3.5 h-3.5 text-primary" />{' '}
                    {t('{n} 课时', { n: activeUnit.estimatedHours || 0 })}
                  </span>
                </>
              )}
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200/80">
                <ListChecks className="w-3.5 h-3.5 text-primary" /> {labels.formatUnitCount(units.length)}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200/80">
                <Clock className="w-3.5 h-3.5 text-primary" /> {t('{n} 课时', { n: totalHours })}
              </span>
            </div>
          </div>
          {activeUnit?.background && (
            <div className="text-sm text-gray-600 leading-relaxed line-clamp-2 whitespace-pre-line">
              {activeUnit.background}
            </div>
          )}
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row max-w-[1400px] mx-auto w-full">
        {/* ---------- left sidebar: unit list ---------- */}
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
                    {labels.formatUnitCount(units.length)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {t('{n} 课时', { n: totalHours })}
                  </span>
                </div>
              )}
              <button
                onClick={() => setCollapsedOverride(!sidebarCollapsed)}
                className={cn(
                  'flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all duration-200',
                  sidebarCollapsed
                    ? 'w-9 h-9 text-gray-500 hover:text-primary'
                    : 'w-8 h-8 ml-auto',
                )}
                title={sidebarCollapsed ? labels.sidebarExpandTitle : labels.sidebarCollapseTitle}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* unit list */}
          <ScrollArea className="flex-1">
            <div
              className={cn(
                'py-1',
                sidebarCollapsed && 'flex flex-row flex-wrap gap-1.5 px-3 py-2 lg:block lg:gap-0 lg:px-0 lg:py-1',
              )}
            >
              {units.map((unit, idx) => {
                const isActive = activeUnitId === unit.id
                const diff = SCENE_DIFFICULTY[unit.difficulty ?? 3] || SCENE_DIFFICULTY[3]

                if (sidebarCollapsed) {
                  return (
                    <div key={unit.id} className="flex justify-center py-1.5">
                      <button
                        onClick={() => onSelectUnit(unit.id)}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold transition-all duration-200',
                          isActive
                            ? 'bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg shadow-primary/30'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600 hover:-translate-y-0.5',
                        )}
                        title={labels.formatUnitTooltip(idx, unit.name, diff.label, unit.estimatedHours || 0)}
                      >
                        {idx + 1}
                      </button>
                    </div>
                  )
                }

                return (
                  <button
                    key={unit.id}
                    onClick={() => onSelectUnit(unit.id)}
                    className={cn(
                      'relative flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 group',
                      isActive
                        ? 'bg-gradient-to-r from-primary/5 via-primary/5 to-transparent'
                        : 'hover:bg-gray-50/80 hover:pl-5',
                    )}
                  >
                    {isActive && (
                      <span
                        className={cn(
                          'absolute left-0 top-2 bottom-2 w-[3px] bg-gradient-to-b from-primary to-primary/70 rounded-r-full',
                          activeIndicatorGlowClass,
                        )}
                      />
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
                        {unit.name}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {unit.estimatedHours || 0}h
                        </span>
                        <span
                          className="text-[10px] flex items-center gap-1"
                          style={{ color: diff.color }}
                        >
                          <BarChart3 className="h-2.5 w-2.5" />
                          {diff.label}
                        </span>
                        {renderUnitBadges?.(unit)}
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
          {!activeUnit ? (
            <div className="flex flex-col items-center justify-center flex-1 p-4 sm:p-8">
              <div className="relative w-28 h-28 mb-6">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/15 opacity-40 blur-xl animate-pulse" />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/10 opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-white/80" />
                </div>
              </div>
              <p className="text-base font-semibold text-gray-600">{labels.emptyTitle}</p>
              <p className="text-sm text-gray-400 mt-1.5">{labels.emptyHint}</p>
            </div>
          ) : (
            <>
              {/* collapsed layout: left 2 cards + right sticky tab card */}
              <div className="flex flex-1 gap-4 p-4">
                <div className="flex-1 space-y-4">
                  {mainOverride ?? (
                    <>
                      {/* 说明书 */}
                      <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] transition-all duration-300 py-0 gap-0 flex flex-col bg-white">
                        <CardHeader className="border-b border-gray-100 px-6 py-5 shrink-0 bg-white">
                          <CardTitle className="text-base flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
                              <FileText className="h-4 w-4" />
                            </div>
                            <span className="text-gray-800 font-semibold text-lg">{labels.descriptionTitle}</span>
                            {activeUnit.descriptionPdf && (
                              <button
                                onClick={() =>
                                  addPreviewResource({
                                    id: `pdf-${Date.now()}`,
                                    url: activeUnit.descriptionPdf,
                                    name: labels.descriptionPdfName,
                                    type: 'pdf',
                                  } as any)
                                }
                                className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 shadow-sm transition-all"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {t('查看 PDF')}
                              </button>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-8 flex-1 bg-white">
                          <ScrollArea className="h-full">
                            {activeUnit.description ? (
                              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-loose">
                                {activeUnit.description}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">{labels.noDescriptionText}</p>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>

                      {/* 单元测评 */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                          <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <h3 className="text-base font-semibold text-gray-800">{labels.evalTitle}</h3>
                          {aggregate.totalMethods > 0 && (
                            <div className="ml-auto flex items-center gap-3">
                              <span className="text-xs text-gray-500">
                                {labels.formatEvaluatedCount(aggregate.evaluatedCount, aggregate.totalMethods)}
                              </span>
                              {aggregate.evaluatedCount > 0 && (
                                <span className="text-sm font-semibold text-primary">
                                  {labels.formatAggregateScore(aggregate.score, aggregate.maxScore)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {evalMethods.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {evalMethods.map((method) => {
                              const r = evalResults.find((x) => x.methodKey === method.methodKey)
                              const alreadySubmitted = submittedMethodKeys.has(method.methodKey)
                              const overriddenResult: EvalMethodResultModel | undefined =
                                r && !alreadySubmitted
                                  ? { status: r.status, totalScore: r.totalScore, maxScore: r.maxScore }
                                  : alreadySubmitted
                                    ? { status: 'pending' }
                                    : undefined
                              return (
                                <EvalMethodCard
                                  key={method.methodKey}
                                  method={method}
                                  result={overriddenResult}
                                  examHref={getExamHref(method)}
                                  onAction={() => {
                                    setActiveMethodKey(method.methodKey)
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
                                {labels.noEvalMethodsText}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {t('教师配置后，测评入口将显示在此处')}
                              </p>
                            </div>
                          </Card>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </main>

        {/* right panel: sticky tabs - outside main, same level as sidebar */}
        {!hideRightPanel && sidebarCollapsed && activeUnit && (
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
                      {t('知识点')}
                    </TabsTrigger>
                    {activeUnit.abilityPoints !== undefined && (
                      <TabsTrigger
                        value="collapsed-ability"
                        className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/5 data-[state=active]:to-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                      >
                        <Target className="mr-1 h-3.5 w-3.5" />
                        {t('能力点')}
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="collapsed-resource"
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/5 data-[state=active]:to-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                    >
                      <FolderOpen className="mr-1 h-3.5 w-3.5" />
                      {t('资源')}
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-3">
                  <TabsContent value="collapsed-knowledge" className="mt-0 space-y-2">
                    {activeUnit.knowledgePoints.length > 0 ? (
                      activeUnit.knowledgePoints.map((kp, i) => (
                        <div
                          key={kp.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                          onClick={() => setActiveKnowledgePoint(kp)}
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
                      <p className="text-xs text-gray-400 text-center py-8">{t('暂无知识点')}</p>
                    )}
                  </TabsContent>
                  {activeUnit.abilityPoints !== undefined && (
                    <TabsContent value="collapsed-ability" className="mt-0 space-y-2">
                      {activeUnit.abilityPoints.length > 0 ? (
                        activeUnit.abilityPoints.map((ap, i) => {
                          const cat = {
                            label: ap.attributes?.[0] || t('能力点'),
                            color: 'var(--primary)',
                          }
                          return (
                            <div
                              key={ap.id}
                              className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                            >
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700">{ap.name}</p>
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5"
                                  style={{ backgroundColor: cat.color + '15', color: cat.color }}
                                >
                                  {cat.label}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-8">{t('暂无能力点')}</p>
                      )}
                    </TabsContent>
                  )}
                  <TabsContent value="collapsed-resource" className="mt-0 space-y-2">
                    {activeUnit.resources.length > 0 ? (
                      activeUnit.resources.map((r) => (
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
                      <p className="text-xs text-gray-400 text-center py-8">{t('暂无资源')}</p>
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>

      {activeKnowledgePoint && (
        <Dialog open onOpenChange={(open) => !open && setActiveKnowledgePoint(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                {activeKnowledgePoint.name}
              </DialogTitle>
              {activeKnowledgePoint.code && (
                <DialogDescription>{labels.formatKnowledgeCode(activeKnowledgePoint.code)}</DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">{t('描述')}</p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {activeKnowledgePoint.description || t('暂无描述')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">
                  {t('关联颗粒课（{n}）', { n: activeKnowledgePointCourses.length })}
                </p>
                {activeKnowledgePointCourses.length > 0 ? (
                  <div className="space-y-2">
                    {activeKnowledgePointCourses.map((c) => (
                      <Link
                        key={c.id}
                        href={`/lesson/landing/${c.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shrink-0">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate group-hover:text-primary transition-colors">
                            {c.name}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {c.code ? `${c.code} · ` : ''}
                            {t('颗粒课')}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl">
                    {t('暂无关联颗粒课')}
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeMethod && (
        <EvalMethodSubmitDialog
          open={submitDialogOpen}
          onOpenChange={setSubmitDialogOpen}
          method={activeMethod}
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

      {renderExtraDialogs?.(fileHelpers)}

      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          backdrop={previewModalBackdrop}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}

      <Footer className="mt-auto" />
    </div>
  )
}
