'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceProject } from '@/lib/types'
import { reportError } from '@/lib/error-handling'

export default function AlliancePublicProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<AllianceProject | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<AllianceProject>(`/alliance/public/projects/${id}`)
      .then(setProject)
      .catch((err) => {
        reportError(err, { source: '加载合作项目详情' })
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!project) return <div className="text-center py-12 text-muted-foreground">项目不存在</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/portal/alliance/projects"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> 返回列表
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {project.type ? `${project.type}` : ''}
          </p>
        </div>
        <Badge variant="outline">{allianceLabel('projectPhase', project.phase)}</Badge>
      </div>

      {project.coverImage && (
        <Image
          src={project.coverImage}
          alt={project.name}
          width={1200}
          height={675}
          className="w-full max-h-64 object-cover rounded-xl"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>项目信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">阶段：</span>
              {allianceLabel('projectPhase', project.phase)}
            </p>
            <p>
              <span className="text-muted-foreground">开始日期：</span>
              {project.startDate || '-'}
            </p>
            <p>
              <span className="text-muted-foreground">结束日期：</span>
              {project.endDate || '-'}
            </p>
            <p>
              <span className="text-muted-foreground">预算：</span>
              {project.budget || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {project.description && (
        <Card>
          <CardHeader>
            <CardTitle>项目描述</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
