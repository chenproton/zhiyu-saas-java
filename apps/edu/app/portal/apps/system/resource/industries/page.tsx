'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Trash2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { industryApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { useT } from '@/lib/i18n/locale-provider'
import type { Industry } from '@/lib/types/backend'

export default function IndustriesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await industryApi.list({ tenantId, limit: 1000 })
      return res.items
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const industries = useMemo(() => data ?? [], [data])

  const parentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const ind of industries) {
      if (ind.parentId) {
        const parent = industries.find((i) => i.id === ind.parentId)
        map.set(ind.parentId, parent?.name ?? ind.parentId)
      }
    }
    return map
  }, [industries])

  const candidateParents = useMemo(() => industries, [industries])

  return (
    <PortalCrudPage
      title={t('行业管理')}
      description={t('管理行业分类，可为行业设置上级行业并启用/关闭')}
      entityLabel={t('行业')}
      searchPlaceholder={t('搜索行业代码、名称或上级行业...')}
      hideCreate
      items={industries}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, searchTerm) =>
        items.filter((ind) => {
          if (!searchTerm) return true
          const parentName = ind.parentId ? parentMap.get(ind.parentId) : ''
          return (
            ind.name.includes(searchTerm) ||
            ind.code.includes(searchTerm) ||
            (parentName ?? '').includes(searchTerm)
          )
        })
      }
      importConfig={{
        importType: 'industries',
        entityLabel: t('行业'),
        templateFileName: t('行业批量导入模板.xlsx'),
      }}
      colSpan={7}
      renderTableHeader={() => (
        <>
          <TableHead className="w-28">{t('行业代码')}</TableHead>
          <TableHead>{t('行业名称')}</TableHead>
          <TableHead>{t('上级行业')}</TableHead>
          <TableHead className="w-20 text-center">{t('排序')}</TableHead>
          <TableHead className="w-24 text-center">{t('状态')}</TableHead>
          <TableHead className="w-24 text-center">{t('启用/关闭')}</TableHead>
          <TableHead className="w-20 text-center">{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(industry, actions) => (
        <>
          <TableCell className="font-mono text-sm">{industry.code}</TableCell>
          <TableCell className="font-medium">{industry.name}</TableCell>
          <TableCell className="text-muted-foreground">
            {industry.parentId ? (
              (parentMap.get(industry.parentId) ?? industry.parentId)
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </TableCell>
          <TableCell className="text-center text-sm text-muted-foreground">
            {industry.sortOrder}
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={industry.enabled ? 'default' : 'secondary'}>
              {t(industry.enabled ? '已启用' : '已关闭')}
            </Badge>
          </TableCell>
          <TableCell className="text-center">
            <Switch checked={industry.enabled} onCheckedChange={actions.toggle} />
          </TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.edit}>
              <Pencil className="mr-1 h-3 w-3" />
              {t('编辑')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
              onClick={actions.delete}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              {t('删除')}
            </Button>
          </TableRowActions>
        </>
      )}
      createDefault={() =>
        ({ id: '', code: '', name: '', parentId: '', sortOrder: 0, enabled: true }) as Industry
      }
      renderForm={(item, setItem) => {
        const set = (patch: Partial<Industry>) => setItem({ ...item, ...patch })
        return (
          <>
            <FormFieldRow label={t('行业代码')} required>
              <Input
                placeholder={t('如：IT')}
                value={item.code}
                onChange={(e) => set({ code: e.target.value })}
                disabled={!!item.id}
              />
            </FormFieldRow>
            <FormFieldRow label={t('行业名称')} required>
              <Input
                placeholder={t('如：信息技术')}
                value={item.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('上级行业')}>
              <Select
                value={item.parentId || '__none__'}
                onValueChange={(val) => set({ parentId: val === '__none__' ? '' : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('无（顶级行业）')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('无（顶级行业）')}</SelectItem>
                  {candidateParents
                    .filter((i) => i.id !== item.id)
                    .map((ind) => (
                      <SelectItem key={ind.id} value={ind.id}>
                        {ind.name} ({ind.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label={t('排序')}>
              <Input
                type="number"
                placeholder="0"
                value={item.sortOrder}
                onChange={(e) => set({ sortOrder: Number(e.target.value) || 0 })}
              />
            </FormFieldRow>
          </>
        )
      }}
      getDeleteDescription={(item) => (
        <>{t('确定要删除行业「{name}」（{code}）吗？此操作不可撤销。', { name: item.name, code: item.code })}</>
      )}
      onSave={async (item, isEdit) => {
        if (!tenantId) {
          toast({ variant: 'destructive', title: t('保存失败'), description: t('未获取到租户信息') })
          return
        }
        if (!item.code.trim() || !item.name.trim()) return
        if (isEdit) {
          await industryApi.update(item.id, {
            code: item.code.trim(),
            name: item.name.trim(),
            parentId: item.parentId || undefined,
            enabled: item.enabled,
            sortOrder: item.sortOrder,
          })
          toast({ title: t('保存成功'), description: t('行业信息已更新') })
        } else {
          await industryApi.create({
            tenantId,
            code: item.code.trim(),
            name: item.name.trim(),
            parentId: item.parentId || undefined,
            enabled: true,
            sortOrder: item.sortOrder,
          })
          toast({ title: t('创建成功'), description: t('新行业已添加') })
        }
      }}
      onDelete={async (item) => {
        await industryApi.delete(item.id)
      }}
      onToggleEnabled={async (item) => {
        await industryApi.update(item.id, {
          code: item.code,
          name: item.name,
          parentId: item.parentId || undefined,
          enabled: !item.enabled,
          sortOrder: item.sortOrder,
        })
        toast({ title: t(!item.enabled ? '已启用' : '已关闭') })
      }}
    />
  )
}
