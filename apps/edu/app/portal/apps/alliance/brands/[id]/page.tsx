"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { allianceLabel } from "@zhiyu/shared-types"
import { AllianceDetailShell } from "@/components/shared/alliance-detail-shell"
import type { AllianceBrand } from "@/lib/types"

export default function AllianceBrandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [brand, setBrand] = useState<AllianceBrand | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId || !id) return
    portalRequest<AllianceBrand>(`/alliance/brands/${id}`)
      .then((b) => setBrand(b))
      .catch((e) => toast({ title: "加载失败", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  if (!brand && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/brands" />
  }

  const related: { label: string; value?: string | null }[] = [
    { label: "关联学生", value: brand?.studentId },
    { label: "关联企业", value: brand?.enterpriseId },
    { label: "关联岗位", value: brand?.positionId },
    { label: "关联专业", value: brand?.majorId },
    { label: "关联教师", value: brand?.teacherId },
    { label: "关联专家", value: brand?.expertId },
  ].filter((x) => x.value)

  const tabs = [
    {
      key: "info", label: "基本信息",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card><CardHeader><CardTitle>品牌信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">品牌类型：</span>{allianceLabel("brandType", brand?.brandType)}</p>
              <p><span className="text-muted-foreground">状态：</span>{allianceLabel("brandStatus", brand?.status)}</p>
              <p><span className="text-muted-foreground">推荐：</span>{brand?.isFeatured ? "是" : "否"}</p>
              <p><span className="text-muted-foreground">前台展示：</span>{brand?.isPublic ? "是" : "否"}</p>
              <p><span className="text-muted-foreground">浏览量：</span>{brand?.viewCount || 0}</p>
              <p><span className="text-muted-foreground">排序：</span>{brand?.sortOrder ?? 0}</p>
            </CardContent></Card>
          {related.length > 0 && (
            <Card><CardHeader><CardTitle>关联对象</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {related.map((r) => (
                  <p key={r.label}><span className="text-muted-foreground">{r.label}：</span>
                    <Badge variant="secondary">{r.value}</Badge>
                  </p>
                ))}
              </CardContent></Card>
          )}
          {brand?.description && (
            <Card className="col-span-2"><CardHeader><CardTitle>品牌描述</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{brand.description}</p></CardContent></Card>
          )}
          {brand?.data && JSON.stringify(brand.data) !== "{}" && (
            <Card className="col-span-2"><CardHeader><CardTitle>数据详情</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(brand.data, null, 2)}</pre>
              </CardContent></Card>
          )}
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={brand?.name || ""}
      subtitle={allianceLabel("brandType", brand?.brandType)}
      statusBadge={brand ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{allianceLabel("brandStatus", brand.status)}</span> : undefined}
      backHref="/portal/apps/alliance/brands"
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
