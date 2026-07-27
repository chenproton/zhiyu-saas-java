"use client"

import { useEffect, useState } from "react"
import { BookOpen, Lightbulb, Award, MessageSquare, FileText, Table, Image, Link, Music, Video, Archive, Building, Wrench, AppWindow, HelpCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { knowledgeApi, abilityApi, certificateLibraryApi, onSiteQuestionLibraryApi, resourceLibraryApi } from "@/lib/api"
import type { KnowledgePoint, AbilityPoint, CertificateLibraryItem, ResourceLibraryItem, OnSiteQuestionLibraryItem } from "@/lib/types"
import { RESOURCE_TYPE_LABELS, type ResourceKind } from "@/lib/types/library"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/hooks/use-toast"

const RESOURCE_KINDS: ResourceKind[] = ["document", "spreadsheet", "image", "link", "audio", "video", "archive", "venue", "facility", "software", "other"]

const RESOURCE_ICONS: Record<ResourceKind, React.ReactNode> = {
  document: <FileText className="size-4" />,
  spreadsheet: <Table className="size-4" />,
  image: <Image className="size-4" />,
  link: <Link className="size-4" />,
  audio: <Music className="size-4" />,
  video: <Video className="size-4" />,
  archive: <Archive className="size-4" />,
  venue: <Building className="size-4" />,
  facility: <Wrench className="size-4" />,
  software: <AppWindow className="size-4" />,
  other: <HelpCircle className="size-4" />,
}

type TabKey = "knowledge" | "ability" | "certificates" | "questions" | `resource:${ResourceKind}`

interface TabDef {
  key: TabKey
  label: string
  icon: React.ReactNode
}

function buildTabs(): TabDef[] {
  const tabs: TabDef[] = [
    { key: "knowledge", label: "知识点库", icon: <BookOpen className="size-4" /> },
    { key: "ability", label: "能力点库", icon: <Lightbulb className="size-4" /> },
    { key: "certificates", label: "证书库", icon: <Award className="size-4" /> },
  ]
  for (const kind of RESOURCE_KINDS) {
    tabs.push({
      key: `resource:${kind}`,
      label: RESOURCE_TYPE_LABELS[kind],
      icon: RESOURCE_ICONS[kind],
    })
  }
  tabs.push(
    { key: "questions", label: "现场问答题库", icon: <MessageSquare className="size-4" /> },
  )
  return tabs
}

const TABS = buildTabs()

export default function MyResourcesPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>("knowledge")

  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgePoint[]>([])
  const [abilityItems, setAbilityItems] = useState<AbilityPoint[]>([])
  const [certificateItems, setCertificateItems] = useState<CertificateLibraryItem[]>([])
  const [questionItems, setQuestionItems] = useState<OnSiteQuestionLibraryItem[]>([])
  const [resourceItemsMap, setResourceItemsMap] = useState<Record<ResourceKind, ResourceLibraryItem[]>>(() => {
    const m = {} as Record<ResourceKind, ResourceLibraryItem[]>
    for (const k of RESOURCE_KINDS) m[k] = []
    return m
  })

  const [loadingKnowledge, setLoadingKnowledge] = useState(false)
  const [loadingAbility, setLoadingAbility] = useState(false)
  const [loadingCertificates, setLoadingCertificates] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingResourceKind, setLoadingResourceKind] = useState<ResourceKind | null>(null)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return

    if (activeTab === "knowledge" && knowledgeItems.length === 0) loadKnowledge()
    else if (activeTab === "ability" && abilityItems.length === 0) loadAbilities()
    else if (activeTab === "certificates" && certificateItems.length === 0) loadCertificates()
    else if (activeTab === "questions" && questionItems.length === 0) loadQuestions()
    else if (activeTab.startsWith("resource:")) {
      const kind = activeTab.replace("resource:", "") as ResourceKind
      if (resourceItemsMap[kind].length === 0) loadResourceKind(kind)
    }
  }, [activeTab, userId])

  const loadKnowledge = async () => {
    setLoadingKnowledge(true)
    try {
      const res = await knowledgeApi.list({ creatorId: userId!, limit: 500 })
      setKnowledgeItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载知识点失败", description: err.message })
    } finally { setLoadingKnowledge(false) }
  }

  const loadAbilities = async () => {
    setLoadingAbility(true)
    try {
      const res = await abilityApi.list({ creatorId: userId!, limit: 500 })
      setAbilityItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载能力点失败", description: err.message })
    } finally { setLoadingAbility(false) }
  }

  const loadCertificates = async () => {
    setLoadingCertificates(true)
    try {
      const res = await certificateLibraryApi.list({ creatorId: userId!, limit: 500 })
      setCertificateItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载证书失败", description: err.message })
    } finally { setLoadingCertificates(false) }
  }

  const loadQuestions = async () => {
    setLoadingQuestions(true)
    try {
      const res = await onSiteQuestionLibraryApi.list({ creatorId: userId!, limit: 500 })
      setQuestionItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载问答题失败", description: err.message })
    } finally { setLoadingQuestions(false) }
  }

  const loadResourceKind = async (kind: ResourceKind) => {
    setLoadingResourceKind(kind)
    try {
      const res = await resourceLibraryApi.list({ uploadedBy: userId!, resourceType: kind, limit: 500 })
      setResourceItemsMap(prev => ({ ...prev, [kind]: res.items }))
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载资源失败", description: err.message })
    } finally { setLoadingResourceKind(null) }
  }

  const countForTab = (tab: TabKey) => {
    if (tab === "knowledge") return knowledgeItems.length
    if (tab === "ability") return abilityItems.length
    if (tab === "certificates") return certificateItems.length
    if (tab === "questions") return questionItems.length
    if (tab.startsWith("resource:")) {
      const kind = tab.replace("resource:", "") as ResourceKind
      return resourceItemsMap[kind].length
    }
    return 0
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <FileText className="size-5 text-violet-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-violet-700">
              {countForTab(activeTab)}
            </div>
            <div className="text-xs text-violet-500">
              {TABS.find(t => t.key === activeTab)?.label} · 共 {countForTab(activeTab)} 项
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">我的资源</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              {TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                  {tab.icon}
                  {tab.label}
                  <span className="text-xs text-muted-foreground ml-0.5">{countForTab(tab.key)}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="knowledge">
              {renderTable(
                loadingKnowledge,
                knowledgeItems,
                ["名称", "编码", "描述"],
                (item: KnowledgePoint) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3"><div className="flex items-center gap-2"><BookOpen className="size-4 text-blue-500" /><span className="text-sm font-medium text-slate-700">{item.name}</span></div></td>
                    <td className="p-3 text-sm text-slate-400">{item.code || "-"}</td>
                    <td className="p-3 text-sm text-slate-400 max-w-[300px] truncate">{item.description || "-"}</td>
                  </tr>
                ),
              )}
            </TabsContent>

            <TabsContent value="ability">
              {renderTable(
                loadingAbility,
                abilityItems,
                ["名称", "分类", "描述"],
                (item: AbilityPoint) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3"><div className="flex items-center gap-2"><Lightbulb className="size-4 text-amber-500" /><span className="text-sm font-medium text-slate-700">{item.name}</span></div></td>
                    <td className="p-3 text-sm text-slate-400"><span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{item.category === "knowledge" ? "知识" : item.category === "skill" ? "技能" : "素养"}</span></td>
                    <td className="p-3 text-sm text-slate-400 max-w-[300px] truncate">{item.description || "-"}</td>
                  </tr>
                ),
              )}
            </TabsContent>

            <TabsContent value="certificates">
              {renderTable(
                loadingCertificates,
                certificateItems,
                ["名称", "描述", "链接"],
                (item: CertificateLibraryItem) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3"><div className="flex items-center gap-2"><Award className="size-4 text-emerald-500" /><span className="text-sm font-medium text-slate-700">{item.name}</span></div></td>
                    <td className="p-3 text-sm text-slate-400 max-w-[300px] truncate">{item.description || "-"}</td>
                    <td className="p-3 text-sm text-slate-400 max-w-[200px] truncate">{item.url || "-"}</td>
                  </tr>
                ),
              )}
            </TabsContent>

            {RESOURCE_KINDS.map(kind => (
              <TabsContent key={kind} value={`resource:${kind}`}>
                {renderTable(
                  loadingResourceKind === kind,
                  resourceItemsMap[kind],
                  ["名称", "描述"],
                  (item: ResourceLibraryItem) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="p-3"><div className="flex items-center gap-2">{RESOURCE_ICONS[kind]}<span className="text-sm font-medium text-slate-700">{item.name}</span></div></td>
                      <td className="p-3 text-sm text-slate-400 max-w-[400px] truncate">{item.description || "-"}</td>
                    </tr>
                  ),
                )}
              </TabsContent>
            ))}

            <TabsContent value="questions">
              {renderTable(
                loadingQuestions,
                questionItems,
                ["题目", "题型", "分值"],
                (item: OnSiteQuestionLibraryItem) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3"><div className="flex items-center gap-2"><MessageSquare className="size-4 text-rose-500" /><span className="text-sm font-medium text-slate-700">{item.questionText}</span></div></td>
                    <td className="p-3 text-sm text-slate-400"><span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{item.questionType}</span></td>
                    <td className="p-3 text-sm text-slate-400">{item.score}</td>
                  </tr>
                ),
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
) {
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-slate-50/50">
            {headerLabels.map((label) => (
              <th key={label} className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={headerLabels.length} className="p-12 text-center text-muted-foreground">
                加载中...
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={headerLabels.length} className="p-12 text-center text-muted-foreground">
                暂无数据
              </td>
            </tr>
          )}
          {items.map(renderRow)}
        </tbody>
      </table>
    </div>
  )
}
