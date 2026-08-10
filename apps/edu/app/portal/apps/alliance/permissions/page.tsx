'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Building2, Save, Briefcase, Workflow } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceEnterpriseApi, allianceGrantApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceGrantResourceOption } from '@/lib/api'
import type { AllianceEnterprise } from '@/lib/types'

type GrantOption = AllianceGrantResourceOption

export default function AlliancePermissionsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()

  const { data: enterprises, loading: entLoading } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEnterpriseApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const [enterpriseId, setEnterpriseId] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  // 选中企业后加载：授权现状 + 资源候选
  const { data, refresh } = useAsync(
    async () => {
      if (!tenantId || !enterpriseId)
        return { options: [] as GrantOption[], granted: new Set<string>() }
      const [optRes, grantRes] = await Promise.all([
        allianceGrantApi.resourceOptions(enterpriseId),
        allianceGrantApi.list(enterpriseId),
      ])
      const granted = new Set<string>()
      grantRes.grants.forEach((g) => g.resourceIds.forEach((id) => granted.add(id)))
      return { options: optRes.items || [], granted }
    },
    { deps: [tenantId, enterpriseId, authLoading], onError: () => true },
  )

  const options = data?.options ?? []
  const granted = data?.granted ?? new Set<string>()

  const selectEnterprise = (id: string) => {
    setEnterpriseId(id)
    setChecked({})
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('合作权限管理')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            '为企业授予岗位/场景的编辑权限：授权后企业专家可登录企业服务台查看并编辑这些资源（编辑稿需学校审批后生效）。',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-primary" />
            {t('选择企业')}
          </CardTitle>
          <CardDescription className="text-xs">{t('仅可对本校已引入的企业授权')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Select value={enterpriseId} onValueChange={selectEnterprise} disabled={entLoading}>
              <SelectTrigger>
                <SelectValue placeholder={t('请选择企业')} />
              </SelectTrigger>
              <SelectContent>
                {(enterprises ?? []).map((e: AllianceEnterprise) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {enterpriseId && options.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('该企业暂无共建资源，本校也暂无可授权资源')}
          </CardContent>
        </Card>
      )}

      {enterpriseId && options.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Save className="h-4 w-4 text-primary" />
              {t('资源授权')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('勾选要授权的岗位/场景（含该企业共建的与本校自建的），授权后企业内专家可编辑')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(['position', 'scene'] as const).map((type) => {
                const typeOptions = options.filter((o) => o.type === type)
                if (typeOptions.length === 0) return null
                const allChecked = typeOptions.every((o) => checked[o.id] || granted.has(o.id))
                return (
                  <div key={type} className="rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        {type === 'position' ? (
                          <Briefcase className="h-4 w-4 text-primary" />
                        ) : (
                          <Workflow className="h-4 w-4 text-primary" />
                        )}
                        <h3 className="text-sm font-semibold">
                          {t(type === 'position' ? '岗位' : '场景')}
                        </h3>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          checked={allChecked}
                          onChange={(e) => {
                            setChecked((prev) => {
                              const next = { ...prev }
                              typeOptions.forEach((o) => {
                                next[o.id] = e.target.checked
                              })
                              return next
                            })
                          }}
                        />
                        {t('全选')}
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                      {typeOptions.map((o) => (
                        <label
                          key={o.id}
                          className="flex items-start gap-2 rounded-lg border border-gray-100 p-2.5 cursor-pointer hover:bg-muted/40"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            checked={!!checked[o.id] || granted.has(o.id)}
                            onChange={(e) =>
                              setChecked((prev) => ({ ...prev, [o.id]: e.target.checked }))
                            }
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{o.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {o.source === 'enterprise' ? t('该企业共建') : t('本校自建')}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setChecked({})
                    await refresh()
                  }}
                >
                  {t('刷新')}
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      for (const type of ['position', 'scene'] as const) {
                        const ids = options
                          .filter((o) => o.type === type && checked[o.id])
                          .map((o) => o.id)
                        await allianceGrantApi.save({
                          enterpriseId,
                          resourceType: type,
                          resourceIds: ids,
                        })
                      }
                      toast({ title: t('授权已保存') })
                      setChecked({})
                      await refresh()
                    } catch (e: any) {
                      toast({
                        title: t('保存失败'),
                        description: e.message,
                        variant: 'destructive',
                      })
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {t('保存授权')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
