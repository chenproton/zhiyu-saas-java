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
import type { AllianceProject, AllianceProjectMilestone, AllianceListResponse } from "@/lib/types"

export default function AllianceProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [project, setProject] = useState<AllianceProject | null>(null)
  const [milestones, setMilestones] = useState<AllianceProjectMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      portalRequest<AllianceProject>(`/alliance/projects/${id}`),
      portalRequest<AllianceListResponse<AllianceProjectMilestone>>(`/alliance/projects/${id}/milestones`),
    ])
      .then(([p, m]) => {
        setProject(p)
        setMilestones(m.items || [])
      })
      .catch((e) => {
        toast({ title: "加载失败", description: e.message, variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  if (!project && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/projects" />
  }

  const phaseLabel: Record<string, string> = {
    initiation: "启动", execution: "执行中", acceptance: "验收", closure: "关闭",
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
              <p><span className="text-muted-foreground">项目类型：</span>{project?.type || "-"}</p>
              <p><span className="text-muted-foreground">项目阶段：</span>{phaseLabel[project?.phase || ""] || project?.phase || "-"}</p>
              <p><span className="text-muted-foreground">发布状态：</span>{project?.publishStatus || "-"}</p>
              <p><span className="text-muted-foreground">公开显示：</span>{project?.isPublic ? "是" : "否"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>时间信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">开始日期：</span>{project?.startDate || "-"}</p>
              <p><span className="text-muted-foreground">结束日期：</span>{project?.endDate || "-"}</p>
              <p><span className="text-muted-foreground">预算：</span>{project?.budget || "-"}</p>
            </CardContent>
          </Card>
          {project?.description && (
            <Card className="col-span-2">
              <CardHeader><CardTitle>项目描述</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{project.description}</p></CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: "milestones",
      label: "里程碑",
      badge: milestones.length,
      content: (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <TableHead>里程碑名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>截止日期</TableHead>
                <TableHead>完成日期</TableHead>
                <TableHead>状态</TableHead>
              </tr>
            </thead>
            <tbody>
              {milestones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">暂无里程碑</td>
                </tr>
              ) : (
                milestones.map((m) => (
                  <tr key={m.id} className="border-b">
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.description || "-"}</TableCell>
                    <TableCell>{m.dueDate || "-"}</TableCell>
                    <TableCell>{m.completedDate || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={m.isCompleted ? "completed" : "pending"} />
                    </TableCell>
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
      title={project?.name || ""}
      statusBadge={project ? <StatusBadge status={project.phase} /> : undefined}
      backHref="/portal/apps/alliance/projects"
      editHref={`/portal/apps/alliance/projects/${id}/edit`}
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
