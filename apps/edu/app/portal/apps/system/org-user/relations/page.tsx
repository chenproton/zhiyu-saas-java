"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Search, Loader2 } from "lucide-react"
import { portalUserRelationApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { UserSelector } from "@/components/shared/user-selector"

const relationTypes = [
  { value: "superior", label: "上下级" },
  { value: "collaboration", label: "业务协同" },
  { value: "management", label: "管理关系" },
  { value: "service", label: "服务关系" },
  { value: "project", label: "项目参与" },
  { value: "external", label: "外部合作" },
]

const typeLabelMap: Record<string, string> = Object.fromEntries(
  relationTypes.map((t) => [t.value, t.label])
)

export default function RelationsPage() {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()
  const [relations, setRelations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [selectedInitiator, setSelectedInitiator] = useState("")
  const [selectedTarget, setSelectedTarget] = useState("")
  const [selectedType, setSelectedType] = useState("")
  const [saving, setSaving] = useState(false)

  const loadRelations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await portalUserRelationApi.list({ search: searchText || undefined })
      setRelations(res.items)
    } catch {
      toast({ variant: "destructive", title: "加载失败", description: "加载关系列表失败" })
    } finally {
      setLoading(false)
    }
  }, [searchText])

  useEffect(() => {
    loadRelations()
  }, [loadRelations])

  const handleCreate = async () => {
    if (!selectedInitiator || !selectedTarget || !selectedType) return
    setSaving(true)
    try {
      await portalUserRelationApi.create({
        initiatorId: selectedInitiator,
        targetId: selectedTarget,
        relationType: selectedType,
      })
      toast({ title: "创建成功" })
      setShowDialog(false)
      setSelectedInitiator("")
      setSelectedTarget("")
      setSelectedType("")
      setSearchText("")
      await loadRelations()
    } catch (err) {
      toast({ variant: "destructive", title: "创建失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await portalUserRelationApi.delete(id)
      toast({ title: "删除成功" })
      loadRelations()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索关系..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
        <Button onClick={() => setShowDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新增关系
        </Button>
      </div>

      <div className="bg-card rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">序号</TableHead>
              <TableHead>关系发起人</TableHead>
              <TableHead>所属部门</TableHead>
              <TableHead>关系目标人</TableHead>
              <TableHead>所属部门</TableHead>
              <TableHead>关系类型</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-32 text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : relations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              relations.map((relation, index) => (
                <TableRow key={relation.id} className="group">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{relation.initiatorName}</TableCell>
                  <TableCell className="text-muted-foreground">{relation.initiatorDept || "—"}</TableCell>
                  <TableCell className="font-medium">{relation.targetName}</TableCell>
                  <TableCell className="text-muted-foreground">{relation.targetDept || "—"}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                      {typeLabelMap[relation.relationType] || relation.relationType}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{relation.createdAt}</TableCell>
                  <TableCell className="text-right relative">
                    <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(relation.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增关系</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">关系发起人</label>
              <UserSelector
                value={selectedInitiator ? [selectedInitiator] : []}
                onChange={(ids) => setSelectedInitiator(ids[0] || "")}
                multiple={false}
                placeholder="搜索选择用户..."
                tenantId={tenantId}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">关系目标人</label>
              <UserSelector
                value={selectedTarget ? [selectedTarget] : []}
                onChange={(ids) => setSelectedTarget(ids[0] || "")}
                multiple={false}
                placeholder="搜索选择用户..."
                tenantId={tenantId}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">关系类型</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择关系类型" />
                </SelectTrigger>
                <SelectContent>
                  {relationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>取消</Button>
            <Button onClick={handleCreate} disabled={saving || !selectedInitiator || !selectedTarget || !selectedType}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
