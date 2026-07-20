"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { usePortalUsers } from "@/hooks/use-portal-users"
import { useOrgTree } from "@/hooks/use-org-tree"
import { portalUserManagementApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { ResetPasswordDialog } from "@/components/shared/reset-password-dialog"
import { Search, MoreHorizontal, Trash2, Loader2, AlertCircle, RotateCcw, Check, ChevronDown, X, ChevronLeft, ChevronRight } from "lucide-react"

function mapAccountStatus(status: string): { label: string; className: string } {
  if (status === "active") {
    return { label: "正常", className: "bg-green-100 text-green-700" }
  }
  return { label: "禁用", className: "bg-red-100 text-red-700" }
}

export default function AccountsPage() {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()
  const [searchText, setSearchText] = useState("")
  const { users, roles, total, page, pageSize, setPage, loading, error, refetch } = usePortalUsers({
    search: searchText || undefined,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const { orgMap, orgTypeMap } = useOrgTree(tenantId)

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)

  const [bindTarget, setBindTarget] = useState<{ id: string; name: string } | null>(null)
  const [bindRoleIds, setBindRoleIds] = useState<string[]>([])
  const [bindSaving, setBindSaving] = useState(false)
  const [rolePickerOpen, setRolePickerOpen] = useState(false)

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)

  const openBindDialog = (account: { id: string; name: string; roleIds: string[] }) => {
    setBindTarget({ id: account.id, name: account.name })
    setBindRoleIds(account.roleIds)
    setRolePickerOpen(false)
  }

  const toggleBindRole = (roleId: string) => {
    setBindRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    )
  }

  const handleBindRoles = async () => {
    if (!bindTarget || bindRoleIds.length === 0) return
    setBindSaving(true)
    try {
      await portalUserManagementApi.bindRoles(bindTarget.id, bindRoleIds)
      toast({ title: "角色绑定成功" })
      setBindTarget(null)
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "绑定失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setBindSaving(false)
    }
  }

  const handleResetPassword = (id: string, name: string) => {
    setResetTarget({ id, name })
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "disabled" : "active"
    try {
      await portalUserManagementApi.updateStatus(id, nextStatus)
      toast({ title: nextStatus === "active" ? "账户已启用" : "账户已禁用" })
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`确定要删除账户「${name}」吗？此操作不可撤销。`)) return
    try {
      await portalUserManagementApi.delete(id)
      toast({ title: "删除成功" })
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const toggleSelectAccount = (id: string) => {
    setSelectedAccounts((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedAccounts.length === accounts.length && accounts.length > 0) {
      setSelectedAccounts([])
    } else {
      setSelectedAccounts(accounts.map((a) => a.id))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedAccounts.length === 0) return
    if (!window.confirm(`确定要删除选中的 ${selectedAccounts.length} 个账户吗？此操作不可撤销。`)) return
    setBatchDeleting(true)
    try {
      await portalUserManagementApi.batchDelete(selectedAccounts)
      toast({ title: `成功删除 ${selectedAccounts.length} 个账户` })
    } catch (err) {
      toast({ variant: "destructive", title: "批量删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setBatchDeleting(false)
      setSelectedAccounts([])
    }
    await refetch()
  }

  const accounts = users.map((user) => {
    const statusStyle = mapAccountStatus(user.status)
    const orgNode = user.orgNodeId ? orgMap.get(user.orgNodeId) : undefined
    const orgTypeName = orgNode ? orgTypeMap.get(orgNode.typeId)?.name : undefined
    return {
      id: user.id,
      name: user.name,
      roleNames: user.roleNames ?? [],
      roleIds: user.roleIds ?? [],
      orgNodeName: orgNode?.name || "—",
      orgTypeName: orgTypeName || undefined,
      loginName: user.username || user.loginName || "",
      rawLoginName: user.loginName || "",
      status: user.status,
      statusLabel: statusStyle.label,
      statusClassName: statusStyle.className,
      lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("zh-CN") : "—",
    }
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索姓名或账户..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedAccounts.length > 0 && (
            <Button variant="destructive" size="sm" disabled={batchDeleting} onClick={handleBatchDelete}>
              {batchDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              批量删除({selectedAccounts.length})
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/20 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">加载失败</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RotateCcw className="h-4 w-4 mr-1" />重试
          </Button>
        </div>
      )}

      <div className="bg-card rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedAccounts.length === accounts.length && accounts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>所属组织</TableHead>
              <TableHead>账户登录名</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最后登录时间</TableHead>
              <TableHead className="w-24 text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  {searchText ? "未找到匹配的账户" : "暂无账户数据"}
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => toggleSelectAccount(account.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {account.roleNames.length > 0 ? (
                        account.roleNames.map((rn) => (
                          <span key={rn} className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">{rn}</span>
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
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{account.orgTypeName}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{account.loginName}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${account.statusClassName}`}>{account.statusLabel}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{account.lastLogin}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openBindDialog(account)}>
                          绑定角色
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(account.id, account.name)}>
                          重置密码
                        </DropdownMenuItem>
                        {account.status === "active" ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => handleToggleStatus(account.id, account.status)}>
                            禁用账户
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleToggleStatus(account.id, account.status)}>
                            启用账户
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(account.id, account.name)}>
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {total} 条记录</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!bindTarget} onOpenChange={(open) => { if (!open) setBindTarget(null) }}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>绑定角色 - {bindTarget?.name}</DialogTitle>
            <DialogDescription>为用户绑定 1 个或多个角色，用户登录后可在顶栏切换当前角色</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Popover open={rolePickerOpen} onOpenChange={setRolePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {bindRoleIds.length > 0 ? `已选择 ${bindRoleIds.length} 个角色` : "搜索并选择角色..."}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索角色名称或编码..." />
                  <CommandList>
                    <CommandEmpty>未找到角色</CommandEmpty>
                    <CommandGroup>
                      {roles.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`${r.name} ${r.code}`}
                          onSelect={() => toggleBindRole(r.id)}
                        >
                          <span className="flex-1">{r.name}</span>
                          <span className="mr-2 font-mono text-xs text-muted-foreground">{r.code}</span>
                          {bindRoleIds.includes(r.id) && <Check className="h-4 w-4 text-primary" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="flex min-h-8 flex-wrap gap-1.5">
              {bindRoleIds.map((id) => {
                const r = roles.find((x) => x.id === id)
                if (!r) return null
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {r.name}
                    <button type="button" onClick={() => toggleBindRole(id)} className="ml-0.5 rounded-full hover:text-destructive">
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
            <Button variant="outline" onClick={() => setBindTarget(null)} disabled={bindSaving}>取消</Button>
            <Button onClick={handleBindRoles} disabled={bindSaving || bindRoleIds.length === 0}>
              {bindSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog
        open={!!resetTarget}
        onOpenChange={(open) => { if (!open) setResetTarget(null) }}
        userId={resetTarget?.id}
        userName={resetTarget?.name}
        onSuccess={async () => {
          toast({ title: "密码重置成功" })
          await refetch()
        }}
      />
    </div>
  )
}
