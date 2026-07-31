"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Trash2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { PortalCrudPage } from "@/components/shared/portal-crud-page"
import type { AllianceAgreement, AllianceListResponse } from "@/lib/types"

export default function AllianceAgreementsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceAgreement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await portalRequest<AllianceListResponse<AllianceAgreement>>("/alliance/agreements")
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
      title="合作协议管理"
      description="管理校企合作协议的独立记录"
      entityLabel="合作协议"
      searchPlaceholder="搜索协议名称..."
      createButtonLabel="新增协议"
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchItems}
      filterItems={(filtered, search) =>
        filtered.filter((a) =>
          !search ||
          a.name.toLowerCase().includes(search.toLowerCase())
        )
      }
      importConfig={{ importType: "alliance-agreements" as any, entityLabel: "合作协议" as any, templateFileName: "" as any } as any}
      colSpan={5}
      renderTableHeader={() => (
        <>
          <TableHead>协议名称</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>起止日期</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => (
        <>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>{item.type || "-"}</TableCell>
          <TableCell><StatusBadge status={item.status} /></TableCell>
          <TableCell>{item.startDate || "-"} ~ {item.endDate || "-"}</TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" onClick={actions.edit}><Pencil className="h-3.5 w-3.5 mr-1" />编辑</Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </TableRowActions>
        </>
      )}
      createDefault={() => ({
        id: "",
        name: "",
        type: "",
        status: "draft",
        startDate: "",
        endDate: "",
        content: "",
        enabled: true as any,
        createdAt: "",
        updatedAt: "",
      } as AllianceAgreement & { enabled?: boolean })}
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>协议名称 *</Label>
            <Input value={item.name || ""} onChange={(e: any) => setItem({ ...item, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>协议类型</Label>
            <Input value={item.type || ""} onChange={(e: any) => setItem({ ...item, type: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>状态</Label>
            <Select value={item.status || "draft"} onValueChange={(v: any) => setItem({ ...item, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="active">生效中</SelectItem>
                <SelectItem value="expired">已过期</SelectItem>
                <SelectItem value="renewed">已续签</SelectItem>
                <SelectItem value="terminated">已终止</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>开始日期</Label>
              <Input type="date" value={item.startDate || ""} onChange={(e: any) => setItem({ ...item, startDate: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>结束日期</Label>
              <Input type="date" value={item.endDate || ""} onChange={(e: any) => setItem({ ...item, endDate: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>协议内容</Label>
            <Textarea value={item.content || ""} onChange={(e: any) => setItem({ ...item, content: e.target.value })} rows={4} />
          </div>
        </div>
      )}
      getDeleteDescription={(item: any) => (<>确定要删除协议「{item.name}」吗？</>)}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await portalRequest(`/alliance/agreements/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        } else {
          await portalRequest("/alliance/agreements", { method: "POST", body: JSON.stringify(item) })
        }
        toast({ title: `协议已${isEdit ? "更新" : "创建"}` })
        await fetchItems()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/agreements/${item.id}`, { method: "DELETE" })
        toast({ title: "协议已删除" })
        await fetchItems()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
