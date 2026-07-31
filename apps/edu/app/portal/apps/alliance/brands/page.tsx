"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, Building, Briefcase, BookOpen, Users, Palette, Sparkles, Share2 } from "lucide-react"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { portalRequest } from "@/lib/api"
import type { AllianceBrand, AllianceListResponse } from "@/lib/types"

const brandCards = [
  { type: "talent", label: "人才品牌", desc: "展示学生能力画像与典型就业案例", icon: GraduationCap, color: "text-blue-600 bg-blue-50" },
  { type: "employer", label: "雇主品牌", desc: "展示合作企业/机构的品牌形象", icon: Building, color: "text-green-600 bg-green-50" },
  { type: "job", label: "岗位品牌", desc: "展示优质岗位的品牌级运营", icon: Briefcase, color: "text-orange-600 bg-orange-50" },
  { type: "major", label: "专业品牌", desc: "展示专业建设水平与培养特色", icon: BookOpen, color: "text-purple-600 bg-purple-50" },
  { type: "teacher", label: "师资品牌", desc: "展示校本师资与产业导师", icon: Users, color: "text-red-600 bg-red-50" },
  { type: "culture", label: "文化思政品牌", desc: "展示典型案例、思政资源与文化活动", icon: Palette, color: "text-cyan-600 bg-cyan-50" },
]

export default function AllianceBrandsPage() {
  const { tenantId } = usePortalAuth()
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!tenantId) return
    const loadCounts = async () => {
      try {
        const data = await portalRequest<AllianceListResponse<AllianceBrand>>("/alliance/brands")
        const c: Record<string, number> = {}
        for (const b of data.items || []) { c[b.brandType] = (c[b.brandType] || 0) + 1 }
        setCounts(c)
      } catch {}
    }
    loadCounts()
  }, [tenantId])

  const pageMap: Record<string, string> = {
    talent: "/portal/apps/alliance/brands/talent",
    employer: "/portal/apps/alliance/brands/employer",
    job: "/portal/apps/alliance/brands/job",
    major: "/portal/apps/alliance/brands/major",
    teacher: "/portal/apps/alliance/brands/teacher",
    culture: "/portal/apps/alliance/brands/culture",
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">品牌运营管理</h1><p className="text-muted-foreground text-sm mt-1">管理六大品牌模块内容，配置前台展示</p></div>
      <div className="grid grid-cols-3 gap-4">
        {brandCards.map((card) => {
          const Icon = card.icon
          const count = counts[card.type] || 0
          return (
            <Link key={card.type} href={pageMap[card.type]}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className={`p-2 rounded-lg ${card.color}`}><Icon className="h-5 w-5" /></div>
                  <CardTitle className="text-base">{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">{card.desc}</CardDescription>
                  <p className="text-sm font-semibold mt-2">{count} 条内容</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <Link href="/portal/apps/alliance/brands/topics">
          <Card className="hover:shadow-md transition-shadow cursor-pointer inline-flex">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="p-2 rounded-lg text-indigo-600 bg-indigo-50"><Sparkles className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-base">品牌专题页</CardTitle>
                <CardDescription className="text-xs">管理品牌聚合专题展示</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
