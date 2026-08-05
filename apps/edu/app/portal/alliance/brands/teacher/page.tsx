'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView, Empty, EmptyHeader, EmptyTitle } from '@zhiyu/ui'

export default function AlliancePublicTeacherBrandPage() {
  const [items, setItems] = useState<AllianceBrand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalRequest<{ items: AllianceBrand[] }>('/alliance/public/brands?brandType=teacher')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载师资品牌列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingView />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">师资品牌</h1>
      <p className="text-muted-foreground">展示校本师资与产业导师</p>
      {items.length === 0 ? (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyTitle>暂无内容</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <Badge variant="outline">{allianceLabel('brandStatus', item.status)}</Badge>
                </div>
                {item.description && (
                  <CardDescription className="line-clamp-3">{item.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-1">
                {item.teacherId && (
                  <p className="text-xs text-muted-foreground">教师: {item.teacherId}</p>
                )}
                {item.expertId && (
                  <p className="text-xs text-muted-foreground">专家: {item.expertId}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
