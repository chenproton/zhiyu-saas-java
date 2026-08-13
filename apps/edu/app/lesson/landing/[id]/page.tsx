'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ListChecks,
  FolderOpen,
  GitBranch,
  Target,
  Clock,
  Layers,
  BookOpen,
  PlayCircle,
  Eye,
  ChevronRight,
  ChevronDown,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { courseApi, courseNodeApi, courseResourceApi, knowledgeApi } from '@/lib/api'
import { fetchAllPages } from '@zhiyu/api-client'
import type { Course, NodeResource, KnowledgePoint, TaskResource } from '@/lib/types'
import {
  SCENE_DIFFICULTY,
  RESOURCE_TYPE_SHORT_LABELS,
  EVAL_METHOD_LABELS,
  EVAL_METHOD_COLORS,
} from '@/lib/types'
import type { SystemCourseNode } from '@/lib/types/lesson-source'
import { Footer } from '@/components/portal/footer'
import { MobileAccessDialog } from '@/components/portal/mobile-access-dialog'
import { formatDate, formatSize } from '@/lib/format-utils'
import { coverGradientFor } from '@/lib/cover-gradients'
import { LessonKnowledgeGraph } from '@/components/lesson/student/knowledge-graph'
import { FavoriteButton } from '@/components/shared/favorite-button'
import { MobileTabDropdown } from '@/components/shared/mobile-tab-dropdown'
import { useT } from '@/lib/i18n/locale-provider'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'

const SYSTEM_TABS = [
  { value: 'nodes', label: '课程目录', icon: ListChecks },
  { value: 'resources', label: '资源中心', icon: FolderOpen },
  { value: 'evaluation', label: '评价标准', icon: Target },
  { value: 'knowledge', label: '知识图谱', icon: GitBranch },
]

const GRANULAR_TABS = [
  { value: 'resources', label: '资源中心', icon: FolderOpen },
  { value: 'knowledge', label: '知识图谱', icon: GitBranch },
]

const courseTypeLabels: Record<string, string> = {
  system: '体系课',
  granular: '颗粒课',
  hybrid: '混合课',
}

interface TreeItem {
  node: SystemCourseNode
  level: number
  children: TreeItem[]
}

function buildTree(nodes: SystemCourseNode[]): TreeItem[] {
  const map = new Map<string, TreeItem>()
  const roots: TreeItem[] = []

  const sorted = [...nodes].sort((a, b) => a.order - b.order)

  sorted.forEach((node) => {
    map.set(node.id, { node, level: 0, children: [] })
  })

  sorted.forEach((node) => {
    const item = map.get(node.id)!
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!
      item.level = parent.level + 1
      parent.children.push(item)
    } else {
      roots.push(item)
    }
  })

  return roots
}

export default function CourseDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useT()
  const highlightNodeId = searchParams.get('node')

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('nodes')

  const [nodes, setNodes] = useState<SystemCourseNode[]>([])
  const [resources, setResources] = useState<NodeResource[]>([])
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const [mobileAccessOpen, setMobileAccessOpen] = useState(false)

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
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !course) return

    courseNodeApi
      .list({ courseId: id, limit: 1000 } as any)
      .then((res) => setNodes((res.items || []) as any))
      .catch(() => setNodes([]))

    fetchAllPages((page, pageSize) => courseResourceApi.list({ courseId: id, limit: pageSize, offset: page * pageSize }))
      .then((res) => setResources(res || []))
      .catch(() => setResources([]))

    knowledgeApi
      .list({ limit: 1000 })
      .then((res) => {
        const m = new Map<string, KnowledgePoint>()
        ;(res.items || []).forEach((k) => m.set(k.id, k))
        setKnowledgeMap(m)
      })
      .catch(() => setKnowledgeMap(new Map()))
  }, [id, course])

  // 从考试页返回时高亮并定位到对应节点
  useEffect(() => {
    if (!highlightNodeId) return
    const el = document.getElementById(`course-node-${highlightNodeId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightNodeId, nodes])

  const allResources = useMemo(() => {
    const items: NodeResource[] = []
    nodes.forEach((n) => {
      ;(n.resources || []).forEach((r) => items.push({ ...r, nodeId: n.id }))
    })
    resources.forEach((r) => items.push({ ...r, nodeId: 'course' }))
    return items
  }, [resources, nodes])

  const totalResources = allResources.length
  const courseKnowledgeList = useMemo(() => {
    const ids = new Set<string>()
    const kps: KnowledgePoint[] = []
    course?.knowledgePointIds?.forEach((kid) => {
      if (ids.has(kid)) return
      ids.add(kid)
      const kp = knowledgeMap.get(kid)
      if (kp) kps.push(kp)
    })
    nodes.forEach((n) => {
      ;(n.knowledgePoints || []).forEach((kp) => {
        if (ids.has(kp.id)) return
        ids.add(kp.id)
        kps.push(kp as KnowledgePoint)
      })
    })
    return kps
  }, [course, nodes, knowledgeMap])

  const tree = useMemo(() => buildTree(nodes), [nodes])

  const diff = SCENE_DIFFICULTY[course?.difficulty ?? 3] || SCENE_DIFFICULTY[3]

  function getNodeEvalMethods(node: SystemCourseNode) {
    const evalData = (node.evalData as any) || {}
    const methods: string[] = []
    const evalRuleConfig = evalData.evalRuleConfig
    if (evalRuleConfig?.evaluationMethods) {
      methods.push(...evalRuleConfig.evaluationMethods)
    }
    // 混合课：课前测验/随堂测验/课后作业三个子规则的测评方式聚合展示
    const hybridRules = evalData.hybridEvalRules
    if (hybridRules) {
      ;['preQuiz', 'inClassQuiz', 'homework'].forEach((moduleKey) => {
        const part = hybridRules[moduleKey]
        const mrc = part?.evalRuleConfig
        if (mrc?.evaluationMethods) {
          methods.push(...mrc.evaluationMethods)
        }
      })
    }
    return methods.map((methodKey) => ({ methodKey }))
  }

  // 聚合节点评价规则（体系课 evalRuleConfig / 混合课 hybridEvalRules）
  function getNodeEvalRule(node: SystemCourseNode) {
    const evalData = (node.evalData as any) || {}
    const methods: { key: string; weight: number }[] = []
    const collect = (rc: any) => {
      if (!rc?.evaluationMethods) return
      ;(rc.evaluationMethods as string[]).forEach((m) => {
        methods.push({ key: m, weight: rc.methodWeights?.[m] || 0 })
      })
    }
    collect(evalData.evalRuleConfig)
    const hybridRules = evalData.hybridEvalRules
    if (hybridRules) {
      ;['preQuiz', 'inClassQuiz', 'homework'].forEach((moduleKey) => {
        collect(hybridRules[moduleKey]?.evalRuleConfig)
      })
    }
    return methods
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <Skeleton className="h-[320px] w-full" />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 w-full flex-1">
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
        <Footer className="mt-auto" />
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
          <div className="text-lg font-semibold text-slate-600">{t('课程不存在或暂未公开')}</div>
          <Link
            href="/lesson/landing"
            className="text-primary hover:text-primary mt-3 text-sm font-medium"
          >
            {t('返回课程列表')}
          </Link>
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  const isGranular = course.type === 'granular'
  const tabs = isGranular ? GRANULAR_TABS : SYSTEM_TABS
  // 若当前 activeTab 不属于该课程类型的 tab 集合（如颗粒课不含"课程目录"），回退到第一个合法 tab
  const effectiveTab = tabs.some((t) => t.value === activeTab) ? activeTab : tabs[0].value

  const toggleCollapse = (nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const coverStyle = course.coverImage
    ? { backgroundImage: `url('${course.coverImage}')` }
    : { background: coverGradientFor(course.id) }

  const renderTreeNodes = (items: TreeItem[], flatIndexes: Map<string, number>): ReactNode =>
    items.map((item) => {
      const { node, children } = item
      const hasChildren = children.length > 0
      const collapsed = collapsedIds.has(node.id)
      const nodeResources = node.resources || []
      const nodeKnow = node.knowledgePoints?.length || 0
      const evalMethods = getNodeEvalMethods(node)
      const flatIndex = flatIndexes.get(node.id) ?? 0
      return (
        <div key={node.id}>
          <div
            id={`course-node-${node.id}`}
            className={`group bg-white rounded-xl border overflow-hidden transition-all ${highlightNodeId === node.id ? 'ring-2 ring-primary/20 border-primary/30' : 'border-slate-200 hover:border-primary/25 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]'}`}
          >
            <div className="flex items-center gap-3 p-4">
              {hasChildren ? (
                <button
                  onClick={() => toggleCollapse(node.id)}
                  className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 hover:bg-primary/5 hover:text-primary flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  title={collapsed ? t('展开子节点') : t('收起子节点')}
                >
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-5 h-5 shrink-0" />
              )}
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md shadow-primary/25">
                {flatIndex + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-[15px] font-semibold text-slate-800 truncate">
                    {node.name}
                  </div>
                  {node.type === 'original' && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium border bg-primary/5 text-primary border-primary/15 shrink-0">
                      {t('引用颗粒课')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {t('{n} 课时', { n: node.duration || 0 })}
                  </span>
                  {nodeResources.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" />
                      {t('{n} 个资源', { n: nodeResources.length })}
                    </span>
                  )}
                  {nodeKnow > 0 && (
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5" />
                      {t('{n} 个知识点', { n: nodeKnow })}
                    </span>
                  )}
                </div>
                {evalMethods.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {evalMethods.map(({ methodKey }) => (
                      <span
                        key={methodKey}
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ backgroundColor: EVAL_METHOD_COLORS[methodKey] || '#94a3b8' }}
                      >
                        {EVAL_METHOD_LABELS[methodKey] || methodKey}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {hasChildren && !collapsed && (
            <div className="ml-8 pl-4 border-l-2 border-slate-100 space-y-3 mt-3 mb-3">
              {renderTreeNodes(children, flatIndexes)}
            </div>
          )}
        </div>
      )
    })

  const renderTabContent = () => {
    switch (effectiveTab) {
      case 'nodes':
        return (
          <div>
            {nodes.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <ListChecks className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">{t('暂无课程节点')}</div>
                <div className="text-[13px] mt-1">{t('该课程暂未配置章节节点')}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {renderTreeNodes(
                  tree,
                  new Map([...nodes].sort((a, b) => a.order - b.order).map((n, i) => [n.id, i])),
                )}
              </div>
            )}
          </div>
        )

      case 'resources':
        return (
          <div>
            <div className="text-sm text-slate-500 mb-4">
              {t('共')} <strong className="text-primary">{totalResources}</strong> {t('个资源')}
            </div>
            {totalResources === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">{t('暂无关联资源')}</div>
                <div className="text-[13px] mt-1">{t('该课程暂未配置学习资源')}</div>
              </div>
            ) : (
              <div className="space-y-5">
                {(() => {
                  const nodeMap = new Map<string, string>()
                  nodes.forEach((n) => nodeMap.set(n.id, n.name))
                  const byNode = new Map<string, NodeResource[]>()
                  allResources.forEach((r) => {
                    const nid = (r as any).nodeId || 'course'
                    const list = byNode.get(nid) || []
                    list.push(r)
                    byNode.set(nid, list)
                  })
                  return Array.from(byNode.entries()).map(([nid, resList]) => {
                    const nodeName = nid === 'course' ? t('课程全局资源') : nodeMap.get(nid) || nid
                    return (
                      <div key={nid}>
                        <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          {nodeName}
                          <span className="text-xs text-slate-400 font-normal">
                            ({resList.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {resList.map((r) => {
                            const typeColors: Record<string, string> = {
                              document: 'bg-primary/5 text-primary border-primary/10',
                              video: 'bg-primary/5 text-primary border-primary/10',
                              link: 'bg-purple-50 text-purple-600 border-purple-100',
                              file: 'bg-primary/5 text-primary border-primary/10',
                            }
                            return (
                              <div
                                key={r.id}
                                className="group bg-slate-50 rounded-xl p-3.5 border border-slate-100 hover:border-primary/25 hover:shadow-md hover:-translate-y-0.5 transition-all"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 mb-1.5 truncate">
                                      {r.name}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeColors[r.type] || 'bg-slate-100 text-slate-500 border-slate-200'}`}
                                      >
                                        {RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type}
                                      </span>
                                      {r.size && <span>{formatSize(r.size)}</span>}
                                    </div>
                                  </div>
                                  {r.url && (
                                    <button
                                      onClick={() =>
                                        addPreviewResource(r as unknown as TaskResource)
                                      }
                                      className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                                      title={t('预览资源')}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
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

      case 'evaluation':
        return (() => {
          const evalNodes = nodes.filter((n) => getNodeEvalMethods(n).length > 0)
          if (evalNodes.length === 0) {
            return (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Target className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-[15px] font-medium text-slate-600">{t('暂未配置评价标准')}</div>
                <div className="text-[13px] mt-1">{t('该课程暂未设置评价方式')}</div>
              </div>
            )
          }
          return (
            <div>
              <div className="text-sm text-slate-500 mb-4">
                {t('共')} <strong className="text-primary">{evalNodes.length}</strong>{' '}
                {t('个节点配置了评价标准')}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {evalNodes.map((node) => {
                  const evalRule = getNodeEvalRule(node)
                  const methods = evalRule.map((m) => m.key)
                  const weights = Object.fromEntries(evalRule.map((m) => [m.key, m.weight]))
                  return (
                    <div
                      key={node.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary/25 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          <Target className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {node.name}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {node.duration
                              ? t('{n} 课时', { n: node.duration })
                              : t('未配置课时')}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {methods.map((m) => (
                          <span
                            key={m}
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
                            style={{ backgroundColor: EVAL_METHOD_COLORS[m] || '#94a3b8' }}
                          >
                            {EVAL_METHOD_LABELS[m] || m}
                          </span>
                        ))}
                      </div>
                      {methods.map((m) => (
                        <div key={m} className="flex items-center gap-2 mb-1.5">
                          <span className="text-[11px] text-slate-500 w-16 shrink-0 truncate">
                            {EVAL_METHOD_LABELS[m] || m}
                          </span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.round(weights[m] || 0)}%`,
                                backgroundColor: EVAL_METHOD_COLORS[m] || '#94a3b8',
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 w-8 text-right">
                            {Math.round(weights[m] || 0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()

      case 'knowledge':
        return <LessonKnowledgeGraph course={course} nodes={nodes} knowledgeMap={knowledgeMap} />

      default:
        return null
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-[#f8fafc]"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-2 mb-5 text-sm text-slate-500">
            <button
              onClick={() => router.back()}
              className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-primary/5 hover:text-primary transition-colors">
                ←
              </span>{' '}
              {t('返回上一页')}
            </button>
            <span className="text-slate-300 shrink-0">/</span>
            <Link href="/lesson/landing" className="hover:text-primary transition-colors hidden sm:inline">
              {t('课程列表')}
            </Link>
            <span className="text-slate-300 shrink-0 hidden sm:inline">/</span>
            <span className="text-slate-800 font-medium truncate min-w-0">{course.name}</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            <div className="flex-1 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6">
                  <div
                    className="w-full sm:w-[280px] h-[190px] rounded-2xl bg-cover bg-center flex items-center justify-center shrink-0 self-stretch shadow-[0_12px_40px_rgba(0,0,0,0.15)] relative overflow-hidden"
                    style={coverStyle}
                  >
                    {!course.coverImage && (
                      <BookOpen
                        className="w-16 h-16 text-white/85 drop-shadow-md relative z-10"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="absolute bottom-3 right-3 z-10 bg-[#0f172a]/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] border border-white/20">
                      {course.version || 'V1.0'}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <h1 className="text-[26px] font-bold text-slate-900 truncate">
                          {course.name}
                        </h1>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-primary/5 text-primary font-medium shrink-0 border border-primary/15">
                          {t(courseTypeLabels[course.type] || course.type)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1.5">
                        {t('创建人：{n}', { n: (course.creatorId || '').slice(0, 8) })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {t('更新于 {n}', { n: formatDate(course.updatedAt) })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> {t('{n} 节点', { n: course.nodeCount })}
                      </span>
                    </div>

                    {course.description && (
                      <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                        {course.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                      {course.majorName && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">{t('适用专业：')}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-primary/5 text-primary border border-primary/10 font-medium">
                            {course.majorName}
                          </span>
                        </div>
                      )}
                      {course.difficulty && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">{t('难度等级：')}</span>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] border font-medium"
                            style={{
                              backgroundColor: diff.color + '15',
                              color: diff.color,
                              borderColor: diff.color + '30',
                            }}
                          >
                            {diff.label}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-auto pt-5">
                      {!isGranular && (
                        <Link href={`/lesson/landing/${id}/learn`}>
                          <Button className="rounded-xl px-7 h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all">
                            <PlayCircle className="w-4 h-4 mr-1.5" /> {t('开始学习')}
                          </Button>
                        </Link>
                      )}
                      <FavoriteButton
                        targetType="course"
                        targetId={id}
                        label={t('收藏课程')}
                        className="h-11 rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        className="rounded-xl h-11 w-11 p-0 text-slate-500 hover:text-primary border border-slate-200 hover:bg-primary/5 hover:border-primary/30 transition-all"
                        aria-label={t('分享')}
                        onClick={() => setMobileAccessOpen(true)}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-[320px] shrink-0 flex">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] w-full">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">{t('课程统计')}</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">{t('课程节点')}</span>
                    <span className="text-sm font-bold text-primary">{nodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">{t('教学资源')}</span>
                    <span className="text-sm font-bold text-primary">{totalResources}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">{t('知识点')}</span>
                    <span className="text-sm font-bold text-primary">
                      {courseKnowledgeList.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">{t('线上课时')}</span>
                    <span className="text-sm font-bold text-primary">
                      {course.onlineHours || 0}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-500">{t('线下课时')}</span>
                    <span className="text-sm font-bold text-primary">
                      {course.offlineHours || 0}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-6 py-6 w-full">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-visible md:overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <MobileTabDropdown
            items={tabs.map((tTab) => ({
              value: tTab.value,
              label: t(tTab.label),
              icon: tTab.icon,
              count:
                tTab.value === 'nodes'
                  ? nodes.length
                  : tTab.value === 'resources'
                    ? totalResources
                    : tTab.value === 'knowledge'
                      ? courseKnowledgeList.length
                      : undefined,
            }))}
            value={effectiveTab}
            onValueChange={setActiveTab}
            className="md:hidden m-4"
          />
          <div className="hidden md:flex overflow-x-auto border-b border-slate-100 px-4 sm:px-6">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.value}
                onClick={() => setActiveTab(tabItem.value)}
                className={`
                  py-3.5 sm:py-4 px-3 sm:px-5 text-[14px] whitespace-nowrap relative transition-all cursor-pointer flex items-center gap-1.5
                  ${effectiveTab === tabItem.value ? 'text-primary font-semibold' : 'text-slate-500 hover:text-primary hover:bg-primary/5'}
                `}
              >
                <tabItem.icon
                  className={`w-4 h-4 ${effectiveTab === tabItem.value ? 'text-primary' : 'text-slate-400'}`}
                />
                {t(tabItem.label)}
                {tabItem.value === 'nodes' && nodes.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${effectiveTab === tabItem.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {nodes.length}
                  </span>
                )}
                {tabItem.value === 'resources' && totalResources > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${effectiveTab === tabItem.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {totalResources}
                  </span>
                )}
                {tabItem.value === 'knowledge' && courseKnowledgeList.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] leading-none ${effectiveTab === tabItem.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {courseKnowledgeList.length}
                  </span>
                )}
                {effectiveTab === tabItem.value && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6 min-h-[500px]">{renderTabContent()}</div>
        </div>
      </main>

      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}

      <MobileAccessDialog open={mobileAccessOpen} onOpenChange={setMobileAccessOpen} />

      <Footer className="mt-auto" />
    </div>
  )
}
