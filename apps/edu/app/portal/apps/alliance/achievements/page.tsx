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
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { allianceLabel } from "@zhiyu/shared-types"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { PortalCrudPage } from "@/components/shared/portal-crud-page"
import { Switch } from "@/components/ui/switch"
import type { AllianceAchievement, AllianceEnterprise, AllianceProject, AllianceListResponse } from "@/lib/types"

export default function AllianceAchievementsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AllianceAchievement[]>([])
  const [enterprises, setEnterprises] = useState<AllianceEnterprise[]>([])
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const [data, ents, projs] = await Promise.all([
        portalRequest<AllianceListResponse<AllianceAchievement>>("/alliance/achievements"),
        portalRequest<AllianceListResponse<AllianceEnterprise>>("/alliance/enterprises?limit=1000"),
        portalRequest<AllianceListResponse<AllianceProject>>("/alliance/projects?limit=1000"),
      ])
      setItems(data.items || [])
      setEnterprises(ents.items || [])
      setProjects(projs.items || [])
    } catch (e: any) {
      setError(e.message || "加载失败")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (authLoading || !tenantId) return
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await fetchItems()
    })()
  }, [tenantId, authLoading, fetchItems])

  return (
    <PortalCrudPage
      title="合作成果管理"
      description="管理校企合作产出的各类成果"
      entityLabel="合作成果"
      searchPlaceholder="搜索成果名称..."
      createButtonLabel="新增成果"
      items={items}
      loading={loading}
      error={error}
      onRetry={fetchItems}
      filterItems={(filtered, search) =>
        filtered.filter((a) =>
          !search ||
          a.title.toLowerCase().includes(search.toLowerCase())
        )
      }
      importConfig={{ importType: "alliance-achievements", entityLabel: "合作成果", templateFileName: "合作成果批量导入模板.xlsx" }}
      createHref="/portal/apps/alliance/achievements/new"
      colSpan={8}
      renderTableHeader={() => (
        <>
          <TableHead>成果名称</TableHead>
          <TableHead>前台展示</TableHead>
          <TableHead>合作企业</TableHead>
          <TableHead>关联项目</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>发布时间</TableHead>
          <TableHead>创建人</TableHead>
          <TableHead>操作</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => {
        const entIds: string[] = (item.enterpriseIds || []).map(String)
        const project = projects.find((p) => p.id === (item.projectIds || [])[0])
        return (
        <>
          <TableCell className="font-medium">
            <Link href={`/portal/apps/alliance/achievements/${item.id}`} className="hover:underline">{item.title}</Link>
          </TableCell>
          <TableCell><Switch checked={item.isPublic || false} onCheckedChange={actions.toggle} /></TableCell>
          <TableCell className="max-w-[160px]">{entIds.length > 0 ? entIds.map((eid) => enterprises.find((e) => e.id === eid)?.name || eid).join("、") : "-"}</TableCell>
          <TableCell>{project?.name || "-"}</TableCell>
          <TableCell>{allianceLabel("achievementType", item.type)}</TableCell>
          <TableCell>{item.achievementDate ? new Date(item.achievementDate).toLocaleDateString("zh-CN") : "-"}</TableCell>
          <TableCell>{item.createdBy || "-"}</TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/achievements/${item.id}`}>
              <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" />查看</Button>
            </Link>
            <Link href={`/portal/apps/alliance/achievements/${item.id}/edit`}>
              <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" />编辑</Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </TableRowActions>
        </>
        )
      }}
      createDefault={() => ({
        id: "",
        title: "",
        type: "custom",
        status: "draft",
        isPublic: false as any,
        description: "",
        coverImage: "",
        viewCount: 0,
        enabled: true as any,
        createdAt: "",
        updatedAt: "",
      } as AllianceAchievement & { enabled?: boolean })}
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>成果标题 *</Label>
            <Input value={item.title || ""} onChange={(e: any) => setItem({ ...item, title: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>成果类型</Label>
            <Select value={item.type || "custom"} onValueChange={(v: any) => setItem({ ...item, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="job">岗位成果</SelectItem>
                <SelectItem value="scene">场景成果</SelectItem>
                <SelectItem value="course">课程成果</SelectItem>
                <SelectItem value="custom">自定义</SelectItem>
              </SelectContent>
            </Select>
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
            <Textarea value={item.description || ""} onChange={(e: any) => setItem({ ...item, description: e.target.value })} rows={4} />
          </div>
          <div className="grid gap-2">
            <Label>封面图 URL</Label>
            <Input value={item.coverImage || ""} onChange={(e: any) => setItem({ ...item, coverImage: e.target.value })} placeholder="https://..." />
          </div>
        </div>
      )}
      getDeleteDescription={(item: any) => (<>确定要删除成果「{item.title}」吗？</>)}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await portalRequest(`/alliance/achievements/${item.id}`, { method: "PUT", body: JSON.stringify(item) })
        } else {
          await portalRequest("/alliance/achievements", { method: "POST", body: JSON.stringify(item) })
        }
        toast({ title: `成果已${isEdit ? "更新" : "创建"}` })
        await fetchItems()
      }}
      onDelete={async (item: any) => {
        await portalRequest(`/alliance/achievements/${item.id}`, { method: "DELETE" })
        toast({ title: "成果已删除" })
        await fetchItems()
      }}
      onToggleEnabled={async () => {}}
    />
  )
}
