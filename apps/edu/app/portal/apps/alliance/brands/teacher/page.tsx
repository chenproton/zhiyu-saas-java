"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Pencil, Trash2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { PortalCrudPage } from "@/components/shared/portal-crud-page"
import type { AllianceBrand, AllianceListResponse } from "@/lib/types"

const brandType = "teacher"
const brandLabel = "师资品牌"
const brandDesc = "管理校本师资与产业导师"

export default function AllianceTeacherBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceBrand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await portalRequest<AllianceListResponse<AllianceBrand>>(`/alliance/brands?brandType=${brandType}`)
      setItems(data.items || [])
    } catch (e: any) {
      setError(e.message || "加载失败")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading || !tenantId) return
    fetchItems()
  }, [tenantId, authLoading, fetchItems])

  return (
    <PortalCrudPage
      title={`${brandLabel}管理`}
      description={brandDesc}
      entityLabel={brandLabel}
      searchPlaceholder="搜索品牌名称..."
      createButtonLabel="新增品牌"
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchItems}
      filterItems={(filtered, search) =>
        filtered.filter((b) =>
          !search ||
          b.name.toLowerCase().includes(search.toLowerCase())
        )
      }
      importConfig={{ importType: "alliance-brands" as any, entityLabel: brandLabel as any, templateFileName: "" as any } as any}
      colSpan={6}
      renderTableHeader={() => (
        <>
          <TableHead>名称</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>推荐</TableHead>
          <TableHead>公开</TableHead>
          <TableHead>浏览</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => (
        <>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell><StatusBadge status={item.status} /></TableCell>
          <TableCell>{item.isFeatured ? "是" : "否"}</TableCell>
          <TableCell>{item.isPublic ? "是" : "否"}</TableCell>
          <TableCell>{item.viewCount}</TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" onClick={actions.edit}><Pencil className="h-3.5 w-3.5 mr-1" />编辑</Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </TableRowActions>
        </>
      )}
      createDefault={() => ({
        id: "",
        name: "",
        brandType: brandType as any,
        status: "draft",
        description: "",
        coverImage: "",
        isPublic: false as any,
        isFeatured: false as any,
        viewCount: 0,
        enabled: true as any,
        createdAt: "",
        updatedAt: "",
      } as AllianceBrand & { enabled?: boolean })}
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>名称 *</Label>
            <Input value={item.name || ""} onChange={(e: any) => setItem({ ...item, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>状态</Label>
            <Select value={item.status || "draft"} onValueChange={(v: any) => setItem({ ...item, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>描述</Label>
            <Textarea value={item.description || ""} onChange={(e: any) => setItem({ ...item, description: e.target.value })} rows={3} />
          </div>
          <div className="grid gap-2">
            <Label>封面图 URL</Label>
            <Input value={item.coverImage || ""} onChange={(e: any) => setItem({ ...item, coverImage: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={item.isPublic || false} onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })} />
              <Label>公开显示</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={item.isFeatured || false} onCheckedChange={(v: any) => setItem({ ...item, isFeatured: v })} />
              <Label>推荐</Label>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>教师 ID</Label>
            <Input value={item.teacherId || ""} onChange={(e: any) => setItem({ ...item, teacherId: e.target.value })} placeholder="UUID (users表)" />
          </div>
          <div className="grid gap-2">
            <Label>专家 ID</Label>
            <Input value={item.expertId || ""} onChange={(e: any) => setItem({ ...item, expertId: e.target.value })} placeholder="UUID (alliance_experts表)" />
          </div>
        </div>
      )}
      getDeleteDescription={(item: any) => (<>确定要删除品牌「{item.name}」吗？</>)}
      onSave={async (item: any, isEdit: boolean) => {
        item.brandType = brandType
        if (isEdit) {
          await portalRequest(`/alliance/brands/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        } else {
          await portalRequest("/alliance/brands", { method: "POST", body: JSON.stringify(item) })
        }
        toast({ title: `品牌已${isEdit ? "更新" : "创建"}` })
        await fetchItems()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/brands/${item.id}`, { method: "DELETE" })
        toast({ title: "品牌已删除" })
        await fetchItems()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
