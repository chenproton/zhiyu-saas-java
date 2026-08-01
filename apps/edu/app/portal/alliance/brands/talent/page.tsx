'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceBrand } from '@/lib/types'
import { reportError } from '@/lib/error-handling'

export default function AlliancePublicTalentBrandPage() {
  const [items, setItems] = useState<AllianceBrand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalRequest<{ items: AllianceBrand[] }>('/alliance/public/brands?brandType=talent')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载人才品牌列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">人才品牌</h1>
      <p className="text-muted-foreground">展示学生能力画像与典型就业案例</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">暂无内容</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    {item.isFeatured && <Badge variant="secondary">推荐</Badge>}
                    <Badge variant="outline">{allianceLabel('brandStatus', item.status)}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.description && (
                  <CardDescription className="line-clamp-3">{item.description}</CardDescription>
                )}
                {item.studentId && (
                  <p className="text-xs text-muted-foreground">学生: {item.studentId}</p>
                )}
                {item.data?.major && (
                  <p className="text-xs text-muted-foreground">专业: {item.data.major}</p>
                )}
                {item.data?.abilityScore != null && (
                  <p className="text-xs text-muted-foreground">
                    能力评分: {item.data.abilityScore}
                  </p>
                )}
                {item.data?.tags && item.data.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.data.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
