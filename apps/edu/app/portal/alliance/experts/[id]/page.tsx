"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { portalRequest } from "@/lib/api"
import { allianceLabel } from "@zhiyu/shared-types"
import type { AllianceExpert } from "@/lib/types"
import { reportError } from "@/lib/error-handling"

export default function AlliancePublicExpertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [expert, setExpert] = useState<AllianceExpert | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    portalRequest<AllianceExpert>(`/alliance/public/experts/${id}`)
      .then(setExpert)
      .catch((err) => {
        reportError(err, { source: "加载企业专家详情" })
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  if (!expert) return <div className="text-center py-12 text-muted-foreground">专家不存在</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/portal/alliance/experts" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> 返回列表
        </Link>
      </div>

      <div className="flex items-start gap-4">
        {expert.avatarUrl && (
          <img src={expert.avatarUrl} alt={expert.name} className="h-20 w-20 rounded-full object-cover" />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{expert.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {[expert.title, expert.position].filter(Boolean).join(" · ") || ""}
              </p>
            </div>
            <Badge variant="outline">{expert.rating ? allianceLabel("expertRating", expert.rating) : allianceLabel("expertStatus", expert.status)}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">行业：</span>{expert.industry || "-"}</p>
            <p><span className="text-muted-foreground">城市：</span>{expert.city || "-"}</p>
            <p><span className="text-muted-foreground">从业年限：</span>{expert.experienceYears ? `${expert.experienceYears}年` : "-"}</p>
            <p><span className="text-muted-foreground">学历：</span>{expert.education || "-"}</p>
          </CardContent>
        </Card>
        {expert.professionalFields && expert.professionalFields.length > 0 && (
          <Card>
            <CardHeader><CardTitle>专业领域</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {expert.professionalFields.map((field) => (
                  <Badge key={field} variant="secondary">{field}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {expert.specialties && expert.specialties.length > 0 && (
        <Card>
          <CardHeader><CardTitle>专长</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expert.specialties.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {expert.introduction && (
        <Card>
          <CardHeader><CardTitle>简介</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{expert.introduction}</p>
          </CardContent>
        </Card>
      )}

      {expert.workExperience && (
        <Card>
          <CardHeader><CardTitle>工作经历</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{expert.workExperience}</p>
          </CardContent>
        </Card>
      )}

      {expert.photos && expert.photos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>照片</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {expert.photos.map((photo, idx) => (
                <img key={idx} src={photo} alt={`${expert.name} 照片 ${idx + 1}`} className="w-full h-40 object-cover rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
