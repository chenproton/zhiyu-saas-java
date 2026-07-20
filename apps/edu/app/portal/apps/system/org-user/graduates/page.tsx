"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { usePortalUsers } from "@/hooks/use-portal-users"
import { useOrgTree, findOrgAncestor } from "@/hooks/use-org-tree"
import { OrgNodePicker } from "@/components/shared/org-node-picker"
import { portalUserManagementApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Search, Download, MoreHorizontal, RotateCcw, Loader2, Pencil } from "lucide-react"
import type { Organization } from "@/lib/types/backend"

const DEPT_TYPE = "二级学院"
const CLASS_TYPE = "班级"

interface DisplayGraduate {
  id: string
  name: string
  loginAccount: string
  className: string
  department: string
  orgNodeId?: string
  graduateYear?: number
}

function getOrgTypeName(org: Organization | undefined, orgTypeMap: Map<string, { name: string }>): string | undefined {
  if (!org) return undefined
  return orgTypeMap.get(org.typeId)?.name
}

export default function GraduatesPage() {
  const { institution, institutionId, tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const { users, loading, error, refetch } = usePortalUsers({
    roleCode: "student",
    status: "graduated",
    search: searchTerm || undefined,
  })
  const { orgs, orgMap, orgTypeMap, loading: orgLoading } = useOrgTree(tenantId)

  const [graduates, setGraduates] = useState<DisplayGraduate[]>([])
  const [yearFilter, setYearFilter] = useState("all")
  const [editingGraduate, setEditingGraduate] = useState<DisplayGraduate | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formUsername, setFormUsername] = useState("")
  const [formClassNodeId, setFormClassNodeId] = useState<string>("")

  useEffect(() => {
    setGraduates(
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
          graduateYear: u.graduateYear,
        }
      })
    )
  }, [users, institution, orgMap, orgTypeMap])

  const graduateYears = useMemo(() => {
    return [...new Set(graduates.map((g) => g.graduateYear).filter((y): y is number => y !== undefined))]
      .sort((a, b) => b - a)
      .map(String)
  }, [graduates])

  const filteredGraduates = useMemo(() => {
    return graduates.filter((g) => {
      if (yearFilter !== "all" && String(g.graduateYear) !== yearFilter) return false
      return true
    })
  }, [graduates, yearFilter])

  const openEditDialog = (graduate: DisplayGraduate) => {
    setEditingGraduate(graduate)
    setFormName(graduate.name)
    setFormUsername(graduate.loginAccount)
    setFormClassNodeId(graduate.orgNodeId || "")
    setIsDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingGraduate || !formName.trim() || !formUsername.trim()) return
    const original = users.find((u) => u.id === editingGraduate.id)
    if (!original) {
      toast({ variant: "destructive", title: "保存失败", description: "未找到原始用户数据" })
      return
    }
    setSaving(true)
    try {
      await portalUserManagementApi.update(editingGraduate.id, {
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
      setEditingGraduate(null)
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "保存失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const handleReEnroll = async (graduate: DisplayGraduate) => {
    try {
      await portalUserManagementApi.updateStatus(graduate.id, "active")
      toast({ title: "已恢复入学" })
      await refetch()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">毕业学生管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理已毕业学生的档案信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />导出
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/20 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <Loader2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">加载失败</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RotateCcw className="h-4 w-4 mr-1" />重试
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名或学号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="毕业年份" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部年份</SelectItem>
            {graduateYears.map((year) => (
              <SelectItem key={year} value={year}>
                {year}届
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>登录账号（学号）</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>所属院系</TableHead>
              <TableHead>班级</TableHead>
              <TableHead>毕业年份</TableHead>
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
                {filteredGraduates.map((graduate) => (
                  <TableRow key={graduate.id}>
                    <TableCell className="font-mono text-sm">{graduate.loginAccount}</TableCell>
                    <TableCell className="font-medium">{graduate.name}</TableCell>
                    <TableCell>{graduate.department}</TableCell>
                    <TableCell>{graduate.className}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{graduate.graduateYear !== undefined ? `${graduate.graduateYear}届` : "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>毕业</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(graduate)}>
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReEnroll(graduate)}>
                            重新入学
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredGraduates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchTerm || yearFilter !== "all" ? "未找到匹配的学生" : "暂无数据"}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>共 {filteredGraduates.length} 条记录</span>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>编辑学生</DialogTitle>
            <DialogDescription>修改学生基本信息与班级归属</DialogDescription>
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
              onClick={handleUpdate}
              disabled={saving || !formName.trim() || !formUsername.trim() || !formClassNodeId}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
