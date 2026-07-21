"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  ChevronDown, ChevronRight, School, Building2, BookOpen, Users as UsersIcon, Briefcase, Building,
  Search, X, Check, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  orgApi, orgTypeApi, userManagementApi, portalUserManagementApi,
} from "@/lib/api"
import type { User } from "@/lib/api"
import type { Organization, OrgType } from "@/lib/types/backend"

interface UserSelectorProps {
  value: string[]
  onChange: (userIds: string[]) => void
  multiple?: boolean
  excludeStudent?: boolean
  excludeUserIds?: string[]
  placeholder?: string
  disabled?: boolean
  tenantId?: string
  usePortalApi?: boolean
}

function typeMetaFor(typeName?: string): { icon: React.ElementType; color: string } {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    "学校": { icon: School, color: "text-blue-600" },
    "二级学院": { icon: Building2, color: "text-violet-600" },
    "专业": { icon: BookOpen, color: "text-emerald-600" },
    "班级": { icon: UsersIcon, color: "text-cyan-600" },
    "行政职能部门": { icon: Briefcase, color: "text-rose-600" },
  }
  return (typeName && map[typeName]) || { icon: Building, color: "text-slate-600" }
}

function OrgTreeRow({
  node, level, orgTypeMap, selectedId, onSelect, collapsedIds, onToggle,
}: {
  node: Organization & { children?: Organization[] }
  level: number
  orgTypeMap: Map<string, OrgType>
  selectedId: string | null
  onSelect: (id: string) => void
  collapsedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const expanded = !collapsedIds.has(node.id)
  const meta = typeMetaFor(orgTypeMap.get(node.typeId)?.name)
  const Icon = meta.icon

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 text-sm rounded-md cursor-pointer transition-colors",
          selectedId === node.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
        )}
        style={{ marginLeft: level * 16 }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggle(node.id) }}
          className="w-4 h-4 flex items-center justify-center shrink-0" tabIndex={-1}
        >
          {hasChildren ? (expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />) : <span className="w-3.5" />}
        </button>
        <Icon className={cn("w-4 h-4 shrink-0", meta.color)} />
        <span className="truncate">{node.name}</span>
      </div>
      {hasChildren && expanded && children.map((child: Organization & { children?: Organization[] }) => (
        <OrgTreeRow key={child.id} node={child} level={level + 1} orgTypeMap={orgTypeMap} selectedId={selectedId} onSelect={onSelect} collapsedIds={collapsedIds} onToggle={onToggle} />
      ))}
    </div>
  )
}

function collectSubtreeIds(orgMap: Map<string, Organization & { children?: Organization[] }>, rootId: string): Set<string> {
  const ids = new Set<string>()
  const collect = (node?: Organization & { children?: Organization[] }) => {
    if (!node || ids.has(node.id)) return
    ids.add(node.id)
    node.children?.forEach((child: Organization & { children?: Organization[] }) => collect(child))
  }
  collect(orgMap.get(rootId))
  return ids
}

export function UserSelector({
  value, onChange, multiple = true, excludeStudent = true,
  excludeUserIds = [],
  placeholder = "选择用户", disabled = false, tenantId, usePortalApi = true,
}: UserSelectorProps) {
  const [open, setOpen] = useState(false)
  const [orgs, setOrgs] = useState<(Organization & { children?: Organization[] })[]>([])
  const [orgTypes, setOrgTypes] = useState<OrgType[]>([])
  const [orgLoading, setOrgLoading] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>(value)
  const [userCache, setUserCache] = useState<Record<string, User>>({})
  const fetchedIdsRef = useRef<Set<string>>(new Set())

  const orgTypeMap = useMemo(() => {
    const map = new Map<string, OrgType>()
    orgTypes.forEach((t) => map.set(t.id, t))
    return map
  }, [orgTypes])

  const orgMap = useMemo(() => {
    const map = new Map<string, (Organization & { children?: Organization[] })>()
    const flatten = (nodes: (Organization & { children?: Organization[] })[]) => {
      nodes.forEach((n) => { map.set(n.id, n); if (n.children) flatten(n.children) })
    }
    flatten(orgs)
    return map
  }, [orgs])

  const mergeUserCache = useCallback((items: User[]) => {
    if (items.length === 0) return
    setUserCache((prev) => {
      const next = { ...prev }
      items.forEach((u) => { next[u.id] = u })
      return next
    })
  }, [])

  const loadOrgTree = useCallback(async () => {
    setOrgLoading(true)
    try {
      const [treeRes, typesRes] = await Promise.all([
        orgApi.tree(tenantId ? { tenantId } : undefined),
        orgTypeApi.list({ tenantId, limit: 1000 }),
      ])
      setOrgs(treeRes.items)
      setOrgTypes(typesRes.items)
    } catch { /* ignore */ }
    finally { setOrgLoading(false) }
  }, [tenantId])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const params: any = { limit: 200, search: userSearch || undefined }
      if (selectedOrgId) {
        const subtreeIds = collectSubtreeIds(orgMap, selectedOrgId)
        params.orgNodeId = selectedOrgId
      }
      if (tenantId) params.tenantId = tenantId
      const api = usePortalApi ? portalUserManagementApi : userManagementApi
      const res = await api.list(params)
      let filtered = res.items
      if (excludeStudent) {
        filtered = filtered.filter((u) => !(u.roleCodes || []).includes("student"))
      }
      if (excludeUserIds.length > 0) {
        const excludeSet = new Set(excludeUserIds)
        filtered = filtered.filter((u) => !excludeSet.has(u.id))
      }
      setUsers(filtered)
      mergeUserCache(res.items)
    } catch { /* ignore */ }
    finally { setUsersLoading(false) }
  }, [selectedOrgId, userSearch, tenantId, usePortalApi, excludeStudent, orgMap, mergeUserCache])

  useEffect(() => { loadOrgTree() }, [loadOrgTree])
  useEffect(() => { if (open) loadUsers() }, [open, loadUsers])

  // Resolve names for selected ids that are not in cache yet (e.g. echo on edit),
  // so the trigger shows user names instead of raw ids.
  useEffect(() => {
    const missing = value.filter((id) => !userCache[id] && !fetchedIdsRef.current.has(id))
    if (missing.length === 0) return
    missing.forEach((id) => fetchedIdsRef.current.add(id))
    const api = usePortalApi ? portalUserManagementApi : userManagementApi
    let cancelled = false
    Promise.allSettled(missing.map((id) => api.get(id))).then((results) => {
      if (cancelled) return
      const fetched = results
        .filter((r): r is PromiseFulfilledResult<User> => r.status === "fulfilled" && !!r.value)
        .map((r) => r.value)
      mergeUserCache(fetched)
    })
    return () => { cancelled = true }
  }, [value, userCache, usePortalApi, mergeUserCache])

  useEffect(() => {
    if (open) setSelectedIds([...value])
  }, [open, value])

  const toggleOrg = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      if (!multiple) return [userId]
      return prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    })
  }

  const removeSelected = (userId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== userId))
  }

  const handleConfirm = () => {
    onChange(selectedIds)
    setOpen(false)
  }

  const roleLabel = (u: User) => (u.roleNames || []).join("、")
  const orgName = (userId?: string) => {
    if (!userId) return ""
    const u = users.find((x) => x.id === userId)
    if (!u?.orgNodeId) return ""
    return orgMap.get(u.orgNodeId)?.name || u.orgNodeId
  }

  const displayName = useCallback((id: string) => {
    const u = userCache[id] || users.find((x) => x.id === id)
    return u?.name || u?.username || id
  }, [userCache, users])

  const triggerText = value.length === 0 ? placeholder
    : value.length <= 3 ? value.map((id) => displayName(id)).join("、")
    : `已选 ${value.length} 人`

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn("w-full justify-start text-left font-normal", value.length === 0 && "text-muted-foreground")}
        onClick={() => setOpen(true)}
      >
        {value.length > 0 && (
          <UsersIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{triggerText}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[960px] max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>选择用户</DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left: Org Tree */}
            <div className="w-60 border-r shrink-0 overflow-y-auto px-3 py-2">
              {orgLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedOrgId(null)}
                    className={cn(
                      "flex items-center gap-2 py-1.5 px-2 text-sm rounded-md cursor-pointer transition-colors mb-1",
                      !selectedOrgId ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    )}
                  >
                    <Building className="w-4 h-4 text-slate-600" />
                    <span>全部组织</span>
                  </div>
                  {orgs.map((node) => (
                    <OrgTreeRow
                      key={node.id} node={node} level={0}
                      orgTypeMap={orgTypeMap} selectedId={selectedOrgId}
                      onSelect={setSelectedOrgId} collapsedIds={collapsedIds}
                      onToggle={toggleOrg}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Right: User List */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索用户..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <UsersIcon className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">暂无用户</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">{multiple ? "" : ""}</TableHead>
                        <TableHead className="text-xs">账号</TableHead>
                        <TableHead className="text-xs">姓名</TableHead>
                        <TableHead className="text-xs">所属组织</TableHead>
                        <TableHead className="text-xs">角色</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow
                          key={u.id}
                          className={cn("cursor-pointer", selectedIds.includes(u.id) && "bg-primary/5")}
                          onClick={() => toggleUser(u.id)}
                        >
                          <TableCell>
                            <Checkbox checked={selectedIds.includes(u.id)} />
                          </TableCell>
                          <TableCell className="text-sm font-medium">{u.username}</TableCell>
                          <TableCell className="text-sm">{u.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{orgMap.get(u.orgNodeId || "")?.name || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{roleLabel(u)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>

          {/* Bottom bar: selected users */}
          <div className="border-t px-6 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm text-muted-foreground shrink-0">
                  {multiple ? `已选 ${selectedIds.length} 人` : selectedIds.length > 0 ? "已选" : "未选择"}
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  {selectedIds.map((id) => {
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 pl-2">
                        <span className="max-w-[120px] truncate">{displayName(id)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeSelected(id) }}
                          className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>取消</Button>
                <Button size="sm" onClick={handleConfirm}>
                  <Check className="mr-1 h-4 w-4" />确认
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
