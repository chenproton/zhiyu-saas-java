'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceExpert } from '@/lib/types'
import { reportError } from '@/lib/error-handling'

export default function AlliancePublicExpertsPage() {
  const [items, setItems] = useState<AllianceExpert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalRequest<{ items: AllianceExpert[] }>('/alliance/public/experts')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载企业专家列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">企业专家</h1>
      <p className="text-muted-foreground">产业专家与校企专家资源展示</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">暂无专家</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link key={item.id} href={`/portal/alliance/experts/${item.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <Badge variant="outline">
                      {item.rating
                        ? allianceLabel('expertRating', item.rating)
                        : allianceLabel('expertStatus', item.status)}
                    </Badge>
                  </div>
                  <CardDescription>
                    {[item.title, item.position, item.industry].filter(Boolean).join(' · ') ||
                      '专家'}
                  </CardDescription>
                </CardHeader>
                {item.introduction && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.introduction}
                    </p>
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
