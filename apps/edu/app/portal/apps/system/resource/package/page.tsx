'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Clock, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { portalRequest, buildQuery } from '@/lib/api'
import { platformModuleDefs } from '@/lib/navigation-config'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { useT } from '@/lib/i18n/locale-provider'
import type { SubscriptionPackage } from '@/lib/types/backend'

interface SubModule {
  name: string
  enabled: boolean
}

interface PackageModule {
  name: string
  enabled: boolean
  subModules: SubModule[]
}

function buildPackageModules(modules: Record<string, any> | undefined): PackageModule[] {
  if (!modules || typeof modules !== 'object') return []

  return Object.entries(platformModuleDefs)
    .filter(([key]) => Boolean(modules[key]))
    .map(([key, def]) => {
      const enabled = Boolean(modules[key])
      return {
        name: def.label,
        enabled,
        subModules: def.subModules.map((p) => ({
          name: p.label,
          enabled,
        })),
      }
    })
}

export default function PackagePage() {
  const t = useT()
  const { tenantId, loading: authLoading } = usePortalAuth()
  const [subscription, setSubscription] = useState<SubscriptionPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<string[]>([])
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (authLoading || !tenantId) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await portalRequest<SubscriptionPackage>(
          `/subscriptions${buildQuery({ tenantId })}`,
        )
        if (!cancelled) {
          setSubscription(res)
          const parsed = buildPackageModules(res.modules)
          if (parsed.length > 0) {
            setExpandedModules([parsed[0].name])
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('加载套餐信息失败'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenantId, authLoading, reloadTick, t])

  const packageModules = useMemo(() => buildPackageModules(subscription?.modules), [subscription])

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleName) ? prev.filter((m) => m !== moduleName) : [...prev, moduleName],
    )
  }

  const enabledCount = packageModules.filter((m) => m.enabled).length
  const totalCount = packageModules.length

  const statusBadge =
    subscription?.status === 'active' ? (
      <Badge variant="default" className="bg-green-500 text-white">
        <CheckCircle className="w-3 h-3 mr-1" />
        {t('已激活')}
      </Badge>
    ) : (
      <Badge variant="secondary">{subscription?.status || t('未知')}</Badge>
    )

  return (
    <PortalCrudPage
      title={t('套餐情况查看')}
      description={t('查看当前租户购买的套餐内容和功能模块')}
      entityLabel={t('套餐')}
      items={[]}
      loading={loading}
      error={error}
      onRetry={() => {
        setSubscription(null)
        setReloadTick((t) => t + 1)
      }}
      colSpan={1}
      search={false}
      hideImport
      hideCreate
      body={
        !loading && subscription ? (
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
                          {t('有效期至 {date}', { date: subscription.validUntil || t('未设置') })}
                        </span>
                        <span className="text-primary">
                          {t('已开通 {enabled}/{total} 个平台', {
                            enabled: enabledCount,
                            total: totalCount,
                          })}
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
                <CardTitle className="text-base">{t('套餐功能模块')}</CardTitle>
                <CardDescription>{t('展开查看各平台包含的二级功能模块')}</CardDescription>
              </CardHeader>
              <CardContent>
                {packageModules.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {t('暂无模块配置')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {packageModules.map((module) => {
                      const isExpanded = expandedModules.includes(module.name)
                      return (
                        <div
                          key={t(module.name)}
                          className="border border-gray-100 rounded-lg overflow-hidden"
                        >
                          {/* 一级模块 */}
                          <button
                            onClick={() => toggleModule(module.name)}
                            className={cn(
                              'w-full flex items-center justify-between p-4 text-left transition-colors',
                              module.enabled ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-60',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <CheckCircle
                                className={cn(
                                  'w-5 h-5',
                                  module.enabled ? 'text-primary' : 'text-muted-foreground',
                                )}
                              />
                              <span
                                className={cn(
                                  'font-medium',
                                  module.enabled ? 'text-foreground' : 'text-muted-foreground',
                                )}
                              >
                                {t(module.name)}
                              </span>
                              {!module.enabled && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('未开通')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {module.subModules.filter((s) => s.enabled).length}/
                                {t('{count} 个功能', { count: module.subModules.length })}
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
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                                {module.subModules.map((subModule) => (
                                  <div
                                    key={t(subModule.name)}
                                    className={cn(
                                      'flex items-center gap-2 p-2.5 rounded-md border text-sm',
                                      subModule.enabled
                                        ? 'border-primary/30 bg-white'
                                        : 'border-gray-200 bg-gray-100/50 opacity-60',
                                    )}
                                  >
                                    <CheckCircle
                                      className={cn(
                                        'w-3.5 h-3.5 shrink-0',
                                        subModule.enabled
                                          ? 'text-primary'
                                          : 'text-muted-foreground',
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'truncate',
                                        subModule.enabled
                                          ? 'text-foreground'
                                          : 'text-muted-foreground',
                                      )}
                                    >
                                      {t(subModule.name)}
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
        ) : undefined
      }
    />
  )
}
