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
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { alliancePermissionApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { BrandRelationSelect } from '@/components/shared/brand-relation-select'
import type { AlliancePermission } from '@/lib/types'

export default function AlliancePermissionsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const data = await alliancePermissionApi.list()
      return data.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const items = data ?? []

  return (
    <PortalCrudPage
      title="合作权限管理"
      description="管理合作企业/专家的账号权限授权"
      entityLabel="权限授权"
      searchPlaceholder="搜索账号名称..."
      createButtonLabel="新增授权"
      items={items}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(filtered, search) =>
        filtered.filter(
          (p) => !search || p.accountName.toLowerCase().includes(search.toLowerCase()),
        )
      }
      importConfig={{
        importType: 'alliance-permissions',
        entityLabel: '合作权限',
        templateFileName: '合作权限批量导入模板.xlsx',
      }}
      colSpan={5}
      renderTableHeader={() => (
        <>
          <TableHead>账号名称</TableHead>
          <TableHead>账号类型</TableHead>
          <TableHead>所属主体</TableHead>
          <TableHead>启用</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => (
        <>
          <TableCell className="font-medium">{item.accountName}</TableCell>
          <TableCell>{item.accountType === 'enterprise' ? '企业账号' : '专家账号'}</TableCell>
          <TableCell>
            {item.accountType === 'enterprise'
              ? item.enterpriseId
                ? '企业'
                : '-'
              : item.expertId
                ? '专家'
                : '-'}
          </TableCell>
          <TableCell>{item.isEnabled ? '是' : '否'}</TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" onClick={actions.edit}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              编辑
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              删除
            </Button>
          </TableRowActions>
        </>
      )}
      createDefault={() =>
        ({
          id: '',
          accountName: '',
          accountType: 'enterprise',
          isEnabled: true as any,
          enabled: true as any,
          createdAt: '',
          updatedAt: '',
        }) as AlliancePermission & { enabled?: boolean }
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <FormFieldRow label="账号名称" required>
            <Input
              value={item.accountName || ''}
              onChange={(e: any) => setItem({ ...item, accountName: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label="账号类型">
            <Select
              value={item.accountType || 'enterprise'}
              onValueChange={(v: any) => setItem({ ...item, accountType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enterprise">企业账号</SelectItem>
                <SelectItem value="expert">专家账号</SelectItem>
              </SelectContent>
            </Select>
          </FormFieldRow>
          {item.accountType === 'enterprise' ? (
            <BrandRelationSelect
              label="所属企业"
              value={item.enterpriseId || ''}
              onChange={(v: any) => setItem({ ...item, enterpriseId: v, expertId: '' })}
              fetchUrl="/alliance/enterprises?limit=200"
            />
          ) : (
            <BrandRelationSelect
              label="所属专家"
              value={item.expertId || ''}
              onChange={(v: any) => setItem({ ...item, expertId: v, enterpriseId: '' })}
              fetchUrl="/alliance/experts?limit=200"
            />
          )}
          <div className="flex items-center gap-2">
            <Switch
              checked={item.isEnabled ?? true}
              onCheckedChange={(v: any) => setItem({ ...item, isEnabled: v })}
            />
            <Label>启用</Label>
          </div>
        </div>
      )}
      getDeleteDescription={(item: any) => <>确定要删除「{item.accountName}」的授权吗？</>}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await alliancePermissionApi.update(item.id, item)
        } else {
          await alliancePermissionApi.create(item)
        }
        toast({ title: `授权已${isEdit ? '更新' : '创建'}` })
        await refresh()
      }}
      onDelete={async (item: any) => {
        await alliancePermissionApi.delete(item.id)
        toast({ title: '授权已删除' })
        await refresh()
      }}
      onToggleEnabled={async (item: any) => {
        await alliancePermissionApi.toggleEnabled(item.id, !item.isEnabled)
        await refresh()
      }}
    />
  )
}
