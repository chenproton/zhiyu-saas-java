"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalStaffTitleApi, portalUserManagementApi, type User } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Plus, MoreHorizontal, Pencil, Power, Trash2, Search, Upload, Download, Eye, AlertCircle, Loader2, RotateCcw } from "lucide-react"
import type { StaffTitle } from "@/lib/types/backend"

export default function PositionsPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [positions, setPositions] = useState<StaffTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<StaffTitle | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogName, setDialogName] = useState("")
  const [dialogDescription, setDialogDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [titleUsers, setTitleUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const fetchPositions = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(undefined)
    try {
      const res = await portalStaffTitleApi.list({ tenantId, limit: 1000 })
      setPositions(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPositions()
  }, [tenantId])

  const filteredPositions = useMemo(() =>
    positions.filter((pos) => pos.name.includes(searchTerm) || (pos.description && pos.description.includes(searchTerm))),
    [positions, searchTerm]
  )

  const openDialog = (position: StaffTitle | null) => {
    setSelectedPosition(position)
    setDialogName(position?.name || "")
    setDialogDescription(position?.description || "")
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!tenantId) {
      toast({ variant: "destructive", title: "保存失败", description: "未获取到租户信息，请重新登录" })
      return
    }
    if (!dialogName.trim()) return
    setSaving(true)
    try {
      const payload = { tenantId, name: dialogName.trim(), description: dialogDescription.trim() || undefined }
      if (selectedPosition) {
        await portalStaffTitleApi.update(selectedPosition.id, payload)
        toast({ title: "保存成功", description: "职位信息已更新" })
      } else {
        await portalStaffTitleApi.create(payload as Omit<StaffTitle, "id" | "userCount" | "createdAt">)
        toast({ title: "创建成功", description: "新职位已添加" })
      }
      setIsDialogOpen(false)
      await fetchPositions()
    } catch (err) {
      toast({ variant: "destructive", title: "保存失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (position: StaffTitle) => {
    const nextStatus = position.status === "active" ? "inactive" : "active"
    try {
      await portalStaffTitleApi.toggleStatus(position.id, nextStatus)
      toast({ title: "状态已更新" })
      await fetchPositions()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const deletePosition = async (id: string) => {
    try {
      await portalStaffTitleApi.delete(id)
      toast({ title: "删除成功" })
      await fetchPositions()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const openUsersDialog = async (position: StaffTitle) => {
    setSelectedPosition(position)
    setIsUsersDialogOpen(true)
    setLoadingUsers(true)
    setTitleUsers([])
    try {
      const res = await portalUserManagementApi.list({ tenantId, limit: 1000 })
      const filtered = res.items.filter((u) => u.titleIds?.includes(position.id))
      setTitleUsers(filtered)
    } catch (err) {
      toast({ variant: "destructive", title: "加载用户失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setLoadingUsers(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">职位管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理系统职位信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" />
            导入
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
          <Button size="sm" onClick={() => openDialog(null)}>
            <Plus className="h-4 w-4 mr-1" />
            新增职位
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex items-center gap-4">
            <span className="flex-1">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchPositions}>
              <RotateCcw className="h-4 w-4 mr-1" />重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索职位名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>职位名称</TableHead>
              <TableHead>关联用户数量</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
                </TableCell>
              </TableRow>
            ) : filteredPositions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {searchTerm ? "未找到匹配的职位" : "暂无职位数据"}
                </TableCell>
              </TableRow>
            ) : (
              filteredPositions.map((position) => (
                <TableRow key={position.id} className="border-border">
                  <TableCell className="font-medium">{position.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{position.userCount} 人</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={position.status === "active" ? "default" : "secondary"}>
                      {position.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(position.createdAt).toLocaleString("zh-CN")}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDialog(position)}>
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openUsersDialog(position)}>
                          查看用户
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(position)}>
                          {position.status === "active" ? "停用" : "启用"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deletePosition(position.id)} className="text-destructive">
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

      <div className="mt-4 text-sm text-muted-foreground">共 {filteredPositions.length} 条记录</div>

      {/* 新增/编辑职位 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPosition ? "编辑职位" : "新增职位"}</DialogTitle>
            <DialogDescription>职位用于用户身份标识</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>职位名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：教授" value={dialogName} onChange={(e) => setDialogName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>描述</Label>
              <Input placeholder="可选描述" value={dialogDescription} onChange={(e) => setDialogDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !dialogName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看关联用户 */}
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
                  <div key={user.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
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
                  <p className="text-center text-sm text-muted-foreground">... 还有 {titleUsers.length - 5} 名用户</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUsersDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
