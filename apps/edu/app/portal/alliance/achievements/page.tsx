'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { portalRequest } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceAchievement } from '@/lib/types'
import { reportError } from '@/lib/error-handling'

export default function AlliancePublicAchievementsPage() {
  const [items, setItems] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalRequest<{ items: AllianceAchievement[] }>('/alliance/public/achievements')
      .then((data) => setItems(data.items || []))
      .catch((err) => {
        reportError(err, { source: '加载成果列表' })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">合作成果</h1>
      <p className="text-muted-foreground">校企合作产出的各类成果展示</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">暂无合作成果</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link key={item.id} href={`/portal/alliance/achievements/${item.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <Badge variant="outline">{allianceLabel('achievementType', item.type)}</Badge>
                  </div>
                  {item.achievementDate && (
                    <CardDescription>{item.achievementDate}</CardDescription>
                  )}
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
