"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, ArrowLeft, Share2, MapPin, Building2, GraduationCap, Clock, Calendar, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import type { CareerPosition } from "@/lib/types"

interface PositionHeaderProps {
  position: CareerPosition
  industryName?: string
}

const HEART_JOBS_KEY = "zhiyu_heart_jobs"

function formatSalary(min?: number | null, max?: number | null) {
  if ((min ?? 0) > 0 && (max ?? 0) > 0) return `¥${min} - ¥${max}`
  if ((min ?? 0) > 0) return `¥${min}起`
  if ((max ?? 0) > 0) return `¥${max}以内`
  return "面议"
}

export function PositionHeader({ position, industryName }: PositionHeaderProps) {
  const { user } = useAuth()
  const [isHeart, setIsHeart] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const jobs = JSON.parse(localStorage.getItem(HEART_JOBS_KEY) || "[]")
    setIsHeart(jobs.some((j: { id?: string }) => j.id === position.id))
  }, [position.id])

  const toggleHeart = () => {
    if (!user) {
      alert("请先登录后再收藏岗位")
      return
    }
    const jobs = JSON.parse(localStorage.getItem(HEART_JOBS_KEY) || "[]")
    const idx = jobs.findIndex((j: { id?: string }) => j.id === position.id)
    if (idx >= 0) {
      jobs.splice(idx, 1)
      setIsHeart(false)
    } else {
      jobs.push({
        id: position.id,
        name: position.name,
        industry: industryName || "",
        major: position.majorNames?.[0] || "",
        addedAt: new Date().toISOString(),
      })
      setIsHeart(true)
    }
    localStorage.setItem(HEART_JOBS_KEY, JSON.stringify(jobs))
  }

  return (
    <div className="bg-white border-b border-[#e7e5e4]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/job/student">
            <Button variant="ghost" size="sm" className="text-[#64748b] hover:text-blue-600">
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回岗位列表
            </Button>
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="secondary" className="bg-[#eff6ff] text-blue-600 hover:bg-[#eff6ff]">
                {position.positionType === "enterprise" ? "企业岗位" : "教学岗位"}
              </Badge>
              {industryName && (
                <Badge variant="outline" className="text-[#64748b]">
                  <Building2 className="w-3 h-3 mr-1" /> {industryName}
                </Badge>
              )}
              {position.majorNames?.map((m) => (
                <Badge key={m} variant="outline" className="text-[#64748b]">
                  <GraduationCap className="w-3 h-3 mr-1" /> {m}
                </Badge>
              ))}
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#0f172a] mb-2">{position.name}</h1>
            <div className="text-sm text-[#94a3b8] mb-4">岗位编码：{position.id.slice(0, 8)} · 版本：{position.version}</div>
            <p className="text-sm text-[#475569] leading-relaxed max-w-3xl">{position.description || "暂无岗位描述"}</p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="text-2xl font-extrabold text-blue-600">{formatSalary(position.salaryMin, position.salaryMax)}</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className={`rounded-full px-4 ${isHeart ? "border-blue-500 text-blue-600" : "text-[#475569]"}`}
                onClick={toggleHeart}
              >
                <Heart className={`w-4 h-4 mr-1.5 ${isHeart ? "fill-current" : ""}`} />
                {isHeart ? "已设为心仪岗位" : "设为心仪岗位"}
              </Button>
              <Button variant="outline" size="icon" className="rounded-full text-[#475569]">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#f1f5f9]">
          {[
            { icon: MapPin, label: "工作地点", value: "全国" },
            { icon: Clock, label: "更新日期", value: position.updatedAt?.slice(0, 10) || "-" },
            { icon: Calendar, label: "发布日期", value: position.createdAt?.slice(0, 10) || "-" },
            { icon: Eye, label: "浏览次数", value: "128+" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f8fafc] flex items-center justify-center text-[#64748b]">
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#94a3b8]">{s.label}</div>
                <div className="text-sm font-semibold text-[#0f172a]">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
