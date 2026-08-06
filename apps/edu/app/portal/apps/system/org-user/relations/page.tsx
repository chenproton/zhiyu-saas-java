'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { portalUserRelationApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { UserSelector } from '@/components/shared/user-selector'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'

interface RelationItem {
  id: string
  initiatorId: string
  initiatorName?: string
  initiatorDept?: string
  targetId: string
  targetName?: string
  targetDept?: string
  relationType: string
  createdAt?: string
}

const relationTypes = [
  { value: 'superior', label: '上下级' },
  { value: 'collaboration', label: '业务协同' },
  { value: 'management', label: '管理关系' },
  { value: 'service', label: '服务关系' },
  { value: 'project', label: '项目参与' },
  { value: 'external', label: '外部合作' },
]

const typeLabelMap: Record<string, string> = Object.fromEntries(
  relationTypes.map((t) => [t.value, t.label]),
)

export default function RelationsPage() {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()
  const [searchText, setSearchText] = useState('')

  const {
    data: relations,
    loading,
    error,
    refresh,
  } = useAsync(
    async () => {
      const res = await portalUserRelationApi.list({ search: searchText || undefined })
      return res.items as RelationItem[]
    },
    { deps: [searchText], onError: () => true },
  )

  const handleCreate = async (item: RelationItem) => {
    try {
      await portalUserRelationApi.create({
        initiatorId: item.initiatorId,
        targetId: item.targetId,
        relationType: item.relationType,
      })
      toast({ title: '创建成功' })
      setSearchText('')
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await portalUserRelationApi.delete(id)
      toast({ title: '删除成功' })
      await refresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  return (
    <PortalCrudPage<RelationItem>
      title="人员关系管理"
      description="维护用户之间的上下级、协同等业务关系"
      entityLabel="关系"
      items={relations ?? []}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      colSpan={8}
      searchPlaceholder="搜索关系..."
      searchValue={searchText}
      onSearchChange={setSearchText}
      hideImport
      createButtonLabel="新建人员关系"
      createDefault={() => ({ id: '', initiatorId: '', targetId: '', relationType: '' })}
      renderForm={(item, setItem) => (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">关系发起人</label>
            <UserSelector
              value={item.initiatorId ? [item.initiatorId] : []}
              onChange={(ids) => setItem({ ...item, initiatorId: ids[0] || '' })}
              multiple={false}
              placeholder="搜索选择用户..."
              tenantId={tenantId}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">关系目标人</label>
            <UserSelector
              value={item.targetId ? [item.targetId] : []}
              onChange={(ids) => setItem({ ...item, targetId: ids[0] || '' })}
              multiple={false}
              placeholder="搜索选择用户..."
              tenantId={tenantId}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">关系类型</label>
            <Select
              value={item.relationType}
              onValueChange={(v) => setItem({ ...item, relationType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择关系类型" />
              </SelectTrigger>
              <SelectContent>
                {relationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      onSave={async (item) => {
        await handleCreate(item)
      }}
      renderTableHeader={() => (
        <>
          <TableHead className="w-12">序号</TableHead>
          <TableHead>关系发起人</TableHead>
          <TableHead>所属部门</TableHead>
          <TableHead>关系目标人</TableHead>
          <TableHead>所属部门</TableHead>
          <TableHead>关系类型</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="w-32 text-center">操作</TableHead>
        </>
      )}
      renderTableRow={(relation, actions) => (
        <>
          <TableCell className="text-muted-foreground">
            {(relations ?? []).indexOf(relation) + 1}
          </TableCell>
          <TableCell className="font-medium">{relation.initiatorName}</TableCell>
          <TableCell className="text-muted-foreground">{relation.initiatorDept || '—'}</TableCell>
          <TableCell className="font-medium">{relation.targetName}</TableCell>
          <TableCell className="text-muted-foreground">{relation.targetDept || '—'}</TableCell>
          <TableCell>
            <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
              {typeLabelMap[relation.relationType] || relation.relationType}
            </span>
          </TableCell>
          <TableCell className="text-muted-foreground">{relation.createdAt}</TableCell>
          <TableRowActions>
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
      getDeleteDescription={() => <>确定要删除该关系吗？此操作不可撤销。</>}
      onDelete={async (relation) => {
        await handleDelete(relation.id)
      }}
    />
  )
}
