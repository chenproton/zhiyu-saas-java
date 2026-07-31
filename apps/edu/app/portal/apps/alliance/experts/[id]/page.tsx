"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { allianceLabel } from "@zhiyu/shared-types"
import { AllianceDetailShell } from "@/components/shared/alliance-detail-shell"
import type { AllianceExpert, AllianceEnterprise, AllianceListResponse } from "@/lib/types"

export default function AllianceExpertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [expert, setExpert] = useState<AllianceExpert | null>(null)
  const [enterprise, setEnterprise] = useState<AllianceEnterprise | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      portalRequest<AllianceExpert>(`/alliance/experts/${id}`),
      portalRequest<AllianceListResponse<AllianceEnterprise>>("/alliance/enterprises?limit=1000"),
    ])
      .then(([e, ents]) => {
        setExpert(e)
        setEnterprise((ents.items || []).find((x) => x.id === e.enterpriseId) || null)
      })
      .catch((err) => toast({ title: "加载失败", description: err.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  if (!expert && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/experts" />
  }

  const tabs = [
    {
      key: "info", label: "基本信息",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card><CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">性别：</span>{expert?.gender === "male" ? "男" : expert?.gender === "female" ? "女" : "-"}</p>
              <p><span className="text-muted-foreground">年龄：</span>{expert?.age ? `${expert.age}岁` : "-"}</p>
              <p><span className="text-muted-foreground">所在城市：</span>{expert?.city || "-"}</p>
              <p><span className="text-muted-foreground">从业年限：</span>{expert?.experienceYears ? `${expert.experienceYears}年` : "-"}</p>
              <p><span className="text-muted-foreground">教育背景：</span>{expert?.education || "-"}</p>
              <p><span className="text-muted-foreground">行业方向：</span>{expert?.industry || "-"}</p>
              <p><span className="text-muted-foreground">前台展示：</span>{expert?.isPublic ? "是" : "否"}</p>
              <p><span className="text-muted-foreground">创建人：</span>{expert?.createdBy || "-"}</p>
            </CardContent></Card>
          <Card><CardHeader><CardTitle>所属机构</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">来源：</span>{expert?.partnerSource === "cooperation" ? "合作企业" : expert?.partnerSource === "third-party" ? "第三方机构" : "-"}</p>
              <p><span className="text-muted-foreground">所属机构：</span>{expert?.organization || enterprise?.name || "-"}</p>
              {enterprise && (
                <p><span className="text-muted-foreground">关联企业：</span>
                  <a href={`/portal/apps/alliance/enterprises/${enterprise.id}`} className="text-primary hover:underline">{enterprise.name}</a>
                </p>
              )}
              <p><span className="text-muted-foreground">关联二级学院：</span>{((expert as any)?.secondaryColleges || []).join("、") || "-"}</p>
            </CardContent></Card>
          {expert?.avatarUrl && (
            <Card><CardHeader><CardTitle>头像</CardTitle></CardHeader>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={expert.avatarUrl} alt={expert.name} className="w-24 h-32 object-cover rounded-lg" />
              </CardContent></Card>
          )}
          {(expert as any)?.specialties?.length > 0 && (
            <Card><CardHeader><CardTitle>擅长领域</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {((expert as any).specialties || []).map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              </CardContent></Card>
          )}
          {expert?.introduction && (
            <Card><CardHeader><CardTitle>专家简介</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{expert.introduction}</p></CardContent></Card>
          )}
          {expert?.workExperience && (
            <Card><CardHeader><CardTitle>从业经历</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{expert.workExperience}</p></CardContent></Card>
          )}
          {(expert as any)?.attachments?.length > 0 && (
            <Card className="col-span-2"><CardHeader><CardTitle>资质荣誉</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {((expert as any).attachments || []).map((a: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">📄 {a}</p>
                ))}
              </CardContent></Card>
          )}
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={expert?.name || ""}
      subtitle={[expert?.title, expert?.position].filter(Boolean).join(" · ")}
      statusBadge={expert ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{allianceLabel("expertStatus", expert.status)}</span> : undefined}
      backHref="/portal/apps/alliance/experts"
      editHref={`/portal/apps/alliance/experts/${id}/edit`}
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
