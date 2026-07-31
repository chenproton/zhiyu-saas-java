"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { portalRequest } from "@/lib/api"
import type { AllianceAchievement } from "@/lib/types"

export default function AlliancePublicAchievementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [achievement, setAchievement] = useState<AllianceAchievement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<AllianceAchievement>(`/alliance/public/achievements/${id}`)
      .then(setAchievement)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!achievement) return <div className="text-center py-12 text-muted-foreground">成果不存在</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/portal/alliance/achievements" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> 返回列表
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{achievement.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {achievement.type}
            {achievement.achievementDate ? ` · ${achievement.achievementDate}` : ""}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline">{achievement.status}</Badge>
          <span className="text-sm text-muted-foreground">{achievement.viewCount} 次浏览</span>
        </div>
      </div>

      {achievement.coverImage && (
        <img src={achievement.coverImage} alt={achievement.title} className="w-full max-h-64 object-cover rounded-xl" />
      )}

      {achievement.description && (
        <Card>
          <CardHeader><CardTitle>成果描述</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{achievement.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
