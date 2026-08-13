'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, ExternalLink, Link2, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi, portalRequest } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { useT } from '@/lib/i18n/locale-provider'
import {
  JobBrandRefDialog,
  JobBrandEditDialog,
  salaryText,
  positionTypeLabel,
} from '@/components/alliance/job-brand-dialogs'
import type { JobBrand } from '@/lib/types'

const brandType = 'job'

export default function AllianceJobBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const brandLabel = t('岗位品牌')
  const brandDesc = t('引用职业岗位库或新增独立岗位，维护岗位品牌展示')

  const [refOpen, setRefOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<JobBrand | null>(null)

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const data = await allianceBrandApi.list({ brandType, limit: 200 })
      return data.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const items = useMemo(() => (data ?? []) as JobBrand[], [data])

  const toggleBrandField = async (item: JobBrand, field: 'isPublic' | 'isFeatured', value: boolean) => {
    try {
      await allianceBrandApi.update(item.id, { [field]: value } as any)
      toast({ title: t('已更新') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('更新失败'), description: e.message, variant: 'destructive' })
    }
  }

  const onDeleteBrand = async (item: JobBrand) => {
    // 企业岗位为品牌模块私有岗位（/job/positions 不可见），删除品牌时一并删除岗位；
    // 岗位删除失败则中止品牌删除，避免留下孤儿岗位
    if (item.positionType === 'enterprise' && item.positionId) {
      await portalRequest(`/job/positions/${item.positionId}`, { method: 'DELETE' })
    }
    await allianceBrandApi.delete(item.id)
    toast({ title: t('品牌已删除') })
  }

  return (
    <>
      <PortalCrudPage
        title={t('{brandLabel}管理', { brandLabel })}
        description={brandDesc}
        entityLabel={brandLabel}
        searchPlaceholder={t('搜索岗位名称...')}
        items={items}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refresh}
        filterItems={(filtered, search) =>
          filtered.filter(
            (b: JobBrand) =>
              !search ||
              (b.name || b.positionName || '').toLowerCase().includes(search.toLowerCase()),
          )
        }
        headerActions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditTarget({} as JobBrand)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('新增独立岗位')}
            </Button>
            <Button size="sm" onClick={() => setRefOpen(true)}>
              <Link2 className="h-4 w-4 mr-1" />
              {t('引用职业岗位库')}
            </Button>
          </div>
        }
        importConfig={{
          importType: 'alliance-brands',
          entityLabel: brandLabel,
          templateFileName: t('岗位品牌批量导入模板.xlsx'),
          extraQuery: { brandType: 'job' },
        }}
        hideCreate
        colSpan={7}
        renderTableHeader={() => (
          <>
            <TableHead>{t('岗位名称')}</TableHead>
            <TableHead>{t('前台展示')}</TableHead>
            <TableHead>{t('推荐')}</TableHead>
            <TableHead>{t('类型')}</TableHead>
            <TableHead>{t('薪资范围')}</TableHead>
            <TableHead>{t('面向专业')}</TableHead>
            <TableHead>{t('操作')}</TableHead>
          </>
        )}
        renderTableRow={(item: JobBrand, actions: any) => {
          const isTeaching = item.positionType === 'teaching'
          return (
            <>
              <TableCell className="font-medium">
                {item.name || item.positionName || '-'}
              </TableCell>
              <TableCell>
                <Switch
                  checked={item.isPublic}
                  onCheckedChange={(v) => toggleBrandField(item, 'isPublic', v)}
                />
              </TableCell>
              <TableCell>
                <Switch
                  checked={item.isFeatured}
                  onCheckedChange={(v) => toggleBrandField(item, 'isFeatured', v)}
                />
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                    isTeaching ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {positionTypeLabel(item.positionType, t)}
                </span>
              </TableCell>
              <TableCell>{salaryText(item)}</TableCell>
              <TableCell className="max-w-56 truncate">
                {item.majorNames?.join('、') || '-'}
              </TableCell>
              <TableRowActions>
                <Link href={`/portal/apps/alliance/brands/${item.id}`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    {t('查看')}
                  </Button>
                </Link>
                {!isTeaching && item.positionId && (
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget(item)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {t('编辑')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={actions.delete}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t('删除')}
                </Button>
              </TableRowActions>
            </>
          )
        }}
        getDeleteDescription={(item: any) => (
          <>{t('确定要删除岗位品牌「{name}」吗？', { name: item.name })}</>
        )}
        onDelete={async (item: any) => {
          await onDeleteBrand(item)
        }}
      />

      <JobBrandRefDialog
        tenantId={tenantId}
        items={items}
        onSaved={refresh}
        open={refOpen}
        onOpenChange={setRefOpen}
      />
      <JobBrandEditDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={refresh}
      />
    </>
  )
}
