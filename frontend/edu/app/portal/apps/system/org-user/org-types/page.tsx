'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableHead } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Pencil, Trash2, Upload, Download } from 'lucide-react'
import { orgTypeApi } from '@/lib/api'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import type { OrgType } from '@/lib/types/backend'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useToast, useAsync } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

const categoryLabels = { internal: '内部组织', business: '业务组织', external: '外部协作组织' }
const categoryColors = {
  internal: 'bg-blue-100 text-blue-700',
  business: 'bg-green-100 text-green-700',
  external: 'bg-orange-100 text-orange-700',
}

export default function OrgTypesPage() {
  const t = useT()
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')

  const {
    data: orgTypes,
    loading: isLoading,
    error,
    refresh,
  } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await orgTypeApi.list({ tenantId, limit: 1000 })
      return res.items
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const handleSave = async (item: OrgType, isEdit: boolean) => {
    if (!tenantId) return
    if (isEdit) {
      const updated = await orgTypeApi.update(item.id, {
        name: item.name.trim(),
        category: item.category,
        tenantId,
      })
      toast({ title: t('保存成功'), description: t('「{name}」已更新', { name: updated.name }) })
    } else {
      const created = await orgTypeApi.create({
        name: item.name.trim(),
        category: item.category,
        tenantId,
      })
      toast({ title: t('创建成功'), description: t('「{name}」已添加', { name: created.name }) })
    }
  }

  const handleDelete = async (item: OrgType) => {
    await orgTypeApi.delete(item.id)
  }

  return (
    <PortalCrudPage
      title={t('组织类型管理')}
      description={t('管理组织架构中的节点类型')}
      entityLabel={t('组织类型')}
      items={orgTypes ?? []}
      loading={isLoading}
      error={error?.message ?? null}
      onRetry={refresh}
      colSpan={4}
      searchPlaceholder={t('搜索类型名称...')}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filterItems={(items, search) => items.filter((item) => !search || item.name.includes(search))}
      hideImport
      headerActions={
        <>
          <Button variant="outline" size="sm" disabled title={t('即将上线')}>
            <Download className="h-4 w-4 mr-1" />
            {t('批量导出')}
          </Button>
          <Button variant="outline" size="sm" disabled title={t('即将上线')}>
            <Upload className="h-4 w-4 mr-1" />
            {t('批量导入')}
          </Button>
        </>
      }
      createButtonLabel={t('新建类型')}
      createDefault={() =>
        ({
          id: '',
          tenantId: '',
          name: '',
          category: 'internal',
          createdAt: '',
        }) as OrgType
      }
      renderForm={(item, setItem) => (
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('类型名称')}</label>
            <Input
              placeholder={t('如：二级学院')}
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('类型分类')}</label>
            <Select
              value={item.category}
              onValueChange={(v) => setItem({ ...item, category: v as OrgType['category'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">{t('内部组织')}</SelectItem>
                <SelectItem value="business">{t('业务组织')}</SelectItem>
                <SelectItem value="external">{t('外部协作组织')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      onSave={handleSave}
      renderTableHeader={() => (
        <>
          <TableHead>{t('类型名称')}</TableHead>
          <TableHead>{t('类型分类')}</TableHead>
          <TableHead>{t('创建时间')}</TableHead>
          <TableHead className="text-right">{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(type, actions) => (
        <>
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              {type.name}
              {type.isDefault && (
                <Badge variant="outline" className="text-xs">
                  {t('系统默认')}
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Badge className={categoryColors[type.category]}>
              {t(categoryLabels[type.category])}
            </Badge>
          </TableCell>
          <TableCell className="text-muted-foreground">{type.createdAt}</TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.edit}>
              <Pencil className="mr-1 h-3 w-3" />
              {t('编辑')}
            </Button>
            {!type.isDefault ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={actions.delete}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                {t('删除')}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled>
                <Trash2 className="mr-1 h-3 w-3" />
                {t('系统默认类型不可删除')}
              </Button>
            )}
          </TableRowActions>
        </>
      )}
      getDeleteDescription={(type) => (
        <>
          {t('确定删除组织类型「{name}」吗？如果该类型仍被组织使用，删除可能会失败。', {
            name: type.name,
          })}
        </>
      )}
      onDelete={handleDelete}
      emptyContent={
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyTitle>{t('暂无组织类型')}</EmptyTitle>
            <EmptyDescription>
              {searchTerm ? t('未找到匹配的组织类型') : t('当前租户下尚未创建组织类型')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  )
}
