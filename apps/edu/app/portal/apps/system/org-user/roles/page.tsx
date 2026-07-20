"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Upload, Download, Eye, Settings, AlertCircle, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { roleApi, portalUserManagementApi, type User } from "@/lib/api"
import type { Role } from "@/lib/types/backend"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { useToast } from "@/hooks/use-toast"
import { buildMenuTree, normalizeMenuPath, permissionModuleConfig } from "@/lib/menu-permissions"
import type { MenuTreeItem, PermissionModule } from "@/lib/menu-permissions"

function SystemCard({ node, checked, onCheck }: { node: MenuTreeItem; checked: Set<string>; onCheck: (id: string) => void }) {
  const childPages = useMemo(() => {
    const pages: MenuTreeItem[] = []
    const walk = (items: MenuTreeItem[]) => {
      for (const item of items) {
        if (item.href) pages.push(item)
        if (item.children) walk(item.children)
      }
    }
    if (node.children) walk(node.children)
    return pages
  }, [node])

  const checkedCount = childPages.filter(p => checked.has(p.id)).length
  const allChecked = checkedCount === childPages.length && childPages.length > 0
  const someChecked = checkedCount > 0 && !allChecked

  const handleSystemToggle = () => {
    const shouldCheck = !allChecked
    childPages.forEach(p => {
      if (shouldCheck && !checked.has(p.id)) onCheck(p.id)
      else if (!shouldCheck && checked.has(p.id)) onCheck(p.id)
    })
  }

  if (childPages.length === 0) return null

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Checkbox
          checked={allChecked ? true : someChecked ? "indeterminate" : false}
          onCheckedChange={handleSystemToggle}
        />
        <LayoutDashboard className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">{node.label}</span>
        <span className="text-xs text-muted-foreground">（{checkedCount}/{childPages.length}）</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {childPages.map(page => (
          <label
            key={page.id}
            className="flex items-center gap-1.5 p-1.5 rounded hover:bg-accent cursor-pointer text-sm"
          >
            <Checkbox checked={checked.has(page.id)} onCheckedChange={() => onCheck(page.id)} />
            <span className="truncate">{page.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function RolesPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPermDialogOpen, setIsPermDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [checkedMenus, setCheckedMenus] = useState<Set<string>>(new Set())
  const [checkedActions, setCheckedActions] = useState<Set<string>>(new Set())
  const [editName, setEditName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const menuTree = useMemo(() => buildMenuTree(), [])

  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false)
      setError("未获取到租户信息，请重新登录")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await roleApi.list({ tenantId, search: searchTerm || undefined, limit: 1000 })
      setRoles(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载角色失败")
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, searchTerm])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredRoles = useMemo(
    () => roles.filter((role) => role.name.includes(searchTerm) || role.code.includes(searchTerm)),
    [roles, searchTerm]
  )

  const generateRoleCode = () => {
    const maxSuffix = roles.reduce((max, r) => {
      const match = r.code.match(/^ROLE(\d+)$/)
      return match ? Math.max(max, parseInt(match[1], 10)) : max
    }, 0)
    return `ROLE${String(maxSuffix + 1).padStart(3, "0")}`
  }

  const toggleMenu = (id: string) => {
    setCheckedMenus((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAction = (module: string, page: string, action: string) => {
    const key = `${module}:${page}:${action}`
    setCheckedActions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const roleStatus = (role: Role): "active" | "inactive" => {
    if (role.status === "active") return "active"
    return "inactive"
  }

  const openPermDialog = (role: Role) => {
    setSelectedRole(role)
    const perms = role.permissions || {}

    const menuSet = new Set<string>()
    const walkAllIds = (nodes: MenuTreeItem[]) => {
      for (const n of nodes) {
        if (n.href) menuSet.add(n.id)
        if (n.children) walkAllIds(n.children)
      }
    }
    if (perms.menus && typeof perms.menus === "object") {
      menuSet.clear()
      const granted = new Set<string>()
      for (const [key, value] of Object.entries(perms.menus as Record<string, unknown>)) {
        if (value === true) granted.add(normalizeMenuPath(key))
      }
      const walk = (nodes: MenuTreeItem[]) => {
        for (const n of nodes) {
          if (n.href && granted.has(normalizeMenuPath(n.href))) {
            menuSet.add(n.id)
          }
          if (n.children) walk(n.children)
        }
      }
      walk(menuTree)
    } else {
      walkAllIds(menuTree)
    }
    setCheckedMenus(menuSet)

    const actionSet = new Set<string>()
    if (perms && typeof perms === "object") {
      for (const mod of permissionModuleConfig) {
        const modPerms = (perms as Record<string, unknown>)[mod.module]
        if (modPerms && typeof modPerms === "object") {
          for (const page of mod.pages) {
            const pagePerms = (modPerms as Record<string, unknown>)[page.page]
            if (Array.isArray(pagePerms)) {
              for (const a of pagePerms) {
                if (typeof a === "string") actionSet.add(`${mod.module}:${page.page}:${a}`)
              }
            } else if (pagePerms && typeof pagePerms === "object" && Array.isArray((pagePerms as Record<string, unknown>).buttons)) {
              for (const a of (pagePerms as Record<string, unknown>).buttons as string[]) {
                actionSet.add(`${mod.module}:${page.page}:${a}`)
              }
            }
          }
        }
      }
    }
    setCheckedActions(actionSet)

    setIsPermDialogOpen(true)
  }

  const savePermissions = async () => {
    if (!selectedRole || !tenantId) return
    setIsSaving(true)
    try {
      const menus: Record<string, boolean> = {}
      const walkMenuTree = (nodes: MenuTreeItem[]) => {
        for (const n of nodes) {
          if (n.href && checkedMenus.has(n.id)) {
            menus[n.href] = true
          }
          if (n.children) walkMenuTree(n.children)
        }
      }
      walkMenuTree(menuTree)

      const permissions: Record<string, any> = { ...(selectedRole.permissions || {}), menus }

      // 保留已有的非 menus 结构权限（如 scene/job/lesson/evaluation），并根据 checkedActions 更新
      for (const mod of permissionModuleConfig) {
        const modPerms: Record<string, string[]> = {}
        for (const page of mod.pages) {
          const actions: string[] = []
          for (const a of page.actions) {
            if (checkedActions.has(`${mod.module}:${page.page}:${a.action}`)) {
              actions.push(a.action)
            }
          }
          if (actions.length > 0) {
            modPerms[page.page] = actions
          }
        }
        if (Object.keys(modPerms).length > 0) {
          permissions[mod.module] = modPerms
        } else {
          delete permissions[mod.module]
        }
      }

      await roleApi.update(selectedRole.id, { ...selectedRole, permissions })
      await fetchData()
      setIsPermDialogOpen(false)
    } catch (err) {
      toast({ variant: "destructive", title: "保存失败", description: err instanceof Error ? err.message : "保存权限失败" })
    } finally {
      setIsSaving(false)
    }
  }

  const saveRole = async () => {
    if (!tenantId) {
      toast({ variant: "destructive", title: "保存失败", description: "未获取到租户信息，请重新登录" })
      return
    }
    setIsSaving(true)
    try {
      if (selectedRole) {
        await roleApi.update(selectedRole.id, { ...selectedRole, name: editName })
      } else {
        await roleApi.create({
          tenantId,
          code: generateRoleCode(),
          name: editName,
          description: "",
          permissions: {},
          status: "active",
        })
      }
      await fetchData()
      setIsDialogOpen(false)
    } catch (err) {
      toast({ variant: "destructive", title: selectedRole ? "保存失败" : "创建失败", description: err instanceof Error ? err.message : "保存角色失败" })
    } finally {
      setIsSaving(false)
    }
  }

  const [usersRole, setUsersRole] = useState<Role | null>(null)
  const [roleUsers, setRoleUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const openUsersDialog = async (role: Role) => {
    setUsersRole(role)
    setRoleUsers([])
    setUsersLoading(true)
    try {
      const res = await portalUserManagementApi.list({ tenantId, roleId: role.id, limit: 1000 })
      setRoleUsers(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载角色用户失败")
    } finally {
      setUsersLoading(false)
    }
  }

  const deleteRole = async (role: Role) => {
    if (!confirm(`确定要删除角色「${role.name}」吗？`)) return
    try {
      await roleApi.delete(role.id)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除角色失败")
    }
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">角色权限管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理系统角色及权限配置</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Upload className="h-4 w-4 mr-1" />
            导入
          </Button>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
          <Button size="sm" onClick={() => { setSelectedRole(null); setEditName(""); setIsDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" />
            新增角色
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索角色名称或编码..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          加载中...
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>角色编码</TableHead>
                  <TableHead>角色名称</TableHead>
                  <TableHead>关联用户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <Empty className="h-full">
                        <EmptyHeader>
                          <EmptyTitle>暂无角色</EmptyTitle>
                          <EmptyDescription>
                            {searchTerm ? "未找到匹配的角色" : "当前租户下尚未创建角色"}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoles.map((role) => {
                    const status = roleStatus(role)
                    return (
                      <TableRow key={role.id} className="border-border">
                        <TableCell className="font-mono text-sm text-muted-foreground">{role.code}</TableCell>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{role.userCount} 人</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status === "active" ? "default" : "secondary"}>
                            {status === "active" ? "启用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{role.createdAt}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedRole(role); setEditName(role.name); setIsDialogOpen(true) }}>
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPermDialog(role)}>
                                权限配置
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openUsersDialog(role)}>
                                查看用户
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => deleteRole(role)}>
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">共 {filteredRoles.length} 条记录</div>
        </>
      )}

      {/* 新增/编辑角色 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRole ? "编辑角色" : "新增角色"}</DialogTitle>
            <DialogDescription>角色编码由系统自动生成</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>角色编码</Label>
              <Input value={selectedRole?.code || generateRoleCode()} disabled className="bg-muted font-mono" />
            </div>
            <div className="grid gap-2">
              <Label>角色名称</Label>
              <Input placeholder="如：学校管理员" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={saveRole} disabled={!editName.trim() || isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 角色绑定用户列表 */}
      <Dialog open={!!usersRole} onOpenChange={(open) => { if (!open) setUsersRole(null) }}>
        <DialogContent className="!max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>绑定用户 - {usersRole?.name}</DialogTitle>
            <DialogDescription>
              {usersLoading ? "加载中..." : `共 ${roleUsers.length} 个用户绑定了该角色`}
            </DialogDescription>
          </DialogHeader>
          {usersLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
              <Spinner className="h-5 w-5" />
              加载中...
            </div>
          ) : roleUsers.length === 0 ? (
            <Empty className="h-40">
              <EmptyHeader>
                <EmptyTitle>暂无用户</EmptyTitle>
                <EmptyDescription>还没有用户绑定该角色，可在「账户列表」中为用户绑定角色</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>登录账号</TableHead>
                  <TableHead>全部角色</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                     <TableCell className="text-muted-foreground">{u.username || u.loginName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(u.roleNames ?? []).map((rn) => (
                          <Badge key={rn} variant="secondary">{rn}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "default" : "secondary"}>
                        {u.status === "active" ? "正常" : u.status === "graduated" ? "已毕业" : "禁用"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* 权限配置 */}
      <Dialog open={isPermDialogOpen} onOpenChange={setIsPermDialogOpen}>
        <DialogContent size="xl" className="!max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>权限配置 - {selectedRole?.name}</DialogTitle>
            <DialogDescription>配置角色的系统权限、菜单权限和数据权限</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="menus" className="mt-4">
            <TabsList>
              <TabsTrigger value="menus">菜单权限</TabsTrigger>
              <TabsTrigger value="actions">操作权限</TabsTrigger>
            </TabsList>
            <TabsContent value="menus" className="mt-4">
              <div className="text-sm text-muted-foreground mb-3">
                选择该角色可访问的功能页面。未勾选的页面将在应用中心与各平台侧边导航中隐藏入口。
              </div>
              <ScrollArea className="border border-border rounded-lg p-4">
                <div className="space-y-4">
                  {menuTree.map((node) => (
                    <SystemCard key={node.id} node={node} checked={checkedMenus} onCheck={toggleMenu} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="actions" className="mt-4">
              <div className="text-sm text-muted-foreground mb-3">
                控制各模块页面的操作按钮权限（提交审批、发布、删除、审核等）。
              </div>
              <ScrollArea className="border border-border rounded-lg p-4">
                <div className="space-y-4">
                  {permissionModuleConfig.map((mod) => (
                    <div key={mod.module} className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                        <LayoutDashboard className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{mod.label}</span>
                      </div>
                      {mod.pages.map((page) => (
                        <div key={page.page} className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">{page.label}</span>
                          <div className="flex flex-wrap gap-3">
                            {page.actions.map((a) => (
                              <label
                                key={`${mod.module}:${page.page}:${a.action}`}
                                className="flex items-center gap-1.5 p-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={checkedActions.has(`${mod.module}:${page.page}:${a.action}`)}
                                  onCheckedChange={() => toggleAction(mod.module, page.page, a.action)}
                                />
                                <span>{a.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {permissionModuleConfig.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">暂无可配置的操作权限</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsPermDialogOpen(false)}>取消</Button>
            <Button onClick={savePermissions} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存配置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
