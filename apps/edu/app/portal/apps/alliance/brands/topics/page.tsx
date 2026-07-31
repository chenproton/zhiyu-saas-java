"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Pencil, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { PortalCrudPage } from "@/components/shared/portal-crud-page"
import type { AllianceBrandTopic, AllianceListResponse } from "@/lib/types"

const LAYOUT_OPTIONS = [
  { value: "grid", label: "网格" },
  { value: "timeline", label: "时间线" },
  { value: "magazine", label: "杂志" },
]

export default function AllianceBrandTopicsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceBrandTopic[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await portalRequest<AllianceListResponse<AllianceBrandTopic>>("/alliance/brand-topics")
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
      title="品牌专题页管理"
      description="管理品牌聚合专题展示"
      entityLabel="品牌专题"
      searchPlaceholder="搜索专题名称..."
      createButtonLabel="新增专题"
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchItems}
      filterItems={(filtered, search) =>
        filtered.filter((t) =>
          !search ||
          t.name.toLowerCase().includes(search.toLowerCase())
        )
      }
      importConfig={{ importType: "alliance-brand-topics", entityLabel: "品牌专题", templateFileName: "品牌专题批量导入模板.xlsx" }}
      colSpan={5}
      renderTableHeader={() => (
        <>
          <TableHead>名称</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>布局</TableHead>
          <TableHead>推荐</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => (
        <>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell><StatusBadge status={item.status} /></TableCell>
          <TableCell>{LAYOUT_OPTIONS.find((l) => l.value === item.layout)?.label || item.layout}</TableCell>
          <TableCell>{item.isRecommended ? "是" : "否"}</TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/brands/topics/${item.id}/edit`}>
              <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" />编辑</Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </TableRowActions>
        </>
      )}
      createDefault={() => ({
        id: "",
        name: "",
        status: "draft",
        layout: "grid",
        theme: "",
        description: "",
        coverImage: "",
        isRecommended: false as any,
        enabled: true as any,
        createdAt: "",
        updatedAt: "",
      } as AllianceBrandTopic & { enabled?: boolean })}
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
            <Label>布局</Label>
            <Select value={item.layout || "grid"} onValueChange={(v: any) => setItem({ ...item, layout: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>主题</Label>
            <Input value={item.theme || ""} onChange={(e: any) => setItem({ ...item, theme: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>描述</Label>
            <Textarea value={item.description || ""} onChange={(e: any) => setItem({ ...item, description: e.target.value })} rows={3} />
          </div>
          <div className="grid gap-2">
            <Label>封面图 URL</Label>
            <Input value={item.coverImage || ""} onChange={(e: any) => setItem({ ...item, coverImage: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={item.isRecommended || false} onCheckedChange={(v: any) => setItem({ ...item, isRecommended: v })} />
            <Label>推荐</Label>
          </div>
        </div>
      )}
      getDeleteDescription={(item: any) => (<>确定要删除专题「{item.name}」吗？</>)}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await portalRequest(`/alliance/brand-topics/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        } else {
          await portalRequest("/alliance/brand-topics", { method: "POST", body: JSON.stringify(item) })
        }
        toast({ title: `专题已${isEdit ? "更新" : "创建"}` })
        await fetchItems()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/brand-topics/${item.id}`, { method: "DELETE" })
        toast({ title: "专题已删除" })
        await fetchItems()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
