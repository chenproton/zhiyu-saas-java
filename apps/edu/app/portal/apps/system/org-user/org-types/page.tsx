"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Pencil, Trash2, Search, Upload, Download, AlertCircle, MoreHorizontal } from "lucide-react"
import { orgTypeApi } from "@/lib/api"
import type { OrgType } from "@/lib/types/backend"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { useToast } from "@/hooks/use-toast"

const categoryLabels = { internal: "内部组织", business: "业务组织", external: "外部协作组织" }
const categoryColors = { internal: "bg-blue-100 text-blue-700", business: "bg-green-100 text-green-700", external: "bg-orange-100 text-orange-700" }

export default function OrgTypesPage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [orgTypes, setOrgTypes] = useState<OrgType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<OrgType | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState<string>("internal")
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = async () => {
    if (!tenantId) {
      setIsLoading(false)
      setError("未获取到租户信息，请重新登录")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await orgTypeApi.list({ tenantId, search: searchTerm || undefined, limit: 1000 })
      setOrgTypes(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载组织类型失败")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, searchTerm])

  const filteredTypes = orgTypes.filter((type) => type.name.includes(searchTerm))

  const deleteType = async (id: string) => {
    try {
      await orgTypeApi.delete(id)
      setOrgTypes((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除组织类型失败")
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">组织类型管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理组织架构中的节点类型</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" />
            批量导入
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            批量导出
          </Button>
          <Button size="sm" onClick={() => { setSelectedType(null); setFormName(""); setFormCategory("internal"); setIsDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" />
            新增类型
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索类型名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
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
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>类型名称</TableHead>
                  <TableHead>类型分类</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center">
                      <Empty className="h-full">
                        <EmptyHeader>
                          <EmptyTitle>暂无组织类型</EmptyTitle>
                          <EmptyDescription>
                            {searchTerm ? "未找到匹配的组织类型" : "当前租户下尚未创建组织类型"}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTypes.map((type) => (
                    <TableRow key={type.id} className="border-border">
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>
                        <Badge className={categoryColors[type.category]}>{categoryLabels[type.category]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{type.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedType(type); setFormName(type.name); setFormCategory(type.category); setIsDialogOpen(true) }}>
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteType(type.id)}>
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

          <div className="mt-4 text-sm text-muted-foreground">共 {filteredTypes.length} 条记录</div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedType ? "编辑类型" : "新增类型"}</DialogTitle>
            <DialogDescription>组织类型用于组织架构节点分类</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>类型名称</Label>
              <Input placeholder="如：二级学院" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>类型分类</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">内部组织</SelectItem>
                  <SelectItem value="business">业务组织</SelectItem>
                  <SelectItem value="external">外部协作组织</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>取消</Button>
            <Button disabled={isSaving || !formName.trim()} onClick={async () => {
              setIsSaving(true)
              try {
                if (selectedType) {
                  const updated = await orgTypeApi.update(selectedType.id, { name: formName.trim(), category: formCategory as OrgType["category"], tenantId: tenantId! })
                  setOrgTypes((prev) => prev.map((t) => t.id === updated.id ? updated : t))
                } else {
                  const created = await orgTypeApi.create({ name: formName.trim(), category: formCategory as OrgType["category"], tenantId: tenantId! })
                  setOrgTypes((prev) => [...prev, created])
                }
                setIsDialogOpen(false)
              } catch (err) {
                toast({ variant: "destructive", title: selectedType ? "保存失败" : "创建失败", description: err instanceof Error ? err.message : "保存组织类型失败" })
              } finally {
                setIsSaving(false)
              }
            }}>{isSaving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
