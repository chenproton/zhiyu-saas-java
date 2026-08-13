'use client'

import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { UserSelector } from '@/components/shared/user-selector'
import { MajorSelect } from '@/components/shared/major-select'
import { SingleImageUpload } from '@/components/shared/image-list-upload'
import { TalentRankingPanel } from '@/components/alliance/talent-ranking-panel'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceBrand } from '@/lib/types'

const brandType = 'talent'

export default function AllianceTalentBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const brandLabel = t('人才品牌')
  const brandDesc = t('管理学生能力画像排名与典型就业案例')
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
    <div className="min-h-full">
      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="ranking" className="rounded-lg">
            {t('人才画像排名')}
          </TabsTrigger>
          <TabsTrigger value="cases" className="rounded-lg">
            {t('就业案例')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ranking">
          <TalentRankingPanel tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="cases">
          <PortalCrudPage
            title={t('{brandLabel}管理', { brandLabel })}
            description={brandDesc}
            entityLabel={brandLabel}
            searchPlaceholder={t('搜索品牌名称...')}
            createButtonLabel={t('新建就业案例')}
            items={items}
            loading={loading}
            error={error?.message ?? null}
            onRetry={refresh}
            filterItems={(filtered, search) =>
              filtered.filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()))
            }
            importConfig={{
              importType: 'alliance-brands',
              entityLabel: t('就业案例'),
              templateFileName: t('人才品牌批量导入模板.xlsx'),
              extraQuery: { brandType: 'talent' },
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
                <FormFieldRow label={t('案例名称')} required>
                  <Input
                    value={item.name || ''}
                    onChange={(e: any) => setItem({ ...item, name: e.target.value })}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('描述')}>
                  <Textarea
                    value={item.description || ''}
                    onChange={(e: any) => setItem({ ...item, description: e.target.value })}
                    rows={8}
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
                <FormFieldRow label={t('关联学生')}>
                  <UserSelector
                    multiple={false}
                    excludeStudent={false}
                    onlyRoleCode="student"
                    tenantId={tenantId}
                    placeholder={t('选择学生')}
                    value={item.studentId ? [item.studentId] : []}
                    onChange={(ids: string[]) =>
                      setItem({ ...item, studentId: ids[0] || '' })
                    }
                  />
                </FormFieldRow>
                <FormFieldRow label={t('关联专业')}>
                  <MajorSelect
                    tenantId={tenantId}
                    value={item.majorId || ''}
                    onChange={(v) => setItem({ ...item, majorId: v || '' })}
                    placeholder={t('选择专业')}
                  />
                </FormFieldRow>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
