"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Pencil, Trash2, Plus, Loader2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery, type ListResponse } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Industry } from "@/lib/types/backend"

export default function IndustriesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null)
  const [dialogCode, setDialogCode] = useState("")
  const [dialogName, setDialogName] = useState("")
  const [dialogParentId, setDialogParentId] = useState("")
  const [dialogSortOrder, setDialogSortOrder] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Industry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchIndustries = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const res = await portalRequest<ListResponse<Industry>>(`/industries${buildQuery({ tenantId, limit: 1000 })}`)
      setIndustries(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载行业数据失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !tenantId) return
    fetchIndustries()
  }, [tenantId, authLoading])

  const parentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const ind of industries) {
      if (ind.parentId) {
        const parent = industries.find((i) => i.id === ind.parentId)
        map.set(ind.parentId, parent?.name ?? ind.parentId)
      }
    }
    return map
  }, [industries])

  const filteredIndustries = useMemo(
    () =>
      industries.filter((ind) => {
        if (!searchTerm) return true
        const parentName = ind.parentId ? parentMap.get(ind.parentId) : ""
        return (
          ind.name.includes(searchTerm) ||
          ind.code.includes(searchTerm) ||
          (parentName ?? "").includes(searchTerm)
        )
      }),
    [industries, searchTerm, parentMap]
  )

  const openCreateDialog = () => {
    setSelectedIndustry(null)
    setDialogCode("")
    setDialogName("")
    setDialogParentId("")
    setDialogSortOrder(0)
    setIsDialogOpen(true)
  }

  const openEditDialog = (industry: Industry) => {
    setSelectedIndustry(industry)
    setDialogCode(industry.code)
    setDialogName(industry.name)
    setDialogParentId(industry.parentId || "")
    setDialogSortOrder(industry.sortOrder)
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
      if (selectedIndustry) {
        await portalRequest(`/industries/${selectedIndustry.id}`, {
          method: "PUT",
          body: JSON.stringify({
            code: dialogCode.trim(),
            name: dialogName.trim(),
            parentId: dialogParentId || null,
            enabled: selectedIndustry.enabled,
            sortOrder: dialogSortOrder,
          }),
        })
        toast({ title: "保存成功", description: "行业信息已更新" })
      } else {
        await portalRequest("/industries", {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            code: dialogCode.trim(),
            name: dialogName.trim(),
            parentId: dialogParentId || null,
            enabled: true,
            sortOrder: dialogSortOrder,
          }),
        })
        toast({ title: "创建成功", description: "新行业已添加" })
      }
      setIsDialogOpen(false)
      await fetchIndustries()
    } catch (err) {
      toast({ variant: "destructive", title: selectedIndustry ? "保存失败" : "创建失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (industry: Industry) => {
    try {
      await portalRequest(`/industries/${industry.id}`, {
        method: "PUT",
        body: JSON.stringify({
          code: industry.code,
          name: industry.name,
          parentId: industry.parentId || null,
          enabled: !industry.enabled,
          sortOrder: industry.sortOrder,
        }),
      })
      toast({ title: !industry.enabled ? "已启用" : "已关闭" })
      await fetchIndustries()
    } catch (err) {
      toast({ variant: "destructive", title: "操作失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await portalRequest(`/industries/${deleteTarget.id}`, { method: "DELETE" })
      toast({ title: "删除成功" })
      setDeleteTarget(null)
      await fetchIndustries()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setDeleting(false)
    }
  }

  const candidateParents = useMemo(() => {
    if (selectedIndustry) {
      return industries.filter((i) => i.id !== selectedIndustry.id)
    }
    return industries
  }, [industries, selectedIndustry])

  return (
    <div className="p-6 min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">行业管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理行业分类，可为行业设置上级行业并启用/关闭</p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1" />
          新增行业
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索行业代码、名称或上级行业..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
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
                  <TableHead className="w-28">行业代码</TableHead>
                  <TableHead>行业名称</TableHead>
                  <TableHead>上级行业</TableHead>
                  <TableHead className="w-20 text-center">排序</TableHead>
                  <TableHead className="w-24 text-center">状态</TableHead>
                  <TableHead className="w-24 text-center">启用/关闭</TableHead>
                  <TableHead className="w-20 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIndustries.map((industry) => (
                  <TableRow key={industry.id} className="border-border group">
                    <TableCell className="font-mono text-sm">{industry.code}</TableCell>
                    <TableCell className="font-medium">{industry.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {industry.parentId ? (parentMap.get(industry.parentId) ?? industry.parentId) : <span className="text-gray-300">-</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{industry.sortOrder}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={industry.enabled ? "default" : "secondary"}>
                        {industry.enabled ? "已启用" : "已关闭"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={industry.enabled} onCheckedChange={() => toggleEnabled(industry)} />
                    </TableCell>
                    <TableCell className="text-right relative">
                      <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEditDialog(industry)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(industry)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredIndustries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      暂无行业数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">共 {filteredIndustries.length} 条记录</div>
        </>
      )}

      {/* 新增/编辑行业 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedIndustry ? "编辑行业" : "新增行业"}</DialogTitle>
            <DialogDescription>
              {selectedIndustry ? "修改行业信息" : "添加新行业"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>行业代码 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：IT" value={dialogCode} onChange={(e) => setDialogCode(e.target.value)} disabled={!!selectedIndustry} />
            </div>
            <div className="grid gap-2">
              <Label>行业名称 <span className="text-destructive">*</span></Label>
              <Input placeholder="如：信息技术" value={dialogName} onChange={(e) => setDialogName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>上级行业</Label>
              <Select value={dialogParentId || "__none__"} onValueChange={(val) => setDialogParentId(val === "__none__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="无（顶级行业）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">无（顶级行业）</SelectItem>
                  {candidateParents.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.name} ({ind.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>排序</Label>
              <Input type="number" placeholder="0" value={dialogSortOrder} onChange={(e) => setDialogSortOrder(Number(e.target.value) || 0)} />
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
              确定要删除行业 <span className="font-medium">{deleteTarget?.name}</span>（{deleteTarget?.code}）吗？此操作不可撤销。
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
