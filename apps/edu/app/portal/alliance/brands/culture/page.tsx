'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'

export default function AlliancePublicCultureBrandPage() {
  const [items, setItems] = useState<AllianceBrand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalRequest<{ items: AllianceBrand[] }>('/alliance/public/brands?brandType=culture')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载文化思政品牌列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">文化思政品牌</h1>
      <p className="text-muted-foreground">展示典型案例、思政资源与文化活动</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">暂无内容</p>
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
                {item.data?.type && (
                  <p className="text-xs text-muted-foreground">类型: {item.data.type}</p>
                )}
                {item.majorId && (
                  <p className="text-xs text-muted-foreground">专业: {item.majorId}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
