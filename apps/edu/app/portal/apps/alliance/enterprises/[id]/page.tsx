"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TableCell, TableHead } from "@/components/ui/table"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { allianceLabel } from "@zhiyu/shared-types"
import { AllianceDetailShell } from "@/components/shared/alliance-detail-shell"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import type {
  AllianceEnterprise,
  AllianceEnterpriseAgreement,
  AllianceProject,
  AllianceAchievement,
  AllianceListResponse,
} from "@/lib/types"

export default function AllianceEnterpriseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [enterprise, setEnterprise] = useState<AllianceEnterprise | null>(null)
  const [agreements, setAgreements] = useState<AllianceEnterpriseAgreement[]>([])
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [savingA, setSavingA] = useState(false)
  const [agreementDialog, setAgreementDialog] = useState<{
    open: boolean; edit?: AllianceEnterpriseAgreement
  }>({ open: false })
  const [aForm, setAForm] = useState({
    name: "", type: "", startDate: "", endDate: "", status: "draft",
  })

  const loadData = () => {
    if (!tenantId || !id) return
    Promise.all([
      portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`),
      portalRequest<AllianceListResponse<AllianceEnterpriseAgreement>>(`/alliance/enterprises/${id}/agreements`),
      portalRequest<AllianceListResponse<AllianceProject>>(`/alliance/projects?limit=1000`),
      portalRequest<AllianceListResponse<AllianceAchievement>>(`/alliance/achievements?limit=1000`),
    ])
      .then(([ent, agr, proj, ach]) => {
        setEnterprise(ent)
        setAgreements(agr.items || [])
        setProjects(proj.items?.filter((p: AllianceProject) => (p.enterpriseIds as any)?.includes?.(id)) || [])
        setAchievements(ach.items?.filter((a: AllianceAchievement) => (a.enterpriseIds as any)?.includes?.(id)) || [])
      })
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadData() }, [tenantId, id]) // eslint-disable-line

  const openAForm = (a?: AllianceEnterpriseAgreement) => {
    setAForm(a ? {
      name: a.name, type: a.type || "", startDate: a.startDate || "",
      endDate: a.endDate || "", status: a.status,
    } : { name: "", type: "", startDate: "", endDate: "", status: "draft" })
    setAgreementDialog({ open: true, edit: a })
  }
  const saveAgreement = async () => {
    setSavingA(true)
    try {
      const edit = agreementDialog.edit
      if (edit) {
        await portalRequest(`/alliance/enterprises/${id}/agreements/${edit.id}`, {
          method: "PUT", body: JSON.stringify({ ...edit, ...aForm }),
        })
        toast({ title: "协议已更新" })
      } else {
        await portalRequest(`/alliance/enterprises/${id}/agreements`, {
          method: "POST", body: JSON.stringify(aForm),
        })
        toast({ title: "协议已创建" })
      }
      setAgreementDialog({ open: false })
      loadData()
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" })
    } finally { setSavingA(false) }
  }
  const deleteAgreement = async (aid: string) => {
    try {
      await portalRequest(`/alliance/enterprises/${id}/agreements/${aid}`, { method: "DELETE" })
      toast({ title: "已删除" })
      loadData()
    } catch (e: any) {
      toast({ title: "删除失败", description: e.message, variant: "destructive" })
    }
  }

  if (!enterprise && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/enterprises" />
  }

  const tabs = [
    {
      key: "info", label: "基本信息",
      content: (
        <div className="grid grid-cols-2 gap-6">
          <Card><CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">企业类型：</span>{allianceLabel("enterpriseType", enterprise?.enterpriseType)}</p>
              <p><span className="text-muted-foreground">所属行业：</span>{enterprise?.industry || "-"}</p>
              <p><span className="text-muted-foreground">所在地区：</span>{enterprise?.region || "-"}</p>
              <p><span className="text-muted-foreground">合作评级：</span>{allianceLabel("enterpriseRating", enterprise?.rating)}</p>
              <p><span className="text-muted-foreground">公开显示：</span>{enterprise?.isPublic ? "是" : "否"}</p>
            </CardContent></Card>
          <Card><CardHeader><CardTitle>联系信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">联系人：</span>{enterprise?.contactPerson || "-"}</p>
              <p><span className="text-muted-foreground">电话：</span>{enterprise?.contactPhone || "-"}</p>
              <p><span className="text-muted-foreground">邮箱：</span>{enterprise?.contactEmail || "-"}</p>
              <p><span className="text-muted-foreground">地址：</span>{enterprise?.address || "-"}</p>
            </CardContent></Card>
          {enterprise?.description && (
            <Card className="col-span-2"><CardHeader><CardTitle>企业描述</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{enterprise.description}</p></CardContent></Card>
          )}
        </div>
      ),
    },
    {
      key: "agreements", label: "合作协议", badge: agreements.length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openAForm()}><Plus className="h-4 w-4 mr-1" />新增协议</Button>
          </div>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr><TableHead>协议名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>起止日期</TableHead><TableHead>操作</TableHead></tr>
              </thead>
              <tbody>
                {agreements.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">暂无合作协议</td></tr>
                ) : agreements.map((a) => (
                  <tr key={a.id} className="border-b">
                    <TableCell>{a.name}</TableCell><TableCell>{a.type || "-"}</TableCell>
                    <TableCell>{allianceLabel("agreementStatus", a.status)}</TableCell>
                    <TableCell>{a.startDate || "-"} ~ {a.endDate || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openAForm(a)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteAgreement(a.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      key: "projects", label: "合作项目", badge: projects.length,
      content: (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr><TableHead>项目名称</TableHead><TableHead>阶段</TableHead><TableHead>开始日期</TableHead></tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">暂无合作项目</td></tr>
              ) : projects.map((p) => (
                <tr key={p.id} className="border-b">
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{allianceLabel("projectPhase", p.phase)}</TableCell>
                  <TableCell>{p.startDate || "-"}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "achievements", label: "合作成果", badge: achievements.length,
      content: (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr><TableHead>成果名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead></tr>
            </thead>
            <tbody>
              {achievements.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">暂无合作成果</td></tr>
              ) : achievements.map((a) => (
                <tr key={a.id} className="border-b">
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{allianceLabel("achievementType", a.type)}</TableCell>
                  <TableCell>{allianceLabel("achievementStatus", a.status)}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
  ]

  return (
    <>
      <AllianceDetailShell
        title={enterprise?.name || ""}
        statusBadge={enterprise ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{allianceLabel("enterpriseStatus", enterprise.status)}</span> : undefined}
        backHref="/portal/apps/alliance/enterprises"
        editHref={`/portal/apps/alliance/enterprises/${id}/edit`}
        tabs={tabs}
        defaultTab="info"
        loading={loading}
      />

      <Dialog open={agreementDialog.open} onOpenChange={(o) => !o && setAgreementDialog({ open: false })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{agreementDialog.edit ? "编辑" : "新增"}协议</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>协议名称 *</Label><Input value={aForm.name} onChange={(e) => setAForm({ ...aForm, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>协议类型</Label><Input value={aForm.type} onChange={(e) => setAForm({ ...aForm, type: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select value={aForm.status} onValueChange={(v) => setAForm({ ...aForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="active">有效</SelectItem>
                  <SelectItem value="expired">失效</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>开始日期</Label><Input type="date" value={aForm.startDate} onChange={(e) => setAForm({ ...aForm, startDate: e.target.value })} /></div>
              <div className="grid gap-2"><Label>结束日期</Label><Input type="date" value={aForm.endDate} onChange={(e) => setAForm({ ...aForm, endDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgreementDialog({ open: false })}>取消</Button>
            <Button onClick={saveAgreement} disabled={savingA}>{savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
