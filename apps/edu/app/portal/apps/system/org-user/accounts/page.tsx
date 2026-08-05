'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ComboboxSelect } from '@/components/shared/combobox-select'

import { usePortalUsers } from '@/hooks/use-portal-users'
import { useOrgTree } from '@/hooks/use-org-tree'
import { portalUserManagementApi } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { useToast, StatusBadge } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ResetPasswordDialog } from '@/components/shared/reset-password-dialog'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { Trash2, Loader2, Check, X, Users, KeyRound, Power } from 'lucide-react'

export default function AccountsPage() {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()
  const [searchText, setSearchText] = useState('')
  const { users, roles, total, page, pageSize, setPage, loading, error, refetch } = usePortalUsers({
    search: searchText || undefined,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const { orgMap, orgTypeMap } = useOrgTree(tenantId)

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string[] | null>(null)

  const [bindTarget, setBindTarget] = useState<{ id: string; name: string } | null>(null)
  const [bindRoleIds, setBindRoleIds] = useState<string[]>([])
  const [bindSaving, setBindSaving] = useState(false)

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)

  const openBindDialog = (account: { id: string; name: string; roleIds: string[] }) => {
    setBindTarget({ id: account.id, name: account.name })
    setBindRoleIds(account.roleIds)
  }

  const handleBindRoles = async () => {
    if (!bindTarget || bindRoleIds.length === 0) return
    setBindSaving(true)
    try {
      await portalUserManagementApi.bindRoles(bindTarget.id, bindRoleIds)
      toast({ title: '角色绑定成功' })
      setBindTarget(null)
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '绑定失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setBindSaving(false)
    }
  }

  const handleResetPassword = (id: string, name: string) => {
    setResetTarget({ id, name })
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active'
    try {
      await portalUserManagementApi.updateStatus(id, nextStatus)
      toast({ title: nextStatus === 'active' ? '账户已启用' : '账户已禁用' })
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '操作失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    }
  }

  const confirmBatchDelete = async () => {
    if (!batchDeleteTarget || batchDeleteTarget.length === 0) return
    setBatchDeleting(true)
    try {
      await portalUserManagementApi.batchDelete(batchDeleteTarget)
      toast({ title: `成功删除 ${batchDeleteTarget.length} 个账户` })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '批量删除失败',
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setBatchDeleting(false)
      setSelectedAccounts([])
      setBatchDeleteTarget(null)
    }
    await refetch()
  }

  const accounts = users.map((user) => {
    const orgNode = user.orgNodeId ? orgMap.get(user.orgNodeId) : undefined
    const orgTypeName = orgNode ? orgTypeMap.get(orgNode.typeId)?.name : undefined
    return {
      id: user.id,
      name: user.name,
      roleNames: user.roleNames ?? [],
      roleIds: user.roleIds ?? [],
      orgNodeName: orgNode?.name || '—',
      orgTypeName: orgTypeName || undefined,
      loginName: user.username || user.loginName || '',
      status: user.status,
      lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '—',
    }
  })

  return (
    <PortalCrudPage
      title="账户管理"
      description="管理系统登录账户，绑定角色并维护账户状态"
      entityLabel="账户"
      items={accounts}
      loading={loading}
      error={error ?? null}
      onRetry={refetch}
      colSpan={7}
      searchPlaceholder="搜索姓名或账户..."
      searchValue={searchText}
      onSearchChange={setSearchText}
      hideImport
      hideCreate
      emptyContent={searchText ? '未找到匹配的账户' : '暂无账户数据'}
      pagination={{ page, total, totalPages, onPageChange: setPage }}
      rowSelection={{
        selectedIds: selectedAccounts,
        onToggle: (id, checked) =>
          setSelectedAccounts((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id))),
        onToggleAll: (checked) => setSelectedAccounts(checked ? accounts.map((a) => a.id) : []),
      }}
      headerActions={
        selectedAccounts.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            disabled={batchDeleting}
            onClick={() => setBatchDeleteTarget([...selectedAccounts])}
          >
            {batchDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            批量删除({selectedAccounts.length})
          </Button>
        )
      }
      renderTableHeader={() => (
        <>
          <TableHead>姓名</TableHead>
          <TableHead>角色</TableHead>
          <TableHead>所属组织</TableHead>
          <TableHead>账户登录名</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>最后登录时间</TableHead>
          <TableHead className="w-24 text-center">操作</TableHead>
        </>
      )}
      renderTableRow={(account, actions) => (
        <>
          <TableCell className="font-medium">{account.name}</TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              {account.roleNames.length > 0 ? (
                account.roleNames.map((rn) => (
                  <span key={rn} className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                    {rn}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1.5">
              <span>{account.orgNodeName}</span>
              {account.orgTypeName && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                  {account.orgTypeName}
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>{account.loginName}</TableCell>
          <TableCell>
            <StatusBadge status={account.status} />
          </TableCell>
          <TableCell className="text-muted-foreground">{account.lastLogin}</TableCell>
          <TableRowActions>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => openBindDialog(account)}
            >
              <Users className="mr-1 h-3 w-3" />
              绑定角色
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleResetPassword(account.id, account.name)}
            >
              <KeyRound className="mr-1 h-3 w-3" />
              重置密码
            </Button>
            {account.status === 'active' ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                onClick={() => handleToggleStatus(account.id, account.status)}
              >
                <Power className="mr-1 h-3 w-3" />
                禁用账户
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                onClick={() => handleToggleStatus(account.id, account.status)}
              >
                <Power className="mr-1 h-3 w-3" />
                启用账户
              </Button>
            )}
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
      getDeleteDescription={(account) => <>确定要删除账户「{account.name}」吗？此操作不可撤销。</>}
      onDelete={async (account) => {
        await portalUserManagementApi.delete(account.id)
      }}
    >
      <Dialog
        open={!!bindTarget}
        onOpenChange={(open) => {
          if (!open) setBindTarget(null)
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>绑定角色 - {bindTarget?.name}</DialogTitle>
            <DialogDescription>
              为用户绑定 1 个或多个角色，用户登录后可在顶栏切换当前角色
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <ComboboxSelect
              multiple
              value={bindRoleIds}
              onChange={setBindRoleIds}
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              placeholder="搜索并选择角色..."
              searchPlaceholder="搜索角色名称或编码..."
              emptyText="未找到角色"
              className="w-full"
              renderOption={(o, selected) => (
                <>
                  <span className="flex-1">{o.label}</span>
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {roles.find((r) => r.id === o.value)?.code}
                  </span>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </>
              )}
            />

            <div className="flex min-h-8 flex-wrap gap-1.5">
              {bindRoleIds.map((id) => {
                const r = roles.find((x) => x.id === id)
                if (!r) return null
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {r.name}
                    <button
                      type="button"
                      onClick={() => setBindRoleIds((prev) => prev.filter((i) => i !== id))}
                      className="ml-0.5 rounded-full hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
              {bindRoleIds.length === 0 && (
                <span className="text-sm text-muted-foreground">至少需要绑定一个角色</span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBindTarget(null)} disabled={bindSaving}>
              取消
            </Button>
            <Button onClick={handleBindRoles} disabled={bindSaving || bindRoleIds.length === 0}>
              {bindSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null)
        }}
        userId={resetTarget?.id}
        userName={resetTarget?.name}
        onSuccess={async () => {
          toast({ title: '密码重置成功' })
          await refetch()
        }}
      />

      <ConfirmDialog
        open={batchDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteTarget(null)
        }}
        title="确认批量删除"
        description={`确定要删除选中的 ${batchDeleteTarget?.length || 0} 个账户吗？此操作不可撤销。`}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </PortalCrudPage>
  )
}
