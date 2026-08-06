'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  Pencil,
  Trash2,
  Upload,
  Download,
  Settings,
  Users,
  LayoutDashboard,
  Folder,
} from 'lucide-react'
import { roleApi, portalUserManagementApi, type User } from '@/lib/api'
import type { Role } from '@/lib/types/backend'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useToast } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { StatusBadge } from '@/components/shared/status-badge'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { buildMenuTree, normalizeMenuPath, permissionModuleConfig } from '@/lib/menu-permissions'
import type { MenuTreeItem } from '@/lib/menu-permissions'

const MENU_TREE_PLATFORM_MAP: Record<string, string> = {
  'system-entry': 'system',
  career: 'career',
  course: 'course',
  scene: 'scene',
  ability: 'ability',
  resource: 'resource',
  alliance: 'alliance',
}

const ACTION_MODULE_PLATFORM_MAP: Record<string, string> = {
  scene: 'scene',
  job: 'career',
  lesson: 'course',
  evaluation: 'ability',
  alliance: 'alliance',
}

function filterMenuTreeBySubscription(
  tree: MenuTreeItem[],
  modules: Record<string, boolean> | null | undefined,
): MenuTreeItem[] {
  if (!modules) return tree
  return tree.filter((node) => {
    const platformId = MENU_TREE_PLATFORM_MAP[node.id]
    if (!platformId) return true
    return modules[platformId] === true
  })
}

function SystemCard({
  node,
  checked,
  onCheck,
}: {
  node: MenuTreeItem
  checked: Set<string>
  onCheck: (id: string) => void
}) {
  const collectPages = (items: MenuTreeItem[]): MenuTreeItem[] => {
    const pages: MenuTreeItem[] = []
    const walk = (list: MenuTreeItem[]) => {
      for (const item of list) {
        if (item.href) pages.push(item)
        if (item.children) walk(item.children)
      }
    }
    walk(items)
    return pages
  }

  const allPages = useMemo(() => collectPages(node.children ?? []), [node])

  const groups = useMemo(
    () =>
      (node.children ?? [])
        .filter((item) => item.children?.length)
        .map((item) => ({ item, pages: collectPages(item.children ?? []) })),
    [node],
  )

  const directPages = useMemo(
    () => (node.children ?? []).filter((item) => !item.children?.length && item.href),
    [node],
  )

  const checkedCount = allPages.filter((p) => checked.has(p.id)).length
  const allChecked = checkedCount === allPages.length && allPages.length > 0
  const someChecked = checkedCount > 0 && !allChecked

  const togglePages = (pages: MenuTreeItem[], shouldCheck: boolean) => {
    pages.forEach((p) => {
      if (shouldCheck && !checked.has(p.id)) onCheck(p.id)
      else if (!shouldCheck && checked.has(p.id)) onCheck(p.id)
    })
  }

  const handleSystemToggle = () => togglePages(allPages, !allChecked)

  if (allPages.length === 0) return null

  const renderPageGrid = (pages: MenuTreeItem[]) => (
    <div className="grid grid-cols-6 gap-1.5">
      {pages.map((page) => (
        <label
          key={page.id}
          className="flex items-center gap-1.5 p-1.5 rounded hover:bg-accent cursor-pointer text-sm"
        >
          <Checkbox checked={checked.has(page.id)} onCheckedChange={() => onCheck(page.id)} />
          <span className="truncate">{page.label}</span>
        </label>
      ))}
    </div>
  )

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Checkbox
          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
          onCheckedChange={handleSystemToggle}
        />
        <LayoutDashboard className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">{node.label}</span>
        <span className="text-xs text-muted-foreground">
          （{checkedCount}/{allPages.length}）
        </span>
      </div>
      <div className="space-y-3">
        {directPages.length > 0 && renderPageGrid(directPages)}
        {groups.map(({ item, pages }) => {
          const groupCheckedCount = pages.filter((p) => checked.has(p.id)).length
          const groupAll = groupCheckedCount === pages.length
          const groupSome = groupCheckedCount > 0 && !groupAll
          return (
            <div key={item.id} className="rounded-md bg-muted/50 p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={groupAll ? true : groupSome ? 'indeterminate' : false}
                  onCheckedChange={() => togglePages(pages, !groupAll)}
                />
                <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  （{groupCheckedCount}/{pages.length}）
                </span>
              </div>
              {renderPageGrid(pages)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface RoleItem {
  id: string
  code: string
  name: string
  description?: string
  permissions?: Record<string, any>
  status?: string
  userCount: number
  createdAt: string
}

export default function RolesPage() {
  const { tenantId, subscriptionModules } = usePortalAuth()
  const { toast } = useToast()
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPermDialogOpen, setIsPermDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [checkedMenus, setCheckedMenus] = useState<Set<string>>(new Set())
  const [checkedActions, setCheckedActions] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const menuTree = useMemo(() => {
    const tree = buildMenuTree()
    return filterMenuTreeBySubscription(tree, subscriptionModules)
  }, [subscriptionModules])

  const visibleActionModules = useMemo(
    () =>
      permissionModuleConfig.filter(
        (mod) =>
          subscriptionModules == null ||
          subscriptionModules[ACTION_MODULE_PLATFORM_MAP[mod.module]] === true,
      ),
    [subscriptionModules],
  )

  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false)
      setError('未获取到租户信息，请重新登录')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await roleApi.list({ tenantId, limit: 1000 })
      setRoles(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载角色失败')
    } finally {
      setIsLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    ;(async () => {
      await fetchData()
    })()
  }, [fetchData])

  const generateRoleCode = () => {
    const maxSuffix = roles.reduce((max, r) => {
      const match = r.code.match(/^ROLE(\d+)$/)
      return match ? Math.max(max, parseInt(match[1], 10)) : max
    }, 0)
    return `ROLE${String(maxSuffix + 1).padStart(3, '0')}`
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

  const roleStatus = (role: Role): 'active' | 'inactive' => {
    if (role.status === 'active') return 'active'
    return 'inactive'
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
    if (perms.menus && typeof perms.menus === 'object') {
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
      // menus 缺失（如学校管理员/平台管理员）表示不限制菜单，回显为全选
      walkAllIds(menuTree)
    }
    setCheckedMenus(menuSet)

    const actionSet = new Set<string>()
    if (perms && typeof perms === 'object') {
      for (const mod of permissionModuleConfig) {
        const modPerms = (perms as Record<string, unknown>)[mod.module]
        if (modPerms && typeof modPerms === 'object') {
          for (const page of mod.pages) {
            const pagePerms = (modPerms as Record<string, unknown>)[page.page]
            if (Array.isArray(pagePerms)) {
              for (const a of pagePerms) {
                if (typeof a === 'string') actionSet.add(`${mod.module}:${page.page}:${a}`)
              }
            } else if (
              pagePerms &&
              typeof pagePerms === 'object' &&
              Array.isArray((pagePerms as Record<string, unknown>).buttons)
            ) {
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
      // 同时受租户套餐控制：未订阅平台的操作权限不保留
      for (const mod of permissionModuleConfig.filter(
        (mod) => subscriptionModules?.[ACTION_MODULE_PLATFORM_MAP[mod.module]] === true,
      )) {
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
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err instanceof Error ? err.message : '保存权限失败',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const saveRole = async (item: RoleItem, isEdit: boolean) => {
    if (!tenantId) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: '未获取到租户信息，请重新登录',
      })
      return
    }
    if (isEdit) {
      await roleApi.update(item.id, { ...(item as unknown as Role), name: item.name.trim() })
      toast({ title: '保存成功' })
    } else {
      await roleApi.create({
        tenantId,
        code: generateRoleCode(),
        name: item.name.trim(),
        description: '',
        permissions: {},
        status: 'active',
      })
      toast({ title: '创建成功' })
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
      setError(err instanceof Error ? err.message : '加载角色用户失败')
    } finally {
      setUsersLoading(false)
    }
  }

  const deleteRole = async (role: Role) => {
    await roleApi.delete(role.id)
  }

  return (
    <PortalCrudPage
      title="角色权限管理"
      description="管理系统角色及权限配置"
      entityLabel="角色"
      items={roles}
      loading={isLoading}
      error={error}
      onRetry={fetchData}
      colSpan={6}
      searchPlaceholder="搜索角色名称或编码..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filterItems={(items, search) =>
        items.filter((role) => !search || role.name.includes(search) || role.code.includes(search))
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
      createButtonLabel="新建角色"
      createDefault={() => ({
        id: '',
        code: generateRoleCode(),
        name: '',
        userCount: 0,
        createdAt: '',
      })}
      renderForm={(item, setItem) => (
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">角色编码</label>
            <Input
              value={item.code || generateRoleCode()}
              disabled
              className="bg-muted font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              角色名称 <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="如：学校管理员"
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </div>
        </div>
      )}
      onSave={saveRole}
      renderTableHeader={() => (
        <>
          <TableHead>角色编码</TableHead>
          <TableHead>角色名称</TableHead>
          <TableHead>关联用户</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </>
      )}
      renderTableRow={(role, actions) => {
        const status = roleStatus(role as Role)
        return (
          <>
            <TableCell className="font-mono text-sm text-muted-foreground">{role.code}</TableCell>
            <TableCell className="font-medium">{role.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{role.userCount} 人</Badge>
            </TableCell>
            <TableCell>
              <StatusBadge status={status} label={status === 'active' ? '启用' : '停用'} />
            </TableCell>
            <TableCell className="text-muted-foreground">{role.createdAt}</TableCell>
            <TableRowActions>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={actions.edit}>
                <Pencil className="mr-1 h-3 w-3" />
                编辑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => openPermDialog(role as Role)}
              >
                <Settings className="mr-1 h-3 w-3" />
                权限配置
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => openUsersDialog(role as Role)}
              >
                <Users className="mr-1 h-3 w-3" />
                查看用户
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
        )
      }}
      getDeleteDescription={(role) => <>确定要删除角色「{role.name}」吗？</>}
      onDelete={async (role) => {
        await deleteRole(role as Role)
      }}
      emptyContent={
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyTitle>暂无角色</EmptyTitle>
            <EmptyDescription>
              {searchTerm ? '未找到匹配的角色' : '当前租户下尚未创建角色'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      {/* 角色绑定用户列表 */}
      <Dialog
        open={!!usersRole}
        onOpenChange={(open) => {
          if (!open) setUsersRole(null)
        }}
      >
        <DialogContent className="!max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>绑定用户 - {usersRole?.name}</DialogTitle>
            <DialogDescription>
              {usersLoading ? '加载中...' : `共 ${roleUsers.length} 个用户绑定了该角色`}
            </DialogDescription>
          </DialogHeader>
          {usersLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
              <span>加载中...</span>
            </div>
          ) : roleUsers.length === 0 ? (
            <Empty className="h-40">
              <EmptyHeader>
                <EmptyTitle>暂无用户</EmptyTitle>
                <EmptyDescription>
                  还没有用户绑定该角色，可在「账户列表」中为用户绑定角色
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
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
                      <TableCell className="text-muted-foreground">
                        {u.username || u.loginName}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(u.roleNames ?? []).map((rn) => (
                            <Badge key={rn} variant="secondary">
                              {rn}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={u.status}
                          label={
                            u.status === 'active'
                              ? '正常'
                              : u.status === 'graduated'
                                ? '已毕业'
                                : '禁用'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                    <SystemCard
                      key={node.id}
                      node={node}
                      checked={checkedMenus}
                      onCheck={toggleMenu}
                    />
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
                  {visibleActionModules.map((mod) => (
                    <div key={mod.module} className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                        <LayoutDashboard className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{mod.label}</span>
                      </div>
                      {mod.pages.map((page) => (
                        <div key={page.page} className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {page.label}
                          </span>
                          <div className="flex flex-wrap gap-3">
                            {page.actions.map((a) => (
                              <label
                                key={`${mod.module}:${page.page}:${a.action}`}
                                className="flex items-center gap-1.5 p-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={checkedActions.has(
                                    `${mod.module}:${page.page}:${a.action}`,
                                  )}
                                  onCheckedChange={() =>
                                    toggleAction(mod.module, page.page, a.action)
                                  }
                                />
                                <span>{a.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {visibleActionModules.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      暂无可配置的操作权限
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsPermDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={savePermissions} disabled={isSaving}>
              {isSaving ? '保存中...' : '保存配置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalCrudPage>
  )
}
