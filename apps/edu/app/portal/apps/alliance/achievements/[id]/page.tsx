"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import { useToast } from "@zhiyu/ui"
import { StatusBadge } from "@/components/shared/status-badge"
import { AllianceDetailShell } from "@/components/shared/alliance-detail-shell"
import type { AllianceAchievement } from "@/lib/types"

export default function AllianceAchievementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [achievement, setAchievement] = useState<AllianceAchievement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId || !id) return
    portalRequest<AllianceAchievement>(`/alliance/achievements/${id}`)
      .then((a) => { setAchievement(a) })
      .catch((e) => {
        toast({ title: "加载失败", description: e.message, variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  if (!achievement && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/achievements" />
  }

  const typeLabel: Record<string, string> = {
    job: "岗位", scene: "场景", course: "课程", custom: "自定义",
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
              <p><span className="text-muted-foreground">成果类型：</span>{typeLabel[achievement?.type || ""] || achievement?.type || "-"}</p>
              <p><span className="text-muted-foreground">成果日期：</span>{achievement?.achievementDate || "-"}</p>
              <p><span className="text-muted-foreground">状态：</span><StatusBadge status={achievement?.status || "draft"} /></p>
              <p><span className="text-muted-foreground">公开显示：</span>{achievement?.isPublic ? "是" : "否"}</p>
              <p><span className="text-muted-foreground">浏览量：</span>{achievement?.viewCount || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>引用来源</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">引用理由：</span>{achievement?.citationReason || "-"}</p>
              {achievement?.ownerPersons && (achievement.ownerPersons as any[])?.length > 0 && (
                <p><span className="text-muted-foreground">负责人：</span>{(achievement.ownerPersons as any[]).join(", ")}</p>
              )}
              {achievement?.coBuilders && (achievement.coBuilders as any[])?.length > 0 && (
                <p><span className="text-muted-foreground">共建者：</span>{(achievement.coBuilders as any[]).join(", ")}</p>
              )}
            </CardContent>
          </Card>
          {achievement?.description && (
            <Card className="col-span-2">
              <CardHeader><CardTitle>成果描述</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{achievement.description}</p></CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: "related",
      label: "关联资源",
      content: (
        <div className="space-y-6">
          {achievement?.relatedPositions && (achievement.relatedPositions as any[])?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>关联岗位</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(achievement.relatedPositions as any[]).map((p: any, i: number) => (
                    <Badge key={i} variant="secondary">{p.name || p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {achievement?.relatedScenes && (achievement.relatedScenes as any[])?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>关联场景</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(achievement.relatedScenes as any[]).map((s: any, i: number) => (
                    <Badge key={i} variant="secondary">{s.name || s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {achievement?.relatedCourses && (achievement.relatedCourses as any[])?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>关联课程</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(achievement.relatedCourses as any[]).map((c: any, i: number) => (
                    <Badge key={i} variant="secondary">{c.name || c}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {(!achievement?.relatedPositions || (achievement.relatedPositions as any[])?.length === 0) &&
           (!achievement?.relatedScenes || (achievement.relatedScenes as any[])?.length === 0) &&
           (!achievement?.relatedCourses || (achievement.relatedCourses as any[])?.length === 0) && (
            <p className="text-center py-8 text-muted-foreground">暂无关联资源</p>
          )}
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={achievement?.title || ""}
      subtitle={`${typeLabel[achievement?.type || ""] || achievement?.type}成果`}
      statusBadge={achievement ? <StatusBadge status={achievement.status} /> : undefined}
      backHref="/portal/apps/alliance/achievements"
      editHref={`/portal/apps/alliance/achievements/${id}/edit`}
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
