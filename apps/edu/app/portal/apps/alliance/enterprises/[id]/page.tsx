"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TableCell, TableHead } from "@/components/ui/table"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { StatusBadge } from "@/components/shared/status-badge"
import { AllianceDetailShell } from "@/components/shared/alliance-detail-shell"
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

  useEffect(() => {
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
      .catch((e) => {
        toast({ title: "加载失败", description: e.message, variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  if (!enterprise && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/enterprises" />
  }

  const tabs = [
    {
      key: "info",
      label: "基本信息",
      content: (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">企业类型：</span>{enterprise?.enterpriseType === "platform" ? "平台企业" : "校本企业"}</p>
              <p><span className="text-muted-foreground">所属行业：</span>{enterprise?.industry || "-"}</p>
              <p><span className="text-muted-foreground">所在地区：</span>{enterprise?.region || "-"}</p>
              <p><span className="text-muted-foreground">合作评级：</span>{enterprise?.rating || "-"}</p>
              <p><span className="text-muted-foreground">公开显示：</span>{enterprise?.isPublic ? "是" : "否"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>联系信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">联系人：</span>{enterprise?.contactPerson || "-"}</p>
              <p><span className="text-muted-foreground">电话：</span>{enterprise?.contactPhone || "-"}</p>
              <p><span className="text-muted-foreground">邮箱：</span>{enterprise?.contactEmail || "-"}</p>
              <p><span className="text-muted-foreground">地址：</span>{enterprise?.address || "-"}</p>
            </CardContent>
          </Card>
          {enterprise?.description && (
            <Card className="col-span-2">
              <CardHeader><CardTitle>企业描述</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{enterprise.description}</p></CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: "agreements",
      label: "合作协议",
      badge: agreements.length,
      content: (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <TableHead>协议名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>起止日期</TableHead>
              </tr>
            </thead>
            <tbody>
              {agreements.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">暂无合作协议</td></tr>
              ) : (
                agreements.map((a) => (
                  <tr key={a.id} className="border-b">
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.type || "-"}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell>{a.startDate || "-"} ~ {a.endDate || "-"}</TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "projects",
      label: "合作项目",
      badge: projects.length,
      content: (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <TableHead>项目名称</TableHead>
                <TableHead>阶段</TableHead>
                <TableHead>开始日期</TableHead>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">暂无合作项目</td></tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><StatusBadge status={p.phase} /></TableCell>
                    <TableCell>{p.startDate || "-"}</TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "achievements",
      label: "合作成果",
      badge: achievements.length,
      content: (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <TableHead>成果名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
              </tr>
            </thead>
            <tbody>
              {achievements.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">暂无合作成果</td></tr>
              ) : (
                achievements.map((a) => (
                  <tr key={a.id} className="border-b">
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={enterprise?.name || ""}
      statusBadge={enterprise ? <StatusBadge status={enterprise.status} /> : undefined}
      backHref="/portal/apps/alliance/enterprises"
      editHref={`/portal/apps/alliance/enterprises/${id}/edit`}
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
