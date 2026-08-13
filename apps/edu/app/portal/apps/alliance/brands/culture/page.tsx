'use client'

import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { SingleImageUpload } from '@/components/shared/image-list-upload'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceBrand } from '@/lib/types'

const brandType = 'culture'

export default function AllianceCultureBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const brandLabel = t('文化思政品牌')
  const brandDesc = t('管理典型案例、思政资源与文化活动')
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const data = await allianceBrandApi.list({ brandType })
      return data.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const items = data ?? []

  const toggleBrandField = async (item: any, field: 'isPublic' | 'isFeatured', value: boolean) => {
    try {
      await allianceBrandApi.update(item.id, { [field]: value } as any)
      toast({ title: t('已更新') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('更新失败'), description: e.message, variant: 'destructive' })
    }
  }

  return (
    <PortalCrudPage
      title={t('{brandLabel}管理', { brandLabel })}
      description={brandDesc}
      entityLabel={brandLabel}
      searchPlaceholder={t('搜索品牌名称...')}
      createButtonLabel={t('新建品牌')}
      items={items}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(filtered, search) =>
        filtered.filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()))
      }
      importConfig={{
        importType: 'alliance-brands',
        entityLabel: t('品牌内容'),
        templateFileName: t('品牌内容批量导入模板.xlsx'),
      }}
      colSpan={5}
      renderTableHeader={() => (
        <>
          <TableHead>{t('名称')}</TableHead>
          <TableHead>{t('前台展示')}</TableHead>
          <TableHead>{t('推荐')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => (
        <>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>
            <Switch
              checked={item.isPublic || false}
              onCheckedChange={(v: any) => toggleBrandField(item, 'isPublic', v)}
            />
          </TableCell>
          <TableCell>
            <Switch
              checked={item.isFeatured || false}
              onCheckedChange={(v: any) => toggleBrandField(item, 'isFeatured', v)}
            />
          </TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/brands/${item.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {t('查看')}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={actions.edit}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {t('编辑')}
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t('删除')}
            </Button>
          </TableRowActions>
        </>
      )}
      createDefault={() =>
        ({
          id: '',
          name: '',
          brandType: brandType as any,
          description: '',
          coverImage: '',
          isPublic: false as any,
          isFeatured: false as any,
          viewCount: 0,
          enabled: true as any,
        }) as AllianceBrand & { enabled?: boolean }
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <FormFieldRow label={t('名称')} required>
            <Input
              value={item.name || ''}
              onChange={(e: any) => setItem({ ...item, name: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label={t('描述')}>
            <Textarea
              value={item.description || ''}
              onChange={(e: any) => setItem({ ...item, description: e.target.value })}
              rows={3}
            />
          </FormFieldRow>
          <FormFieldRow label={t('封面图')}>
            <SingleImageUpload
              label={t('封面图')}
              value={item.coverImage || ''}
              onChange={(v: any) => setItem({ ...item, coverImage: v })}
              allowUrlInput={false}
            />
          </FormFieldRow>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={item.isPublic || false}
                onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })}
              />
              <Label>{t('前台展示')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={item.isFeatured || false}
                onCheckedChange={(v: any) => setItem({ ...item, isFeatured: v })}
              />
              <Label>{t('推荐')}</Label>
            </div>
          </div>
        </div>
      )}
      getDeleteDescription={(item: any) => (
        <>{t('确定要删除品牌「{name}」吗？', { name: item.name })}</>
      )}
      onSave={async (item: any, isEdit: boolean) => {
        item.brandType = brandType
        if (isEdit) {
          await allianceBrandApi.update(item.id, item)
        } else {
          await allianceBrandApi.create(item)
        }
        toast({ title: t('品牌已{action}', { action: isEdit ? t('更新') : t('创建') }) })
        await refresh()
      }}
      onDelete={async (item: any) => {
        await allianceBrandApi.delete(item.id)
        toast({ title: t('品牌已删除') })
        await refresh()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
