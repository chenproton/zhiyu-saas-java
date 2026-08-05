'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Pencil, Trash2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { majorApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import type { Major } from '@/lib/types/backend'

export default function MajorsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await majorApi.list({ tenantId, limit: 1000 })
      return res.items
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const majors = data ?? []

  return (
    <PortalCrudPage
      title="专业管理"
      description="管理教育专业，可为专业配置别名并启用/关闭"
      entityLabel="专业"
      searchPlaceholder="搜索专业代码、名称或别名..."
      createButtonLabel="新增专业"
      items={majors}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, searchTerm) =>
        items.filter(
          (major) =>
            major.name.includes(searchTerm) ||
            major.code.includes(searchTerm) ||
            (major.alias ?? '').includes(searchTerm),
        )
      }
      importConfig={{
        importType: 'majors',
        entityLabel: '专业',
        templateFileName: '专业批量导入模板.xlsx',
      }}
      colSpan={6}
      renderTableHeader={() => (
        <>
          <TableHead className="w-28">专业代码</TableHead>
          <TableHead>专业名称</TableHead>
          <TableHead>别名（备注）</TableHead>
          <TableHead className="w-24 text-center">状态</TableHead>
          <TableHead className="w-24 text-center">启用/关闭</TableHead>
          <TableHead className="w-20 text-center">操作</TableHead>
        </>
      )}
      renderTableRow={(major, actions) => (
        <>
          <TableCell className="font-mono text-sm">{major.code}</TableCell>
          <TableCell className="font-medium">{major.name}</TableCell>
          <TableCell className="text-muted-foreground">
            {major.alias || <span className="text-gray-300">-</span>}
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={major.enabled ? 'default' : 'secondary'}>
              {major.enabled ? '已启用' : '已关闭'}
            </Badge>
          </TableCell>
          <TableCell className="text-center">
            <Switch checked={major.enabled} onCheckedChange={actions.toggle} />
          </TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.edit}>
              <Pencil className="mr-1 h-3 w-3" />
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
              onClick={actions.delete}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              删除
            </Button>
          </TableRowActions>
        </>
      )}
      createDefault={() => ({ id: '', code: '', name: '', alias: '', enabled: true }) as Major}
      renderForm={(item, setItem) => {
        const set = (patch: Partial<Major>) => setItem({ ...item, ...patch })
        return (
          <>
            <FormFieldRow label="专业代码" required>
              <Input
                placeholder="如：CS101"
                value={item.code}
                onChange={(e) => set({ code: e.target.value })}
                disabled={!!item.id}
              />
            </FormFieldRow>
            <FormFieldRow label="专业名称" required>
              <Input
                placeholder="如：计算机科学与技术"
                value={item.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label="别名（备注）">
              <Input
                placeholder="输入专业别名或备注"
                value={item.alias || ''}
                onChange={(e) => set({ alias: e.target.value })}
              />
            </FormFieldRow>
          </>
        )
      }}
      getDeleteDescription={(item) => (
        <>
          确定要删除专业 <span className="font-medium">{item.name}</span>（{item.code}
          ）吗？此操作不可撤销。
        </>
      )}
      onSave={async (item, isEdit) => {
        if (!tenantId) {
          toast({ variant: 'destructive', title: '保存失败', description: '未获取到租户信息' })
          return
        }
        if (!item.code.trim() || !item.name.trim()) return
        if (isEdit) {
          await majorApi.update(item.id, {
            code: item.code.trim(),
            name: item.name.trim(),
            alias: item.alias?.trim() || undefined,
            enabled: item.enabled,
          })
          toast({ title: '保存成功', description: '专业信息已更新' })
        } else {
          await majorApi.create({
            tenantId,
            code: item.code.trim(),
            name: item.name.trim(),
            alias: item.alias?.trim() || undefined,
            enabled: true,
          })
          toast({ title: '创建成功', description: '新专业已添加' })
        }
      }}
      onDelete={async (item) => {
        await majorApi.delete(item.id)
      }}
      onToggleEnabled={async (item) => {
        await majorApi.update(item.id, {
          code: item.code,
          name: item.name,
          alias: item.alias || undefined,
          enabled: !item.enabled,
        })
        toast({ title: !item.enabled ? '已启用' : '已关闭' })
      }}
    />
  )
}
