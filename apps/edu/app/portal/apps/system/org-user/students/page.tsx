"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { usePortalUsers } from "@/hooks/use-portal-users"
import { useOrgTree, findOrgAncestor } from "@/hooks/use-org-tree"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { OrgFilterTree, collectOrgSubtreeIds } from "@/components/shared/org-filter-tree"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ResetPasswordDialog } from "@/components/shared/reset-password-dialog"
import { portalUserManagementApi } from "@/lib/api"
import type { Organization } from "@/lib/types/backend"
import { useToast } from "@/hooks/use-toast"
import {
  Plus, Power, Pencil, Trash2, Search, Filter, Upload, Download,
  FolderTree, Key, Loader2, AlertCircle, RotateCcw, Award, ChevronLeft, ChevronRight
} from "lucide-react"

const DEPT_TYPE = "二级学院"
const CLASS_TYPE = "班级"

interface Student {
  id: string
  name: string
  loginAccount: string
  className: string
  department: string
  orgNodeId?: string
  status: "在籍" | "休学" | "退学" | "毕业" | "结业"
}

const statusColor: Record<string, string> = {
  "在籍": "default",
  "休学": "secondary",
  "退学": "destructive",
  "毕业": "default",
  "结业": "secondary",
}

function mapStudentStatus(status: string): Student["status"] {
  if (status === "active") return "在籍"
  if (status === "inactive") return "休学"
  if (status === "disabled") return "退学"
  if (status === "graduated") return "毕业"
  if (status === "completed") return "结业"
  return "在籍"
}

function toBackendStatus(status: Student["status"]): string {
  if (status === "在籍") return "active"
  if (status === "休学") return "inactive"
  if (status === "退学") return "disabled"
  if (status === "毕业") return "graduated"
  if (status === "结业") return "completed"
  return "active"
}

function classBadge(variant: string) {
  if (variant === "destructive") return "destructive" as const
  if (variant === "secondary") return "secondary" as const
  return "default" as const
}

function getOrgTypeName(org: Organization | undefined, orgTypeMap: Map<string, { name: string }>): string | undefined {
  if (!org) return undefined
  return orgTypeMap.get(org.typeId)?.name
}

export default function StudentsPage() {
  const { institution, institutionId, tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const { users, roles: tenantRoles, total, page, pageSize, setPage, loading, error, refetch } = usePortalUsers({
    roleCode: "student",
    search: searchTerm || undefined,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const { orgs, orgMap, orgTypeMap, loading: orgLoading } = useOrgTree(tenantId)

  const [students, setStudents] = useState<Student[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("在籍")
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [graduateLoading, setGraduateLoading] = useState(false)
	const [batchDeleting, setBatchDeleting] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
	const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)

  const [formName, setFormName] = useState("")
  const [formUsername, setFormUsername] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formClassNodeId, setFormClassNodeId] = useState<string>("")

  useEffect(() => {
    setStudents(
      users.map((u) => {
        const classNode = u.orgNodeId ? orgMap.get(u.orgNodeId) : undefined
        const className = classNode?.name || "—"

        let departmentName = institution?.name || "—"
        if (classNode) {
          const deptNode = findOrgAncestor(orgMap, classNode.id, (org) => getOrgTypeName(org, orgTypeMap) === DEPT_TYPE)
          departmentName = deptNode?.name || institution?.name || "—"
        }

        return {
          id: u.id,
          name: u.name,
          loginAccount: u.username || u.loginName || "",
          className,
          department: departmentName,
          orgNodeId: u.orgNodeId,
          status: mapStudentStatus(u.status),
        }
      })
    )
  }, [users, institution, orgMap, orgTypeMap])

  const selectedOrgIds = useMemo(() => {
    if (!selectedOrgNodeId) return null
    return collectOrgSubtreeIds(orgMap, selectedOrgNodeId)
  }, [selectedOrgNodeId, orgMap])

  const filteredStudents = students.filter((student) => {
    if (statusFilter !== "all" && student.status !== statusFilter) return false
    if (selectedOrgIds) {
      return !!student.orgNodeId && selectedOrgIds.has(student.orgNodeId)
    }
    return true
  })

  const changeStatus = async (student: Student, targetStatus: Student["status"]) => {
    const backendStatus = toBackendStatus(targetStatus)
    try {
      await portalUserManagementApi.updateStatus(student.id, backendStatus)
      toast({ title: "状态已更新" })
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeleteTarget(id)
  }

  const confirmDeleteStudent = async () => {
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

  const resetPassword = (student: Student) => {
    setResetTarget({ id: student.id, name: student.name })
  }

  const toggleSelectStudent = (id: string) => {
    setSelectedStudents((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

	const toggleSelectAll = () => {
		if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
			setSelectedStudents([])
		} else {
			setSelectedStudents(filteredStudents.map((s) => s.id))
		}
	}

	const handleBatchGraduate = async () => {
		if (selectedStudents.length === 0 || !tenantId) return
		setGraduateLoading(true)
		try {
			await portalUserManagementApi.batchGraduate({ userIds: selectedStudents })
			toast({ title: "批量毕业成功", description: `已将 ${selectedStudents.length} 名学生状态改为毕业` })
			setSelectedStudents([])
			await refetch()
		} catch (err) {
			toast({ variant: "destructive", title: "批量毕业失败", description: err instanceof Error ? err.message : "未知错误" })
		} finally {
			setGraduateLoading(false)
		}
	}

	const handleBatchDelete = async () => {
		if (selectedStudents.length === 0) return
		if (!window.confirm(`确定要删除选中的 ${selectedStudents.length} 名学生吗？此操作不可撤销。`)) return
		setBatchDeleting(true)
		try {
			await portalUserManagementApi.batchDelete(selectedStudents)
			toast({ title: `成功删除 ${selectedStudents.length} 名学生` })
		} catch (err) {
			toast({ variant: "destructive", title: "批量删除失败", description: err instanceof Error ? err.message : "未知错误" })
		} finally {
			setBatchDeleting(false)
			setSelectedStudents([])
		}
		await refetch()
	}

  const resetForm = () => {
    setFormName("")
    setFormUsername("")
    setFormPassword("")
    setFormClassNodeId("")
  }

  const openCreateDialog = () => {
    setSelectedStudent(null)
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student)
    setFormName(student.name)
    setFormUsername(student.loginAccount)
    setFormPassword("")
    setFormClassNodeId(student.orgNodeId || "")
    setIsDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedStudent || !formName.trim() || !formUsername.trim()) return
    const original = users.find((u) => u.id === selectedStudent.id)
    if (!original) {
      toast({ variant: "destructive", title: "保存失败", description: "未找到原始用户数据" })
      return
    }
    setSaving(true)
    try {
      await portalUserManagementApi.update(selectedStudent.id, {
        institutionId: original.institutionId,
        orgNodeId: formClassNodeId || undefined,
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
        titleIds: original.titleIds,
      })
      toast({ title: "保存成功" })
      setIsDialogOpen(false)
      resetForm()
      setSelectedStudent(null)
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
    if (!formClassNodeId) {
      toast({ variant: "destructive", title: "创建失败", description: "请选择班级" })
      return
    }
    const studentRole = tenantRoles.find((r) => r.code === "student")
    if (!studentRole) {
      toast({ variant: "destructive", title: "创建失败", description: "未找到学生角色，请先在角色管理中创建" })
      return
    }
    setSaving(true)
    try {
      await portalUserManagementApi.create({
        tenantId,
        institutionId,
        roleId: studentRole.id,
        role: "school",
        platform: "portal",
        loginName: formUsername.trim(),
        username: formUsername.trim(),
        password: formPassword.trim(),
        name: formName.trim(),
        orgNodeId: formClassNodeId,
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

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">学生管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理学生基础信息与学籍数据</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Upload className="h-4 w-4 mr-1" />导入
          </Button>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Download className="h-4 w-4 mr-1" />导出
          </Button>
			<Button variant="outline" size="sm" disabled={selectedStudents.length === 0 || graduateLoading || batchDeleting} onClick={handleBatchGraduate}>
				{graduateLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Award className="h-4 w-4 mr-1" />}
				{selectedStudents.length > 0 ? `批量毕业(${selectedStudents.length})` : "批量毕业"}
			</Button>
			<Button variant="destructive" size="sm" disabled={selectedStudents.length === 0 || batchDeleting} onClick={handleBatchDelete}>
				{batchDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
				批量删除({selectedStudents.length})
			</Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />新生录入
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
                全部学生
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
                <Input placeholder="搜索姓名、登录账号..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="在籍">在籍</SelectItem>
                  <SelectItem value="休学">休学</SelectItem>
                  <SelectItem value="退学">退学</SelectItem>
                  <SelectItem value="毕业">毕业</SelectItem>
                  <SelectItem value="结业">结业</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />更多筛选
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>登录账号（学号）</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>所属院系</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id} className={cn("group", "border-border")}>
                        <TableCell>
                          <Checkbox checked={selectedStudents.includes(student.id)} onCheckedChange={() => toggleSelectStudent(student.id)} />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{student.loginAccount}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.department}</TableCell>
                        <TableCell>{student.className}</TableCell>
                        <TableCell>
                          <Badge variant={classBadge(statusColor[student.status])}>{student.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right relative">
                          <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEditDialog(student)}>
                              <Pencil className="mr-1 h-3 w-3" />
                              编辑
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => resetPassword(student)}>
                              <Key className="mr-1 h-3 w-3" />
                              重置密码
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => changeStatus(student, "在籍")}>
                              <Power className="mr-1 h-3 w-3" />
                              {student.status !== "在籍" ? "设为在籍" : "✓ 在籍"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => changeStatus(student, "休学")}>
                              <Power className="mr-1 h-3 w-3" />
                              {student.status !== "休学" ? "设为休学" : "✓ 休学"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => changeStatus(student, "退学")}>
                              <Power className="mr-1 h-3 w-3" />
                              {student.status !== "退学" ? "设为退学" : "✓ 退学"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => changeStatus(student, "毕业")}>
                              <Award className="mr-1 h-3 w-3" />
                              {student.status !== "毕业" ? "设为毕业" : "✓ 毕业"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={() => handleDeleteClick(student.id)}>
                              <Trash2 className="mr-1 h-3 w-3" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {searchTerm ? "未找到匹配的学生" : "暂无学生数据"}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条记录{selectedStudents.length > 0 && `，已选择 ${selectedStudents.length} 条`}</span>
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
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{selectedStudent ? "编辑学生" : "新生录入"}</DialogTitle>
            <DialogDescription>{selectedStudent ? "修改学生基本信息与班级归属" : "填写学生基本信息，并关联到真实班级"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>姓名 <span className="text-destructive">*</span></Label>
              <Input placeholder="请输入姓名" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>登录账号（学号） <span className="text-destructive">*</span></Label>
              <Input placeholder="如：S2024001" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} />
            </div>
            {!selectedStudent && (
              <div className="grid gap-2">
                <Label>密码 <span className="text-destructive">*</span></Label>
                <Input type="text" placeholder="请输入密码" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
              </div>
            )}
            <div className="grid gap-2">
              <Label>班级 <span className="text-destructive">*</span></Label>
              <OrgNodePicker
                tenantId={tenantId}
                value={formClassNodeId}
                onChange={(value) => {
                  setFormClassNodeId(value || "")
                }}
                selectableTypes={[CLASS_TYPE]}
                placeholder="选择班级"
                title="选择班级"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>取消</Button>
            <Button
              onClick={selectedStudent ? handleUpdate : handleCreate}
              disabled={saving || !tenantId || !formName.trim() || !formUsername.trim() || !formClassNodeId || (!selectedStudent && !formPassword.trim())}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
          {!saving && !formUsername.trim() && (
            <p className="text-xs text-muted-foreground">请填写登录账号（学号）</p>
          )}
          {!saving && formUsername.trim() && !formClassNodeId && (
            <p className="text-xs text-muted-foreground">请选择班级</p>
          )}
          {!saving && !selectedStudent && formUsername.trim() && formClassNodeId && !formPassword.trim() && (
            <p className="text-xs text-muted-foreground">请填写密码</p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="确认删除"
        description="确定要删除该学生吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDeleteStudent}
      />

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
