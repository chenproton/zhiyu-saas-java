'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Lightbulb,
  Award,
  MessageSquare,
  FileText,
  Table,
  Image,
  Link,
  Music,
  Video,
  Archive,
  Building,
  Wrench,
  AppWindow,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  knowledgeApi,
  abilityApi,
  certificateLibraryApi,
  onSiteQuestionLibraryApi,
  resourceLibraryApi,
} from '@/lib/api'
import type {
  KnowledgePoint,
  AbilityPoint,
  CertificateLibraryItem,
  ResourceLibraryItem,
  OnSiteQuestionLibraryItem,
} from '@/lib/types'
import { RESOURCE_TYPE_LABELS, type ResourceKind } from '@/lib/types/library'
import { useAuth } from '@/components/auth-provider'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

// 资源类型展示顺序（与共享 RESOURCE_TYPE_LABELS 对应）
const RESOURCE_KINDS: ResourceKind[] = Object.keys(RESOURCE_TYPE_LABELS) as ResourceKind[]

const RESOURCE_ICONS: Record<ResourceKind, React.ReactNode> = {
  document: <FileText className="size-4" />,
  spreadsheet: <Table className="size-4" />,
  image: <Image className="size-4" aria-label="image" />,
  link: <Link className="size-4" />,
  audio: <Music className="size-4" />,
  video: <Video className="size-4" />,
  archive: <Archive className="size-4" />,
  venue: <Building className="size-4" />,
  facility: <Wrench className="size-4" />,
  software: <AppWindow className="size-4" />,
  other: <HelpCircle className="size-4" />,
}

type TabKey = 'knowledge' | 'ability' | 'certificates' | 'questions' | `resource:${ResourceKind}`

interface TabDef {
  key: TabKey
  label: string
  icon: React.ReactNode
}

export default function MyResourcesPage() {
  const t = useT()
  const { toast } = useToast()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('knowledge')

  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgePoint[]>([])
  const [abilityItems, setAbilityItems] = useState<AbilityPoint[]>([])
  const [certificateItems, setCertificateItems] = useState<CertificateLibraryItem[]>([])
  const [questionItems, setQuestionItems] = useState<OnSiteQuestionLibraryItem[]>([])
  const [resourceItemsMap, setResourceItemsMap] = useState<
    Record<ResourceKind, ResourceLibraryItem[]>
  >(() => {
    const m = {} as Record<ResourceKind, ResourceLibraryItem[]>
    for (const k of RESOURCE_KINDS) m[k] = []
    return m
  })

  const [loadingKnowledge, setLoadingKnowledge] = useState(false)
  const [loadingAbility, setLoadingAbility] = useState(false)
  const [loadingCertificates, setLoadingCertificates] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingResourceKind, setLoadingResourceKind] = useState<ResourceKind | null>(null)

  // 记录已成功加载过的资源类型，避免空数据时 effect 反复触发加载
  const loadedResourceKinds = useRef<Set<ResourceKind>>(new Set())
  // 任一列表超过后端 maxPageSize=200 被截断时置 true，展示兜底提示
  const [truncated, setTruncated] = useState(false)

  const userId = user?.id

  const tabs: TabDef[] = [
    { key: 'knowledge', label: t('知识点库'), icon: <BookOpen className="size-4" /> },
    { key: 'ability', label: t('能力点库'), icon: <Lightbulb className="size-4" /> },
    { key: 'certificates', label: t('证书库'), icon: <Award className="size-4" /> },
  ]
  for (const kind of RESOURCE_KINDS) {
    tabs.push({
      key: `resource:${kind}`,
      label: RESOURCE_TYPE_LABELS[kind],
      icon: RESOURCE_ICONS[kind],
    })
  }
  tabs.push({ key: 'questions', label: t('现场问答题库'), icon: <MessageSquare className="size-4" /> })

  // TODO: 列表接口后端上限 maxPageSize=200，此处全量展示会被截断，需改为服务端分页
  const loadKnowledge = useCallback(async () => {
    setLoadingKnowledge(true)
    try {
      const res = await knowledgeApi.list({ creatorId: userId!, limit: 200 })
      setKnowledgeItems(res.items)
      if (res.total > res.items.length) setTruncated(true)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('加载知识点失败'), description: err.message })
    } finally {
      setLoadingKnowledge(false)
    }
  }, [userId, toast, t])

  const loadAbilities = useCallback(async () => {
    setLoadingAbility(true)
    try {
      const res = await abilityApi.list({ creatorId: userId!, limit: 200 })
      setAbilityItems(res.items)
      if (res.total > res.items.length) setTruncated(true)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('加载能力点失败'), description: err.message })
    } finally {
      setLoadingAbility(false)
    }
  }, [userId, toast, t])

  const loadCertificates = useCallback(async () => {
    setLoadingCertificates(true)
    try {
      const res = await certificateLibraryApi.list({ creatorId: userId!, limit: 200 })
      setCertificateItems(res.items)
      if (res.total > res.items.length) setTruncated(true)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('加载证书失败'), description: err.message })
    } finally {
      setLoadingCertificates(false)
    }
  }, [userId, toast, t])

  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true)
    try {
      const res = await onSiteQuestionLibraryApi.list({ creatorId: userId!, limit: 200 })
      setQuestionItems(res.items)
      if (res.total > res.items.length) setTruncated(true)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('加载问答题失败'), description: err.message })
    } finally {
      setLoadingQuestions(false)
    }
  }, [userId, toast, t])

  const loadResourceKind = useCallback(
    async (kind: ResourceKind) => {
      setLoadingResourceKind(kind)
      try {
        const res = await resourceLibraryApi.list({
          uploadedBy: userId!,
          resourceType: kind,
          limit: 200,
        })
        setResourceItemsMap((prev) => ({ ...prev, [kind]: res.items }))
        loadedResourceKinds.current.add(kind)
      } catch (err: any) {
        toast({ variant: 'destructive', title: t('加载资源失败'), description: err.message })
      } finally {
        setLoadingResourceKind(null)
      }
    },
    [userId, toast, t],
  )

  useEffect(() => {
    if (!userId) return

    // 将 tab 切换视为外部事件：在微任务回调中分发加载，避免在 effect 体内同步 setState
    Promise.resolve().then(() => {
      if (activeTab === 'knowledge' && knowledgeItems.length === 0) {
        loadKnowledge()
      } else if (activeTab === 'ability' && abilityItems.length === 0) {
        loadAbilities()
      } else if (activeTab === 'certificates' && certificateItems.length === 0) {
        loadCertificates()
      } else if (activeTab === 'questions' && questionItems.length === 0) {
        loadQuestions()
      } else if (activeTab.startsWith('resource:')) {
        const kind = activeTab.replace('resource:', '') as ResourceKind
        if (!loadedResourceKinds.current.has(kind)) {
          loadResourceKind(kind)
        }
      }
    })
  }, [
    activeTab,
    userId,
    knowledgeItems.length,
    abilityItems.length,
    certificateItems.length,
    questionItems.length,
    loadKnowledge,
    loadAbilities,
    loadCertificates,
    loadQuestions,
    loadResourceKind,
  ])

  const countForTab = (tab: TabKey) => {
    if (tab === 'knowledge') return knowledgeItems.length
    if (tab === 'ability') return abilityItems.length
    if (tab === 'certificates') return certificateItems.length
    if (tab === 'questions') return questionItems.length
    if (tab.startsWith('resource:')) {
      const kind = tab.replace('resource:', '') as ResourceKind
      return resourceItemsMap[kind].length
    }
    return 0
  }

  return (
    <div className="p-6 space-y-5">
      {truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          {t('部分数据超过单次加载上限（200 条），当前仅展示前 200 条，请按条件筛选查看完整数据。')}
        </div>
      )}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{countForTab(activeTab)}</div>
            <div className="text-xs text-primary">
              {tabs.find((tb) => tb.key === activeTab)?.label} · {t('共 {n} 项', { n: countForTab(activeTab) })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t('我的资源')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                  {tab.icon}
                  {tab.label}
                  <span className="text-xs text-muted-foreground ml-0.5">
                    {countForTab(tab.key)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="knowledge">
              {renderTable(
                loadingKnowledge,
                knowledgeItems,
                [t('名称'), t('编码'), t('描述')],
                (item: KnowledgePoint) => (
                  <TableRow key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <TableCell className="p-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-primary" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400">{item.code || '-'}</TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 max-w-[300px] truncate">
                      {item.description || '-'}
                    </TableCell>
                  </TableRow>
                ),
                t,
              )}
            </TabsContent>

            <TabsContent value="ability">
              {renderTable(
                loadingAbility,
                abilityItems,
                [t('名称'), t('分类'), t('描述')],
                (item: AbilityPoint) => (
                  <TableRow key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <TableCell className="p-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="size-4 text-amber-500" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400">
                      {item.attributes?.join('、') || '-'}
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 max-w-[300px] truncate">
                      {item.description || '-'}
                    </TableCell>
                  </TableRow>
                ),
                t,
              )}
            </TabsContent>

            <TabsContent value="certificates">
              {renderTable(
                loadingCertificates,
                certificateItems,
                [t('名称'), t('描述'), t('链接')],
                (item: CertificateLibraryItem) => (
                  <TableRow key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <TableCell className="p-3">
                      <div className="flex items-center gap-2">
                        <Award className="size-4 text-emerald-500" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 max-w-[300px] truncate">
                      {item.description || '-'}
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400 max-w-[200px] truncate">
                      {item.url || '-'}
                    </TableCell>
                  </TableRow>
                ),
                t,
              )}
            </TabsContent>

            {RESOURCE_KINDS.map((kind) => (
              <TabsContent key={kind} value={`resource:${kind}`}>
                {renderTable(
                  loadingResourceKind === kind,
                  resourceItemsMap[kind],
                  [t('名称'), t('描述')],
                  (item: ResourceLibraryItem) => (
                    <TableRow key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <TableCell className="p-3">
                        <div className="flex items-center gap-2">
                          {RESOURCE_ICONS[kind]}
                          <span className="text-sm font-medium text-slate-700">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="p-3 text-sm text-slate-400 max-w-[400px] truncate">
                        {item.description || '-'}
                      </TableCell>
                    </TableRow>
                  ),
                  t,
                )}
              </TabsContent>
            ))}

            <TabsContent value="questions">
              {renderTable(
                loadingQuestions,
                questionItems,
                [t('题目'), t('题型'), t('分值')],
                (item: OnSiteQuestionLibraryItem) => (
                  <TableRow key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <TableCell className="p-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-rose-500" />
                        <span className="text-sm font-medium text-slate-700">
                          {item.questionText}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {item.questionType}
                      </span>
                    </TableCell>
                    <TableCell className="p-3 text-sm text-slate-400">{item.score}</TableCell>
                  </TableRow>
                ),
                t,
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function renderTable<T>(
  loading: boolean,
  items: T[],
  headerLabels: string[],
  renderRow: (item: T) => React.ReactNode,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  return (
    <div className="rounded-lg border">
      <ShadcnTable>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
            {headerLabels.map((label) => (
              <TableHead
                key={label}
                className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"
              >
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell
                colSpan={headerLabels.length}
                className="p-12 text-center text-muted-foreground"
              >
                {t('加载中...')}
              </TableCell>
            </TableRow>
          )}
          {!loading && items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={headerLabels.length}
                className="p-12 text-center text-muted-foreground"
              >
                {t('暂无数据')}
              </TableCell>
            </TableRow>
          )}
          {items.map(renderRow)}
        </TableBody>
      </ShadcnTable>
    </div>
  )
}
