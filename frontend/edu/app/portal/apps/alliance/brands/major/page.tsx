'use client'

import { useMemo, useState } from 'react'
import { TableCell, TableHead } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi, portalRequest } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceBrand } from '@/lib/types'
import type { Major } from '@/lib/types/backend'

const brandType = 'major'

export default function AllianceMajorBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const brandLabel = t('专业品牌')
  const brandDesc = t('专业来自系统专业库，仅可开启前台展示，无法在此新增专业')

  const [togglingId, setTogglingId] = useState('')

  const { data: majors, loading: majorsLoading, error: majorsError } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await portalRequest<{ items: Major[] }>('/majors?limit=500')
      return res.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const { data: brands, loading: brandsLoading, refresh, error: brandsError } = useAsync(
    async () => {
      if (!tenantId) return []
      const data = await allianceBrandApi.list({ brandType, limit: 200 })
      return data.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const brandByMajor = useMemo(() => {
    const map = new Map<string, AllianceBrand>()
    for (const b of brands ?? []) if (b.majorId) map.set(b.majorId, b)
    return map
  }, [brands])

  const rows = useMemo(
    () =>
      (majors ?? []).map((m) => ({
        major: m,
        brand: brandByMajor.get(m.id),
      })),
    [majors, brandByMajor],
  )

  const togglePublic = async (row: { major: Major; brand?: AllianceBrand }, value: boolean) => {
    setTogglingId(row.major.id)
    try {
      if (row.brand) {
        await allianceBrandApi.update(row.brand.id, { isPublic: value } as any)
      } else {
        await allianceBrandApi.create({
          brandType,
          name: row.major.name,
          majorId: row.major.id,
          isPublic: value,
        } as any)
      }
      toast({ title: value ? t('已开启前台展示') : t('已关闭前台展示') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    } finally {
      setTogglingId('')
    }
  }

  const loading = majorsLoading || brandsLoading

  return (
    <PortalCrudPage
      title={t('{brandLabel}管理', { brandLabel })}
      description={t(
        '{desc} · 共 {count} 个专业，已启用 {enabled} 个',
        {
          desc: brandDesc,
          count: rows.length,
          enabled: rows.filter((r) => r.brand?.isPublic).length,
        },
      )}
      entityLabel={brandLabel}
      searchPlaceholder={t('搜索专业名称...')}
      items={rows}
      loading={loading}
      error={majorsError?.message ?? brandsError?.message ?? null}
      onRetry={refresh}
      filterItems={(filtered, search) =>
        filtered.filter(
          (row: any) => !search || row.major.name.toLowerCase().includes(search.toLowerCase()),
        )
      }
      hideCreate
      importConfig={{
        importType: 'alliance-brands',
        entityLabel: brandLabel,
        templateFileName: t('专业品牌批量导入模板.xlsx'),
        extraQuery: { brandType: 'major' },
      }}
      colSpan={5}
      renderTableHeader={() => (
        <>
          <TableHead>{t('专业名称')}</TableHead>
          <TableHead>{t('前台展示')}</TableHead>
          <TableHead>{t('专业代码')}</TableHead>
          <TableHead>{t('品牌管理')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(row: any) => (
        <>
          <TableCell className="font-medium">{row.major.name}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!row.brand?.isPublic}
                disabled={togglingId === row.major.id}
                onCheckedChange={(v) => togglePublic(row, v)}
              />
              {togglingId === row.major.id && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground">{row.major.code || '-'}</TableCell>
          <TableCell>
            {row.brand ? (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                {t('已创建品牌')}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{t('未创建品牌')}</span>
            )}
          </TableCell>
          <TableRowActions>
            {row.brand ? (
              <Link to={`/portal/apps/alliance/brands/${row.brand.id}`}>
                <span className="inline-flex items-center text-sm text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  {t('管理品牌内容')}
                </span>
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">{t('开启展示后创建')}</span>
            )}
          </TableRowActions>
        </>
      )}
      getDeleteDescription={() => <></>}
    />
  )
}
