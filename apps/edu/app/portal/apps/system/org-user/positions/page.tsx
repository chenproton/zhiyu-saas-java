'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableHead } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { StatusBadge } from '@/components/shared/status-badge'
import { portalStaffTitleApi, portalUserManagementApi, type User } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { Pencil, Power, Trash2, Upload, Download, Loader2, Users } from 'lucide-react'
import type { StaffTitle } from '@/lib/types/backend'

export default function PositionsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<StaffTitle | null>(null)
  const [titleUsers, setTitleUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const {
    data: positions,
    loading,
    error,
    refresh,
  } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await portalStaffTitleApi.list({ tenantId, limit: 200 })
      return res.items
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const handleSave = async (item: StaffTitle, isEdit: boolean) => {
    if (!tenantId) return
    const payload = {
      tenantId,
      name: item.name.trim(),
      description: item.description?.trim() || undefined,
    }
    if (isEdit) {
      await portalStaffTitleApi.update(item.id, payload)
      toast({ title: '保存成功', description: '职位信息已更新' })
    } else {
      await portalStaffTitleApi.create(
        payload as Omit<StaffTitle, 'id' | 'userCount' | 'createdAt'>,
      )
      toast({ title: '创建成功', description: '新职位已添加' })
    }
  }

  const toggleStatus = async (position: StaffTitle) => {
    const nextStatus = position.status === 'active' ? 'inactive' : 'active'
    try {
      await portalStaffTitleApi.toggleStatus(position.id, nextStatus)
      toast({ title: '状态已更新' })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '操作失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  const openUsersDialog = async (position: StaffTitle) => {
    setSelectedPosition(position)
    setIsUsersDialogOpen(true)
    setLoadingUsers(true)
    setTitleUsers([])
    try {
      // 服务端按 titleId 过滤（title_ids @> ARRAY[...]），避免全量拉取超 200 截断
      const res = await portalUserManagementApi.list({ tenantId, titleId: position.id, limit: 200 })
      setTitleUsers(res.items)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '加载用户失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  return (
    <PortalCrudPage
      title="职位管理"
      description="管理系统职位信息"
      entityLabel="职位"
      items={positions ?? []}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      colSpan={5}
      searchPlaceholder="搜索职位名称..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filterItems={(items, search) =>
        items.filter(
          (pos) =>
            !search ||
            pos.name.includes(search) ||
            (pos.description && pos.description.includes(search)),
        )
      }
      hideImport
      headerActions={
        <>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Download className="h-4 w-4 mr-1" />
            批量导出
          </Button>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Upload className="h-4 w-4 mr-1" />
            批量导入
          </Button>
        </>
      }
      createButtonLabel="新建职位"
      createDefault={() => ({
        id: '',
        tenantId: '',
        code: '',
        name: '',
        description: '',
        userCount: 0,
        status: 'active',
        createdAt: '',
      })}
      renderForm={(item, setItem) => (
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              职位名称 <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="如：教授"
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">描述</label>
            <Input
              placeholder="可选描述"
              value={item.description || ''}
              onChange={(e) => setItem({ ...item, description: e.target.value })}
            />
          </div>
        </div>
      )}
      onSave={handleSave}
      onToggleEnabled={toggleStatus}
      renderTableHeader={() => (
        <>
          <TableHead className="w-32">职位名称</TableHead>
          <TableHead className="w-32">关联用户数量</TableHead>
          <TableHead className="w-24">状态</TableHead>
          <TableHead className="hidden md:table-cell">创建时间</TableHead>
          <TableHead className="w-24 text-right">操作</TableHead>
        </>
      )}
      renderTableRow={(position, actions) => (
        <>
          <TableCell className="font-medium">{position.name}</TableCell>
          <TableCell>
            <Badge variant="secondary">{position.userCount} 人</Badge>
          </TableCell>
          <TableCell>
            <StatusBadge
              status={position.status}
              label={position.status === 'active' ? '启用' : '停用'}
            />
          </TableCell>
          <TableCell className="hidden md:table-cell text-muted-foreground">
            {new Date(position.createdAt).toLocaleString('zh-CN')}
          </TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.edit}>
              <Pencil className="mr-1 h-3 w-3" />
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => openUsersDialog(position)}
            >
              <Users className="mr-1 h-3 w-3" />
              查看用户
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.toggle}>
              <Power className="mr-1 h-3 w-3" />
              {position.status === 'active' ? '停用' : '启用'}
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
      getDeleteDescription={(position) => (
        <>确定要删除职位「{position.name}」吗？删除后不可恢复。</>
      )}
      onDelete={async (position) => {
        await portalStaffTitleApi.delete(position.id)
      }}
    >
      <Dialog open={isUsersDialogOpen} onOpenChange={setIsUsersDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>关联用户 - {selectedPosition?.name}</DialogTitle>
            <DialogDescription>共 {titleUsers.length} 名用户关联此职位</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingUsers ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
              </div>
            ) : titleUsers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">暂无关联用户</p>
            ) : (
              <div className="space-y-2">
                {titleUsers.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {user.name[0]}
                      </div>
                      <span className="text-sm">{user.name}</span>
                    </div>
                    <Badge variant="outline">{user.username || user.loginName}</Badge>
                  </div>
                ))}
                {titleUsers.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground">
                    ... 还有 {titleUsers.length - 5} 名用户
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUsersDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalCrudPage>
  )
}
