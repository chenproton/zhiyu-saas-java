"use client"

import Link from "next/link"
import { GraduationCap, Building, Briefcase, BookOpen, Users, Palette } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const brandCards = [
  { type: "talent", label: "人才品牌", desc: "展示学生能力画像与典型就业案例", icon: GraduationCap, color: "text-blue-600 bg-blue-50" },
  { type: "employer", label: "雇主品牌", desc: "展示合作企业/机构的品牌形象", icon: Building, color: "text-green-600 bg-green-50" },
  { type: "job", label: "岗位品牌", desc: "展示优质岗位的品牌级运营", icon: Briefcase, color: "text-orange-600 bg-orange-50" },
  { type: "major", label: "专业品牌", desc: "展示专业建设水平与培养特色", icon: BookOpen, color: "text-purple-600 bg-purple-50" },
  { type: "teacher", label: "师资品牌", desc: "展示校本师资与产业导师", icon: Users, color: "text-red-600 bg-red-50" },
  { type: "culture", label: "文化思政品牌", desc: "展示典型案例、思政资源与文化活动", icon: Palette, color: "text-cyan-600 bg-cyan-50" },
]

const pageMap: Record<string, string> = {
  talent: "/portal/alliance/brands/talent",
  employer: "/portal/alliance/brands/employer",
  job: "/portal/alliance/brands/job",
  major: "/portal/alliance/brands/major",
  teacher: "/portal/alliance/brands/teacher",
  culture: "/portal/alliance/brands/culture",
}

export default function AlliancePublicBrandsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">品牌展示</h1>
      <p className="text-muted-foreground">展示学校六大品牌模块建设成果</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brandCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.type} href={pageMap[card.type]}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">{card.desc}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
