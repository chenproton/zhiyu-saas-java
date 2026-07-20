"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { usePortalUsers } from "@/hooks/use-portal-users"
import { useOrgTree } from "@/hooks/use-org-tree"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { OrgFilterTree, collectOrgSubtreeIds } from "@/components/shared/org-filter-tree"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { portalUserManagementApi, portalStaffTitleApi } from "@/lib/api"
import type { StaffTitle } from "@/lib/types/backend"
import { MultiSelectSearch } from "@/components/ui/multi-select-search"
import { useToast } from "@/hooks/use-toast"
import {
  Plus, MoreHorizontal, Power, Trash2, Search, Filter, Upload, Download,
  FolderTree, Key, Loader2, AlertCircle, RotateCcw, Pencil, ChevronLeft, ChevronRight
} from "lucide-react"

interface Teacher {
  id: string
  name: string
  loginAccount: string
  department: string
  orgNodeId?: string
  roles: string[]
  positions: string[]
  status: "在职" | "离职" | "外聘" | "禁用"
}

function mapTeacherStatus(status: string): Teacher["status"] {
  if (status === "active") return "在职"
  if (status === "inactive") return "离职"
  if (status === "disabled") return "禁用"
  return "外聘"
}

function toBackendStatus(status: Teacher["status"]): string {
  if (status === "在职") return "active"
  if (status === "离职") return "inactive"
  if (status === "禁用") return "disabled"
  if (status === "外聘") return "active"
  return "active"
}

export default function TeachersPage() {
  const { institution, institutionId, tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const { users, roles: tenantRoles, total, page, pageSize, setPage, loading, error, refetch } = usePortalUsers({
    roleCode: "teacher",
    search: searchTerm || undefined,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const { orgs, orgMap, orgTypeMap, loading: orgLoading } = useOrgTree(tenantId)

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)

  const [formName, setFormName] = useState("")
  const [formUsername, setFormUsername] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formOrgNodeId, setFormOrgNodeId] = useState<string>("")
  const [formTitleIds, setFormTitleIds] = useState<string[]>([])
  const [staffTitles, setStaffTitles] = useState<StaffTitle[]>([])

  useEffect(() => {
    setTeachers(
      users.map((u) => {
        const orgNode = u.orgNodeId ? orgMap.get(u.orgNodeId) : undefined
        return {
          id: u.id,
          name: u.name,
          loginAccount: u.username || u.loginName || "",
          department: orgNode?.name || institution?.name || "—",
          orgNodeId: u.orgNodeId,
          roles: u.roleNames ?? [],
          positions: u.titleIds ?? [],
          status: mapTeacherStatus(u.status),
        }
      })
    )
  }, [users, institution, orgMap])

  useEffect(() => {
    if (!tenantId) return
    portalStaffTitleApi.list({ tenantId, limit: 1000 }).then((res) => {
      setStaffTitles(res.items)
    }).catch(() => {})
  }, [tenantId])

  const titleNameMap = useMemo(() => {
    const map = new Map<string, string>()
    staffTitles.forEach((t) => map.set(t.id, t.name))
    return map
  }, [staffTitles])

  const selectedOrgIds = useMemo(() => {
    if (!selectedOrgNodeId) return null
    return collectOrgSubtreeIds(orgMap, selectedOrgNodeId)
  }, [selectedOrgNodeId, orgMap])

  const filteredTeachers = teachers.filter((teacher) => {
    if (statusFilter !== "all" && teacher.status !== statusFilter) return false
    if (selectedOrgIds) {
      return !!teacher.orgNodeId && selectedOrgIds.has(teacher.orgNodeId)
    }
    return true
  })

  const resetForm = () => {
    setFormName("")
    setFormUsername("")
    setFormPassword("")
    setFormOrgNodeId("")
    setFormTitleIds([])
  }

  const openCreateDialog = () => {
    setSelectedTeacher(null)
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (teacher: Teacher) => {
    setSelectedTeacher(teacher)
    setFormName(teacher.name)
    setFormUsername(teacher.loginAccount)
    setFormPassword("")
    setFormOrgNodeId(teacher.orgNodeId || "")
    setFormTitleIds(teacher.positions)
    setIsDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedTeacher || !formName.trim() || !formUsername.trim()) return
    const original = users.find((u) => u.id === selectedTeacher.id)
    if (!original) {
      toast({ variant: "destructive", title: "保存失败", description: "未找到原始用户数据" })
      return
    }
    setSaving(true)
    try {
      await portalUserManagementApi.update(selectedTeacher.id, {
        institutionId: original.institutionId,
        orgNodeId: formOrgNodeId || undefined,
        majorId: original.majorId,
        role: original.role,
        loginName: formUsername.trim(),
        username: formUsername.trim(),
        name: formName.trim(),
        email: original.email,
        phone: original.phone,
        avatarUrl: original.avatarUrl,
        studentNo: original.studentNo,
        workId: original.workId,
        idCard: original.idCard,
        titleIds: formTitleIds,
      })
      toast({ title: "保存成功" })
      setIsDialogOpen(false)
      resetForm()
      setSelectedTeacher(null)
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "保存失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!tenantId) {
      toast({ variant: "destructive", title: "创建失败", description: "未获取到租户信息，请重新登录" })
      return
    }
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) return
    const teacherRole = tenantRoles.find((r) => r.code === "teacher")
    if (!teacherRole) {
      toast({ variant: "destructive", title: "创建失败", description: "未找到教师角色，请先在角色管理中创建" })
      return
    }
    setSaving(true)
    try {
      await portalUserManagementApi.create({
        tenantId,
        institutionId,
        roleId: teacherRole.id,
        role: "school",
        platform: "portal",
        loginName: formUsername.trim(),
        username: formUsername.trim(),
        password: formPassword.trim(),
        name: formName.trim(),
        orgNodeId: formOrgNodeId || undefined,
        titleIds: formTitleIds.length > 0 ? formTitleIds : undefined,
      })
      toast({ title: "创建成功" })
      setIsDialogOpen(false)
      resetForm()
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "创建失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (teacher: Teacher, targetStatus: Teacher["status"]) => {
    try {
      await portalUserManagementApi.updateStatus(teacher.id, toBackendStatus(targetStatus))
      toast({ title: "状态已更新" })
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeleteTarget(id)
  }

  const confirmDeleteTeacher = async () => {
    if (!deleteTarget) return
    try {
      await portalUserManagementApi.delete(deleteTarget)
      toast({ title: "删除成功" })
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setDeleteTarget(null)
    }
  }

  const toggleSelectTeacher = (id: string) => {
    setSelectedTeachers((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedTeachers.length === filteredTeachers.length && filteredTeachers.length > 0) {
      setSelectedTeachers([])
    } else {
      setSelectedTeachers(filteredTeachers.map((t) => t.id))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedTeachers.length === 0) return
    if (!window.confirm(`确定要删除选中的 ${selectedTeachers.length} 名教师吗？此操作不可撤销。`)) return
    setBatchDeleting(true)
    try {
      await portalUserManagementApi.batchDelete(selectedTeachers)
      toast({ title: `成功删除 ${selectedTeachers.length} 名教师` })
    } catch (err) {
      toast({ variant: "destructive", title: "批量删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setBatchDeleting(false)
      setSelectedTeachers([])
    }
    await refetch()
  }

  const resetPassword = async (teacher: Teacher) => {
    const password = window.prompt(`请输入 ${teacher.name} 的新密码：`)
    if (!password) return
    try {
      await portalUserManagementApi.resetPassword(teacher.id, password)
      toast({ title: "密码重置成功" })
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "重置失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">教职工管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">维护教师档案信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" disabled={selectedTeachers.length === 0 || batchDeleting} onClick={handleBatchDelete}>
            {batchDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            {selectedTeachers.length > 0 ? `批量删除(${selectedTeachers.length})` : "批量删除"}
          </Button>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Upload className="h-4 w-4 mr-1" />导入
          </Button>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Download className="h-4 w-4 mr-1" />导出
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />新建教师
          </Button>
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

      <div className="flex gap-4 items-start">
        <div className="w-64 shrink-0 rounded-lg border border-gray-100 bg-white shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <FolderTree className="h-4 w-4 text-primary" />组织架构
          </h3>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              <button
                onClick={() => setSelectedOrgNodeId(null)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                  selectedOrgNodeId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                全部教职工
              </button>
              {orgLoading ? (
                <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 加载中...
                </div>
              ) : (
                <OrgFilterTree
                  nodes={orgs}
                  orgTypeMap={orgTypeMap}
                  selectedId={selectedOrgNodeId}
                  onSelect={setSelectedOrgNodeId}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 space-y-4">
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="搜索姓名或登录账号..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="在职">在职</SelectItem>
                  <SelectItem value="离职">离职</SelectItem>
                  <SelectItem value="外聘">外聘</SelectItem>
                  <SelectItem value="禁用">禁用</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />筛选
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTeachers.length === filteredTeachers.length && filteredTeachers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>登录账号（工号）</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>所属组织节点</TableHead>
                  <TableHead>关联角色</TableHead>
                  <TableHead>职位</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredTeachers.map((teacher) => (
                      <TableRow key={teacher.id} className="border-border">
                        <TableCell>
                          <Checkbox
                            checked={selectedTeachers.includes(teacher.id)}
                            onCheckedChange={() => toggleSelectTeacher(teacher.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{teacher.loginAccount}</TableCell>
                        <TableCell className="font-medium">{teacher.name}</TableCell>
                        <TableCell>{teacher.department}</TableCell>
                        <TableCell>
                          {teacher.roles.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {teacher.roles.map((role, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{role}</Badge>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {teacher.positions.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {teacher.positions.map((pos, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{titleNameMap.get(pos) || pos}</Badge>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={teacher.status === "在职" ? "default" : teacher.status === "禁用" ? "destructive" : "secondary"}>{teacher.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => changeStatus(teacher, "在职")}>
                                  {teacher.status !== "在职" ? "设为在职" : "✓ 在职"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => changeStatus(teacher, "离职")}>
                                  {teacher.status !== "离职" ? "设为离职" : "✓ 离职"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => changeStatus(teacher, "外聘")}>
                                  {teacher.status !== "外聘" ? "设为外聘" : "✓ 外聘"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => changeStatus(teacher, "禁用")}>
                                  {teacher.status !== "禁用" ? "设为禁用" : "✓ 禁用"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => resetPassword(teacher)}>
                                  重置密码
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteClick(teacher.id)} className="text-destructive">
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTeachers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          {searchTerm ? "未找到匹配的教职工" : "暂无教职工数据"}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条记录{selectedTeachers.length > 0 ? `，已选择 ${selectedTeachers.length} 条` : ""}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>{page} / {totalPages}</span>
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
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{selectedTeacher ? "编辑教师" : "新建教师"}</DialogTitle>
            <DialogDescription>{selectedTeacher ? "修改教职工基本信息" : "填写教职工基本信息"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>姓名 <span className="text-destructive">*</span></Label>
              <Input placeholder="请输入姓名" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>登录账号（工号） <span className="text-destructive">*</span></Label>
              <Input placeholder="如：T001" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} />
            </div>
            {!selectedTeacher && (
              <div className="grid gap-2">
                <Label>密码 <span className="text-destructive">*</span></Label>
                <Input type="text" placeholder="请输入密码" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
              </div>
            )}
            <div className="grid gap-2">
              <Label>所属组织节点</Label>
              <OrgNodePicker
                tenantId={tenantId}
                value={formOrgNodeId}
                onChange={(value) => setFormOrgNodeId(value || "")}
                placeholder="选择所属组织节点"
                title="选择所属组织节点"
              />
            </div>
            <div className="grid gap-2">
              <Label>职位</Label>
              <MultiSelectSearch
                options={staffTitles.map((t) => ({ label: t.name, value: t.id }))}
                selected={formTitleIds}
                onChange={setFormTitleIds}
                placeholder="选择职位"
                searchPlaceholder="搜索职位..."
                emptyText="未找到匹配的职位"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>取消</Button>
            <Button
              onClick={selectedTeacher ? handleUpdate : handleCreate}
              disabled={saving || !formName.trim() || !formUsername.trim() || (!selectedTeacher && !formPassword.trim())}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="确认删除"
        description="确定要删除该教职工吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDeleteTeacher}
      />
    </div>
  )
}
