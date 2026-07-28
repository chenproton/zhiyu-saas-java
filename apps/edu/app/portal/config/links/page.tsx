"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save, Globe, AlertCircle, Plus, Trash2, LayoutGrid, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  usePlatformLinks,
  savePlatformLinks,
  useAppModules,
  saveAppModules,
  type PlatformLinksData,
  type AppModulesData,
  type AppModule,
} from "@zhiyu/ui"

const platformGroups = [
  {
    title: "场景应用生态",
    items: [
      { id: "alliance", name: "产教协同与人才品牌运营平台" },
      { id: "career", name: "职业岗位学习平台" },
      { id: "scene", name: "实践场景学习平台" },
      { id: "ability", name: "能力评价与测评资源管理平台" },
    ],
  },
  {
    title: "资源保障生态",
    items: [
      { id: "course", name: "数字课程服务平台" },
      { id: "ai", name: "AI 智能服务平台" },
      { id: "resource", name: "教学资源共享服务平台" },
      { id: "mall", name: "教学资源商城" },
    ],
  },
  {
    title: "运营治理生态",
    items: [
      { id: "affairs", name: "教务服务平台" },
    ],
  },
  {
    title: "创新服务生态",
    items: [
      { id: "opc", name: "OPC专区" },
      { id: "decision", name: "敏捷决策中心" },
      { id: "research", name: "教科研服务中心" },
    ],
  },
]

export default function PlatformConfigPage() {
  const { data: linksData, loading: linksLoading, refresh: refreshLinks } = usePlatformLinks()
  const { data: modulesData, loading: modulesLoading, refresh: refreshModules } = useAppModules()

  const [activeTab, setActiveTab] = useState("links")
  const [linksForm, setLinksForm] = useState<Record<string, { url: string; enabled: boolean }>>({})
  const [modulesForm, setModulesForm] = useState<AppModulesData>({ platforms: [] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      if (linksData.platforms.length > 0) {
        const map: Record<string, { url: string; enabled: boolean }> = {}
        for (const p of linksData.platforms) {
          map[p.id] = { url: p.url, enabled: p.enabled }
        }
        setLinksForm(map)
      }
    })()
  }, [linksData])

  useEffect(() => {
    ;(async () => {
      if (modulesData.platforms.length > 0) {
        setModulesForm({ platforms: modulesData.platforms.map((p) => ({ ...p, modules: [...p.modules] })) })
      }
    })()
  }, [modulesData])

  const handleLinkChange = (id: string, field: "url" | "enabled", value: string | boolean) => {
    setLinksForm((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const handleModuleChange = (
    platformId: string,
    moduleIndex: number,
    field: keyof AppModule,
    value: string
  ) => {
    setModulesForm((prev) => ({
      platforms: prev.platforms.map((p) =>
        p.id === platformId
          ? {
              ...p,
              modules: p.modules.map((m, i) => (i === moduleIndex ? { ...m, [field]: value } : m)),
            }
          : p
      ),
    }))
  }

  const addModule = (platformId: string) => {
    setModulesForm((prev) => ({
      platforms: prev.platforms.map((p) =>
        p.id === platformId
          ? {
              ...p,
              modules: [
                ...p.modules,
                {
                  id: `${platformId}-${Date.now()}`,
                  title: "",
                  desc: "",
                  href: "",
                },
              ],
            }
          : p
      ),
    }))
  }

  const removeModule = (platformId: string, moduleIndex: number) => {
    setModulesForm((prev) => ({
      platforms: prev.platforms.map((p) =>
        p.id === platformId
          ? {
              ...p,
              modules: p.modules.filter((_, i) => i !== moduleIndex),
            }
          : p
      ),
    }))
  }

  const handleSaveLinks = async () => {
    setSaving(true)
    setMessage(null)

    const platforms = platformGroups.flatMap((g) =>
      g.items.map((item) => ({
        id: item.id,
        name: item.name,
        url: linksForm[item.id]?.url?.trim() || "",
        enabled: linksForm[item.id]?.enabled ?? true,
      }))
    )

    const success = await savePlatformLinks({ platforms })
    if (success) {
      setMessage({ type: "success", text: "平台跳转地址已保存" })
      refreshLinks()
    } else {
      setMessage({ type: "error", text: "保存失败，请重试" })
    }
    setSaving(false)
  }

  const handleSaveModules = async () => {
    setSaving(true)
    setMessage(null)

    const cleaned = {
      platforms: modulesForm.platforms.map((p) => ({
        ...p,
        modules: p.modules.filter((m) => m.title.trim()),
      })),
    }

    const success = await saveAppModules(cleaned)
    if (success) {
      setMessage({ type: "success", text: "应用服务子模块配置已保存" })
      refreshModules()
    } else {
      setMessage({ type: "error", text: "保存失败，请重试" })
    }
    setSaving(false)
  }

  const loading = linksLoading || modulesLoading

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa] flex items-center justify-center pt-14">
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa] pt-14">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/portal"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回门户
            </Link>
            <h1 className="text-xl font-bold text-foreground">平台地址配置</h1>
          </div>
          <Button
            onClick={activeTab === "links" ? handleSaveLinks : handleSaveModules}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "保存中..." : "保存配置"}
          </Button>
        </div>

        {message && (
          <Alert className={`mb-6 ${message.type === "success" ? "border-green-200 bg-green-50" : ""}`}>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="links" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              平台跳转地址
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              应用服务子模块
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Platform Links */}
          <TabsContent value="links" className="space-y-6">
            <p className="text-sm text-muted-foreground">
              配置各平台的外部访问地址，并控制是否在门户首页显示跳转。地址需以 http:// 或 https:// 开头。
            </p>

            <div className="space-y-6">
              {platformGroups.map((group) => (
                <Card key={group.title}>
                  <CardHeader>
                    <CardTitle className="text-base">{group.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        <div className="w-48 shrink-0">
                          <Label htmlFor={`link-${item.id}`} className="text-sm text-foreground">
                            {item.name}
                          </Label>
                        </div>
                        <div className="flex-1 relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id={`link-${item.id}`}
                            value={linksForm[item.id]?.url || ""}
                            onChange={(e) => handleLinkChange(item.id, "url", e.target.value)}
                            placeholder="https://example.com"
                            className="pl-9"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            id={`enable-${item.id}`}
                            checked={linksForm[item.id]?.enabled ?? true}
                            onCheckedChange={(checked) => handleLinkChange(item.id, "enabled", checked)}
                          />
                          <Label htmlFor={`enable-${item.id}`} className="text-sm text-muted-foreground cursor-pointer">
                            {linksForm[item.id]?.enabled ?? true ? "启用" : "禁用"}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab 2: App Modules */}
          <TabsContent value="modules" className="space-y-6">
            <p className="text-sm text-muted-foreground">
              配置应用服务中心中各平台的子模块名称、描述和跳转地址。子模块将在应用服务中心对应平台卡片中展示。
            </p>

            <div className="space-y-6">
              {modulesForm.platforms.map((platform) => (
                <Card key={platform.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{platform.name}</CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addModule(platform.id)}
                        className="flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加子模块
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {platform.modules.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        暂无子模块，点击上方按钮添加
                      </p>
                    )}
                    {platform.modules.map((module, index) => (
                      <div key={module.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">子模块名称</Label>
                            <Input
                              value={module.title}
                              onChange={(e) => handleModuleChange(platform.id, index, "title", e.target.value)}
                              placeholder="如：岗位资源管理"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">功能描述</Label>
                            <Input
                              value={module.desc}
                              onChange={(e) => handleModuleChange(platform.id, index, "desc", e.target.value)}
                              placeholder="如：管理岗位相关的学习资源"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">跳转地址</Label>
                            <Input
                              value={module.href}
                              onChange={(e) => handleModuleChange(platform.id, index, "href", e.target.value)}
                              placeholder="https://example.com"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 mt-5"
                          onClick={() => removeModule(platform.id, index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
