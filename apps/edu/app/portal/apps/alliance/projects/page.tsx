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
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { StatusBadge } from "@/components/shared/status-badge"
import { PortalCrudPage } from "@/components/shared/portal-crud-page"
import type { AllianceProject, AllianceListResponse } from "@/lib/types"

export default function AllianceProjectsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    if (!tenantId) return
    setLoading(true); setError(null)
    try {
      const data = await portalRequest<AllianceListResponse<AllianceProject>>("/alliance/projects")
      setProjects(data.items || [])
    } catch (e: any) { setError(e.message || "加载失败") } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { if (authLoading || !tenantId) return; fetchProjects() }, [tenantId, authLoading, fetchProjects])

  return (
    <PortalCrudPage
      title="合作项目管理"
      description="管理校企合作项目，追踪项目阶段与里程碑。"
      entityLabel="合作项目"
      searchPlaceholder="搜索项目名称..."
      createButtonLabel="新增项目"
      items={projects}
      loading={loading}
      error={error}
      onRetry={fetchProjects}
      filterItems={(items, search) => items.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))}
      importConfig={{ importType: "alliance-projects", entityLabel: "合作项目", templateFileName: "合作项目批量导入模板.xlsx" }}
      colSpan={6}
      renderTableHeader={() => <><TableHead>项目名称</TableHead><TableHead>阶段</TableHead><TableHead>发布状态</TableHead><TableHead>开始日期</TableHead><TableHead>公开</TableHead><TableHead>操作</TableHead></>}
      renderTableRow={(p: any, actions: any) => (
        <>
          <TableCell className="font-medium">{p.name}</TableCell>
          <TableCell><StatusBadge status={p.phase} /></TableCell>
          <TableCell>{p.publishStatus === "published" ? "已发布" : "草稿"}</TableCell>
          <TableCell>{p.startDate || "-"}</TableCell>
          <TableCell>{p.isPublic ? "是" : "否"}</TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" onClick={actions.edit}><Pencil className="h-3.5 w-3.5 mr-1" />编辑</Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </TableRowActions>
        </>
      )}
      createDefault={() => ({ id: "", name: "", phase: "initiation", publishStatus: "draft", isPublic: false as any, createdAt: "", updatedAt: "" } as any)}
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid gap-2"><Label>项目名称 *</Label><Input value={item.name || ""} onChange={(e: any) => setItem({ ...item, name: e.target.value })} /></div>
          <div>
            <Label>阶段</Label>
            <Select value={item.phase || ""} onValueChange={(v: any) => setItem({ ...item, phase: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["initiation","execution","acceptance","closure","archived","terminated"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>开始日期</Label><Input type="date" value={item.startDate || ""} onChange={(e: any) => setItem({ ...item, startDate: e.target.value })} /></div>
            <div className="grid gap-2"><Label>结束日期</Label><Input type="date" value={item.endDate || ""} onChange={(e: any) => setItem({ ...item, endDate: e.target.value })} /></div>
          </div>
          <div className="grid gap-2"><Label>描述</Label><Textarea value={item.description || ""} onChange={(e: any) => setItem({ ...item, description: e.target.value })} rows={3} /></div>
        </div>
      )}
      getDeleteDescription={(item: any) => <>确定要删除项目 <b>{item.name}</b> 吗？</>}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) await portalRequest(`/alliance/projects/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        else await portalRequest("/alliance/projects", { method: "POST", body: JSON.stringify(item) })
        toast({ title: `项目已${isEdit ? "更新" : "创建"}` }); await fetchProjects()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/projects/${item.id}`, { method: "DELETE" }); toast({ title: "已删除" }); await fetchProjects()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
