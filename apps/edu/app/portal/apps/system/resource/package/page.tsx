"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, Clock, CheckCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import type { SubscriptionPackage } from "@/lib/types/backend"

interface SubModule {
  name: string
  enabled: boolean
}

interface PackageModule {
  name: string
  enabled: boolean
  subModules: SubModule[]
}

const SUBSCRIPTION_PLATFORM_DEFS: Record<string, {
  label: string
  pages: { id: string; label: string }[]
}> = {
  system: {
    label: "系统管理",
    pages: [
      { id: "tenant", label: "租户信息" },
      { id: "org-user", label: "组织用户" },
      { id: "resource", label: "系统资源" },
      { id: "logs", label: "日志管理" },
    ],
  },
  alliance: {
    label: "产教协同与人才品牌运营平台",
    pages: [{ id: "alliance-entry", label: "产教协同平台" }],
  },
  career: {
    label: "职业岗位学习平台",
    pages: [
      { id: "position-center", label: "岗位中心" },
      { id: "recommend-learn", label: "推荐与学习" },
      { id: "batch-approval", label: "批次与审批管理" },
    ],
  },
  course: {
    label: "数字课程服务平台",
    pages: [
      { id: "online-resources", label: "在线课资源库" },
      { id: "hybrid-resources", label: "混合课资源库" },
      { id: "teaching-space", label: "教学空间" },
      { id: "batch-approval", label: "批次与审批管理" },
    ],
  },
  scene: {
    label: "实践场景学习平台",
    pages: [
      { id: "scene-center", label: "场景中心" },
      { id: "batch-approval", label: "批次与审批管理" },
    ],
  },
  ability: {
    label: "能力评价与测评资源管理平台",
    pages: [
      { id: "exam-resources", label: "测评资源" },
      { id: "batch-approval", label: "批次与审批管理" },
      { id: "results-cert", label: "结果与认证" },
      { id: "graduate-portrait", label: "毕业与画像" },
    ],
  },
  affairs: {
    label: "教务服务平台",
    pages: [{ id: "affairs-entry", label: "教务服务" }],
  },
  ai: {
    label: "AI 智能服务平台",
    pages: [{ id: "ai-entry", label: "AI 服务" }],
  },
  resource: {
    label: "教学资源共享服务平台",
    pages: [{ id: "resource-mall", label: "资源商城" }],
  },
  opc: {
    label: "OPC专区",
    pages: [{ id: "opc-entry", label: "OPC 专区" }],
  },
  decision: {
    label: "敏捷决策中心",
    pages: [{ id: "decision-entry", label: "决策中心" }],
  },
  research: {
    label: "教科研服务中心",
    pages: [{ id: "research-entry", label: "教科研服务" }],
  },
}

function buildPackageModules(
  modules: Record<string, any> | undefined,
): PackageModule[] {
  if (!modules || typeof modules !== "object") return []

  return Object.entries(SUBSCRIPTION_PLATFORM_DEFS)
    .filter(([key]) => Boolean(modules[key]))
    .map(([key, def]) => {
      const enabled = Boolean(modules[key])
      return {
        name: def.label,
        enabled,
        subModules: def.pages.map((p) => ({
          name: p.label,
          enabled,
        })),
      }
    })
}

export default function PackagePage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [subscription, setSubscription] = useState<SubscriptionPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<string[]>([])

  useEffect(() => {
    if (authLoading || !tenantId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    portalRequest<SubscriptionPackage>(`/subscriptions${buildQuery({ tenantId })}`)
      .then((res) => {
        if (!cancelled) {
          setSubscription(res)
          const parsed = buildPackageModules(res.modules)
          if (parsed.length > 0) {
            setExpandedModules([parsed[0].name])
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载套餐信息失败")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tenantId, authLoading])

  const packageModules = useMemo(() => buildPackageModules(subscription?.modules), [subscription])

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleName) ? prev.filter((m) => m !== moduleName) : [...prev, moduleName]
    )
  }

  const enabledCount = packageModules.filter((m) => m.enabled).length
  const totalCount = packageModules.length

  const statusBadge =
    subscription?.status === "active" ? (
      <Badge variant="default" className="bg-green-500 text-white">
        <CheckCircle className="w-3 h-3 mr-1" />
        已激活
      </Badge>
    ) : (
      <Badge variant="secondary">{subscription?.status || "未知"}</Badge>
    )

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">套餐情况查看</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看当前租户购买的套餐内容和功能模块</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && subscription && (
        <div className="grid gap-6">
          {/* 套餐基本信息 */}
          <Card className="border-gray-100 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{subscription.name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        有效期至 {subscription.validUntil || "未设置"}
                      </span>
                      <span className="text-primary">
                        已开通 {enabledCount}/{totalCount} 个平台
                      </span>
                    </CardDescription>
                  </div>
                </div>
                {statusBadge}
              </div>
            </CardHeader>
          </Card>

          {/* 套餐功能模块 - 两级结构 */}
          <Card className="border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">套餐功能模块</CardTitle>
              <CardDescription>展开查看各平台包含的二级功能模块</CardDescription>
            </CardHeader>
            <CardContent>
              {packageModules.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">暂无模块配置</div>
              ) : (
                <div className="space-y-2">
                  {packageModules.map((module) => {
                    const isExpanded = expandedModules.includes(module.name)
                    return (
                      <div key={module.name} className="border border-gray-100 rounded-lg overflow-hidden">
                        {/* 一级模块 */}
                        <button
                          onClick={() => toggleModule(module.name)}
                          className={cn(
                            "w-full flex items-center justify-between p-4 text-left transition-colors",
                            module.enabled ? "hover:bg-gray-50" : "bg-gray-50/50 opacity-60"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle
                              className={cn("w-5 h-5", module.enabled ? "text-primary" : "text-muted-foreground")}
                            />
                            <span
                              className={cn(
                                "font-medium",
                                module.enabled ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {module.name}
                            </span>
                            {!module.enabled && <Badge variant="secondary" className="text-xs">未开通</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {module.subModules.filter((s) => s.enabled).length}/{module.subModules.length} 个功能
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* 二级模块列表 */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 bg-gray-50/50">
                            <div className="grid grid-cols-5 gap-2">
                              {module.subModules.map((subModule) => (
                                <div
                                  key={subModule.name}
                                  className={cn(
                                    "flex items-center gap-2 p-2.5 rounded-md border text-sm",
                                    subModule.enabled
                                      ? "border-primary/30 bg-white"
                                      : "border-gray-200 bg-gray-100/50 opacity-60"
                                  )}
                                >
                                  <CheckCircle
                                    className={cn(
                                      "w-3.5 h-3.5 shrink-0",
                                      subModule.enabled ? "text-primary" : "text-muted-foreground"
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "truncate",
                                      subModule.enabled ? "text-foreground" : "text-muted-foreground"
                                    )}
                                  >
                                    {subModule.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
