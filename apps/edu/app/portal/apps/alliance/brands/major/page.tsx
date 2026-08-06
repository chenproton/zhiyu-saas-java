'use client'

import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { StatusBadge } from '@/components/shared/status-badge'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { BrandRelationSelect } from '@/components/shared/brand-relation-select'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceBrand } from '@/lib/types'

const brandType = 'major'

export default function AllianceMajorBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const brandLabel = t('专业品牌')
  const brandDesc = t('管理专业建设水平与培养特色')
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const data = await allianceBrandApi.list({ brandType })
      return data.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const items = data ?? []

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
      colSpan={6}
      renderTableHeader={() => (
        <>
          <TableHead>{t('名称')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('推荐')}</TableHead>
          <TableHead>{t('公开')}</TableHead>
          <TableHead>{t('浏览')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => (
        <>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>
            <StatusBadge status={item.status} />
          </TableCell>
          <TableCell>{item.isFeatured ? t('是') : t('否')}</TableCell>
          <TableCell>{item.isPublic ? t('是') : t('否')}</TableCell>
          <TableCell>{item.viewCount}</TableCell>
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
          status: 'draft',
          description: '',
          coverImage: '',
          isPublic: false as any,
          isFeatured: false as any,
          viewCount: 0,
          enabled: true as any,
          createdAt: '',
          updatedAt: '',
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
          <FormFieldRow label={t('状态')}>
            <Select
              value={item.status || 'draft'}
              onValueChange={(v: any) => setItem({ ...item, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t('草稿')}</SelectItem>
                <SelectItem value="published">{t('已发布')}</SelectItem>
                <SelectItem value="archived">{t('已归档')}</SelectItem>
              </SelectContent>
            </Select>
          </FormFieldRow>
          <FormFieldRow label={t('描述')}>
            <Textarea
              value={item.description || ''}
              onChange={(e: any) => setItem({ ...item, description: e.target.value })}
              rows={3}
            />
          </FormFieldRow>
          <FormFieldRow label={t('封面图 URL')}>
            <Input
              value={item.coverImage || ''}
              onChange={(e: any) => setItem({ ...item, coverImage: e.target.value })}
              placeholder="https://..."
            />
          </FormFieldRow>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={item.isPublic || false}
                onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })}
              />
              <Label>{t('公开显示')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={item.isFeatured || false}
                onCheckedChange={(v: any) => setItem({ ...item, isFeatured: v })}
              />
              <Label>{t('推荐')}</Label>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t('专业 ID')}</Label>
            <BrandRelationSelect
              label={t('关联专业')}
              value={item.majorId || ''}
              onChange={(v: any) => setItem({ ...item, majorId: v })}
              fetchUrl="/majors?limit=200"
            />
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
