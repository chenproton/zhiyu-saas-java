"use client"

import { useEffect, useState } from "react"
import { BookOpen, Lightbulb, Award, FolderKanban, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { knowledgeApi, abilityApi, certificateLibraryApi, resourceLibraryApi, onSiteQuestionLibraryApi } from "@/lib/api"
import type { KnowledgePoint, AbilityPoint, CertificateLibraryItem, ResourceLibraryItem, OnSiteQuestionLibraryItem } from "@/lib/types"
import { RESOURCE_TYPE_LABELS, type ResourceKind } from "@/lib/types/library"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/hooks/use-toast"

type TabKey = "knowledge" | "ability" | "certificates" | "resources" | "questions"

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "knowledge", label: "知识点库", icon: <BookOpen className="size-4" /> },
  { key: "ability", label: "能力点库", icon: <Lightbulb className="size-4" /> },
  { key: "certificates", label: "证书库", icon: <Award className="size-4" /> },
  { key: "resources", label: "教学资源库", icon: <FolderKanban className="size-4" /> },
  { key: "questions", label: "现场问答题库", icon: <MessageSquare className="size-4" /> },
]

export default function MyResourcesPage() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>("knowledge")

  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgePoint[]>([])
  const [abilityItems, setAbilityItems] = useState<AbilityPoint[]>([])
  const [certificateItems, setCertificateItems] = useState<CertificateLibraryItem[]>([])
  const [resourceItems, setResourceItems] = useState<ResourceLibraryItem[]>([])
  const [questionItems, setQuestionItems] = useState<OnSiteQuestionLibraryItem[]>([])

  const [loadingKnowledge, setLoadingKnowledge] = useState(false)
  const [loadingAbility, setLoadingAbility] = useState(false)
  const [loadingCertificates, setLoadingCertificates] = useState(false)
  const [loadingResources, setLoadingResources] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return

    switch (activeTab) {
      case "knowledge":
        if (knowledgeItems.length === 0) loadKnowledge()
        break
      case "ability":
        if (abilityItems.length === 0) loadAbilities()
        break
      case "certificates":
        if (certificateItems.length === 0) loadCertificates()
        break
      case "resources":
        if (resourceItems.length === 0) loadResources()
        break
      case "questions":
        if (questionItems.length === 0) loadQuestions()
        break
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

  const loadResources = async () => {
    setLoadingResources(true)
    try {
      const res = await resourceLibraryApi.list({ uploadedBy: userId!, limit: 500 })
      setResourceItems(res.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载教学资源失败", description: err.message })
    } finally { setLoadingResources(false) }
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

  const countForTab = (tab: TabKey) => {
    switch (tab) {
      case "knowledge": return knowledgeItems.length
      case "ability": return abilityItems.length
      case "certificates": return certificateItems.length
      case "resources": return resourceItems.length
      case "questions": return questionItems.length
    }
  }

  return (
    <div className="p-6 space-y-5">
      <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <FolderKanban className="size-5 text-violet-600" />
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
            <TabsList className="mb-4">
              {TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="knowledge">
              {renderTable(
                loadingKnowledge,
                knowledgeItems,
                ["name", "code", "description"],
                ["名称", "编码", "描述"],
                (item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-blue-500" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                    </td>
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
                ["name", "category", "description"],
                ["名称", "分类", "描述"],
                (item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="size-4 text-amber-500" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-400">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {item.category === "knowledge" ? "知识" : item.category === "skill" ? "技能" : "素养"}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-400 max-w-[300px] truncate">{item.description || "-"}</td>
                  </tr>
                ),
              )}
            </TabsContent>

            <TabsContent value="certificates">
              {renderTable(
                loadingCertificates,
                certificateItems,
                ["name", "description", "url"],
                ["名称", "描述", "链接"],
                (item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Award className="size-4 text-emerald-500" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-400 max-w-[300px] truncate">{item.description || "-"}</td>
                    <td className="p-3 text-sm text-slate-400 max-w-[200px] truncate">{item.url || "-"}</td>
                  </tr>
                ),
              )}
            </TabsContent>

            <TabsContent value="resources">
              {renderTable(
                loadingResources,
                resourceItems,
                ["name", "resourceType", "description"],
                ["名称", "资源类型", "描述"],
                (item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="size-4 text-indigo-500" />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-400">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {RESOURCE_TYPE_LABELS[item.resourceType as ResourceKind] || item.resourceType}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-400 max-w-[300px] truncate">{item.description || "-"}</td>
                  </tr>
                ),
              )}
            </TabsContent>

            <TabsContent value="questions">
              {renderTable(
                loadingQuestions,
                questionItems,
                ["questionText", "questionType", "score"],
                ["题目", "题型", "分值"],
                (item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-rose-500" />
                        <span className="text-sm font-medium text-slate-700">{item.questionText}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-slate-400">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {item.questionType}
                      </span>
                    </td>
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
  headers: string[],
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
              <td colSpan={headers.length} className="p-12 text-center text-muted-foreground">
                加载中...
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="p-12 text-center text-muted-foreground">
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
