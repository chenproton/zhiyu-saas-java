"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { allianceLabel } from "@zhiyu/shared-types"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { PortalCrudPage } from "@/components/shared/portal-crud-page"
import type { AllianceExpert, AllianceListResponse } from "@/lib/types"

export default function AllianceExpertsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [experts, setExperts] = useState<AllianceExpert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExperts = useCallback(async () => {
    if (!tenantId) return
    setLoading(true); setError(null)
    try {
      const data = await portalRequest<AllianceListResponse<AllianceExpert>>("/alliance/experts")
      setExperts(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading || !tenantId) return; fetchExperts() }, [tenantId, authLoading, fetchExperts])

  return (
    <PortalCrudPage
      title="专家资源库"
      description="管理产业专家与校企专家档案信息。"
      entityLabel="专家"
      searchPlaceholder="搜索姓名、头衔或行业..."
      createButtonLabel="新增专家"
      items={experts}
      loading={loading}
      error={error}
      onRetry={fetchExperts}
      filterItems={(items, search) => items.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.title || "").toLowerCase().includes(search.toLowerCase()) || (e.industry || "").toLowerCase().includes(search.toLowerCase()))}
      importConfig={{ importType: "alliance-experts", entityLabel: "专家资源", templateFileName: "专家资源批量导入模板.xlsx" }}
      createHref="/portal/apps/alliance/experts/new"
      colSpan={8}
      renderTableHeader={() => <><TableHead>姓名</TableHead><TableHead>头衔</TableHead><TableHead>职位</TableHead><TableHead>所属机构</TableHead><TableHead>行业</TableHead><TableHead>状态</TableHead><TableHead>评级</TableHead><TableHead>操作</TableHead></>}
      renderTableRow={(e: any, actions: any) => (
        <>
          <TableCell className="font-medium">
            <Link href={`/portal/apps/alliance/experts/${e.id}`} className="hover:underline">{e.name}</Link>
          </TableCell>
          <TableCell>{e.title || "-"}</TableCell>
          <TableCell>{e.position || "-"}</TableCell>
          <TableCell className="max-w-[160px]">{e.organization || "-"}</TableCell>
          <TableCell>{e.industry || "-"}</TableCell>
          <TableCell>{allianceLabel("expertStatus", e.status)}</TableCell>
          <TableCell>{allianceLabel("expertRating", e.rating)}</TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/experts/${e.id}`}>
              <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" />查看</Button>
            </Link>
            <Link href={`/portal/apps/alliance/experts/${e.id}/edit`}>
              <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" />编辑</Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </TableRowActions>
        </>
      )}
      createDefault={() => ({ id: "", name: "", status: "active", isPublic: false as any, createdAt: "", updatedAt: "" } as any)}
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>姓名 *</Label><Input value={item.name || ""} onChange={(e: any) => setItem({ ...item, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>头衔</Label><Input value={item.title || ""} onChange={(e: any) => setItem({ ...item, title: e.target.value })} /></div>
            <div className="grid gap-2"><Label>职位</Label><Input value={item.position || ""} onChange={(e: any) => setItem({ ...item, position: e.target.value })} /></div>
            <div className="grid gap-2"><Label>行业</Label><Input value={item.industry || ""} onChange={(e: any) => setItem({ ...item, industry: e.target.value })} /></div>
            <div className="grid gap-2"><Label>城市</Label><Input value={item.city || ""} onChange={(e: any) => setItem({ ...item, city: e.target.value })} /></div>
            <div>
              <Label>评级</Label>
              <Select value={item.rating || "copper"} onValueChange={(v: any) => setItem({ ...item, rating: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">金牌</SelectItem><SelectItem value="silver">银牌</SelectItem><SelectItem value="copper">铜牌</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2"><Label>简介</Label><Textarea value={item.introduction || ""} onChange={(e: any) => setItem({ ...item, introduction: e.target.value })} rows={3} /></div>
        </div>
      )}
      getDeleteDescription={(item: any) => <>确定要删除专家 <b>{item.name}</b> 吗？</>}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) await portalRequest(`/alliance/experts/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        else await portalRequest("/alliance/experts", { method: "POST", body: JSON.stringify(item) })
        toast({ title: `专家已${isEdit ? "更新" : "创建"}` }); await fetchExperts()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/experts/${item.id}`, { method: "DELETE" }); toast({ title: "已删除" }); await fetchExperts()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
