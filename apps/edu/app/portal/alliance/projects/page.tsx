'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceProject } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'

export default function AlliancePublicProjectsPage() {
  const [items, setItems] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalRequest<{ items: AllianceProject[] }>('/alliance/public/projects')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载合作项目列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingView />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">合作项目</h1>
      <p className="text-muted-foreground">校企合作项目展示</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">暂无合作项目</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link key={item.id} href={`/portal/alliance/projects/${item.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <Badge variant="outline">{allianceLabel('projectPhase', item.phase)}</Badge>
                  </div>
                  {item.startDate && <CardDescription>开始: {item.startDate}</CardDescription>}
                </CardHeader>
                {item.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
