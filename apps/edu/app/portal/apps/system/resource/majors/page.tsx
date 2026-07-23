"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, Pencil, Trash2, Plus, Loader2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery, type ListResponse } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Major } from "@/lib/types/backend"

export default function MajorsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [majors, setMajors] = useState<Major[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedMajor, setSelectedMajor] = useState<Major | null>(null)
  const [dialogCode, setDialogCode] = useState("")
  const [dialogName, setDialogName] = useState("")
  const [dialogAlias, setDialogAlias] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Major | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchMajors = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalRequest<ListResponse<Major>>(`/majors${buildQuery({ tenantId, limit: 1000 })}`)
      setMajors(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载专业数据失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !tenantId) return
    fetchMajors()
  }, [tenantId, authLoading])

  const filteredMajors = useMemo(
    () =>
      majors.filter((major) =>
        major.name.includes(searchTerm) || major.code.includes(searchTerm) || (major.alias ?? "").includes(searchTerm)
      ),
    [majors, searchTerm]
  )

  const openCreateDialog = () => {
    setSelectedMajor(null)
    setDialogCode("")
    setDialogName("")
    setDialogAlias("")
    setIsDialogOpen(true)
  }

  const openEditDialog = (major: Major) => {
    setSelectedMajor(major)
    setDialogCode(major.code)
    setDialogName(major.name)
    setDialogAlias(major.alias || "")
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!tenantId) {
      toast({ variant: "destructive", title: "保存失败", description: "未获取到租户信息，请重新登录" })
      return
    }
    if (!dialogCode.trim() || !dialogName.trim()) return
    setSaving(true)
    try {
      if (selectedMajor) {
        await portalRequest(`/majors/${selectedMajor.id}`, {
          method: "PUT",
          body: JSON.stringify({
            code: dialogCode.trim(),
            name: dialogName.trim(),
            alias: dialogAlias.trim() || null,
            enabled: selectedMajor.enabled,
          }),
        })
        toast({ title: "保存成功", description: "专业信息已更新" })
      } else {
        await portalRequest("/majors", {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            code: dialogCode.trim(),
            name: dialogName.trim(),
            alias: dialogAlias.trim() || null,
            enabled: true,
          }),
        })
        toast({ title: "创建成功", description: "新专业已添加" })
      }
      setIsDialogOpen(false)
      await fetchMajors()
    } catch (err) {
      toast({ variant: "destructive", title: selectedMajor ? "保存失败" : "创建失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (major: Major) => {
    try {
      await portalRequest(`/majors/${major.id}`, {
        method: "PUT",
        body: JSON.stringify({
          code: major.code,
          name: major.name,
          alias: major.alias || null,
          enabled: !major.enabled,
        }),
      })
      toast({ title: !major.enabled ? "已启用" : "已关闭" })
      await fetchMajors()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await portalRequest(`/majors/${deleteTarget.id}`, { method: "DELETE" })
      toast({ title: "删除成功" })
      setDeleteTarget(null)
      await fetchMajors()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">专业管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理教育专业，可为专业配置别名并启用/关闭</p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1" />
          新增专业
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索专业代码、名称或别名..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && (
        <>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-28">专业代码</TableHead>
                  <TableHead>专业名称</TableHead>
                  <TableHead>别名（备注）</TableHead>
                  <TableHead className="w-24 text-center">状态</TableHead>
                  <TableHead className="w-24 text-center">启用/关闭</TableHead>
                  <TableHead className="w-20 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMajors.map((major) => (
                  <TableRow key={major.id} className="border-border group">
                    <TableCell className="font-mono text-sm">{major.code}</TableCell>
                    <TableCell className="font-medium">{major.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {major.alias || <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={major.enabled ? "default" : "secondary"}>
                        {major.enabled ? "已启用" : "已关闭"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={major.enabled} onCheckedChange={() => toggleEnabled(major)} />
                    </TableCell>
                    <TableCell className="text-right relative">
                      <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEditDialog(major)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(major)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMajors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      暂无专业数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">共 {filteredMajors.length} 条记录</div>
        </>
      )}

      {/* 新增/编辑专业 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMajor ? "编辑专业" : "新增专业"}</DialogTitle>
            <DialogDescription>
              {selectedMajor ? "修改专业信息" : "添加新专业"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>专业代码 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：CS101" value={dialogCode} onChange={(e) => setDialogCode(e.target.value)} disabled={!!selectedMajor} />
            </div>
            <div className="grid gap-2">
              <Label>专业名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：计算机科学与技术" value={dialogName} onChange={(e) => setDialogName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>别名（备注）</Label>
              <Input placeholder="输入专业别名或备注" value={dialogAlias} onChange={(e) => setDialogAlias(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !dialogCode.trim() || !dialogName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除专业 <span className="font-medium">{deleteTarget?.name}</span>（{deleteTarget?.code}）吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
