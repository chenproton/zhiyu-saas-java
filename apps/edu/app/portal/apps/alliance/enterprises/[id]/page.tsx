"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest, buildQuery } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableCell, TableHead } from "@/components/ui/table"
import { TableRowActions } from "@/components/shared/table-row-actions"
import {
  type AllianceEnterprise,
  type AllianceEnterpriseAgreement,
  type AllianceProject,
  type AllianceAchievement,
  type AllianceListResponse,
} from "@/lib/types"

export default function AllianceEnterpriseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [enterprise, setEnterprise] = useState<AllianceEnterprise | null>(null)
  const [agreements, setAgreements] = useState<AllianceEnterpriseAgreement[]>([])
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("info")

  useEffect(() => {
    if (!tenantId || !id) return
    
    Promise.all([
      portalRequest<AllianceEnterprise>(`/alliance/enterprises/${id}`),
      portalRequest<AllianceListResponse<AllianceEnterpriseAgreement>>(`/alliance/enterprises/${id}/agreements`),
      portalRequest<AllianceListResponse<AllianceProject>>(`/alliance/projects?search=`),
      portalRequest<AllianceListResponse<AllianceAchievement>>(`/alliance/achievements`),
    ]).then(([ent, agr, proj, ach]) => {
      setEnterprise(ent)
      setAgreements(agr.items || [])
      setProjects(proj.items?.filter((p: AllianceProject) => (p.enterpriseIds as any)?.includes?.(id)) || [])
      setAchievements(ach.items?.filter((a: AllianceAchievement) => (a.enterpriseIds as any)?.includes?.(id)) || [])
    }).catch((e) => {
      toast({ title: "加载失败", description: e.message, variant: "destructive" })
    }).finally(() => setLoading(false))
  }, [tenantId, id, toast])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!enterprise) return <div className="text-center py-12 text-muted-foreground">企业不存在</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-1" />返回</Button>
        <h1 className="text-2xl font-bold">{enterprise.name}</h1>
        <StatusBadge status={enterprise.status} />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => router.push(`/portal/apps/alliance/enterprises/${id}/edit`)}>
          <Pencil className="h-4 w-4 mr-1" />编辑
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0">
        {["info", "agreements", "projects", "achievements"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {{info: "基本信息", agreements: "合作协议", projects: "合作项目", achievements: "合作成果"}[t]}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">企业类型：</span>{enterprise.enterpriseType === "platform" ? "平台企业" : "校本企业"}</p>
              <p><span className="text-muted-foreground">所属行业：</span>{enterprise.industry || "-"}</p>
              <p><span className="text-muted-foreground">所在地区：</span>{enterprise.region || "-"}</p>
              <p><span className="text-muted-foreground">合作评级：</span>{enterprise.rating || "-"}</p>
              <p><span className="text-muted-foreground">公开显示：</span>{enterprise.isPublic ? "是" : "否"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>联系信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">联系人：</span>{enterprise.contactPerson || "-"}</p>
              <p><span className="text-muted-foreground">电话：</span>{enterprise.contactPhone || "-"}</p>
              <p><span className="text-muted-foreground">邮箱：</span>{enterprise.contactEmail || "-"}</p>
              <p><span className="text-muted-foreground">地址：</span>{enterprise.address || "-"}</p>
            </CardContent>
          </Card>
          {enterprise.description && (
            <Card className="col-span-2">
              <CardHeader><CardTitle>企业描述</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{enterprise.description}</p></CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "agreements" && (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr><TableHead>协议名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>起止日期</TableHead></tr>
            </thead>
            <tbody>
              {agreements.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">暂无合作协议</td></tr>
              ) : agreements.map((a) => (
                <tr key={a.id} className="border-b"><TableCell>{a.name}</TableCell><TableCell>{a.type || "-"}</TableCell><TableCell><StatusBadge status={a.status} /></TableCell><TableCell>{a.startDate || "-"} ~ {a.endDate || "-"}</TableCell></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "projects" && (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr><TableHead>项目名称</TableHead><TableHead>阶段</TableHead><TableHead>发布时间</TableHead></tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">暂无合作项目</td></tr>
              ) : projects.map((p) => (
                <tr key={p.id} className="border-b"><TableCell className="font-medium">{p.name}</TableCell><TableCell><StatusBadge status={p.phase} /></TableCell><TableCell>{p.startDate || "-"}</TableCell></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "achievements" && (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr><TableHead>成果名称</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead></tr>
            </thead>
            <tbody>
              {achievements.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">暂无合作成果</td></tr>
              ) : achievements.map((a) => (
                <tr key={a.id} className="border-b"><TableCell className="font-medium">{a.title}</TableCell><TableCell>{a.type}</TableCell><TableCell><StatusBadge status={a.status} /></TableCell></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
