"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, ArrowLeft, Share2, MapPin, Building2, GraduationCap, Clock, Calendar, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { positionApi } from "@/lib/api"
import type { CareerPosition } from "@/lib/types"

interface PositionHeaderProps {
  position: CareerPosition
  industryName?: string
}

function formatSalary(min?: number | null, max?: number | null) {
  if ((min ?? 0) > 0 && (max ?? 0) > 0) return `¥${min} - ¥${max}`
  if ((min ?? 0) > 0) return `¥${min}起`
  if ((max ?? 0) > 0) return `¥${max}以内`
  return "面议"
}

export function PositionHeader({ position, industryName }: PositionHeaderProps) {
  const { user } = useAuth()
  const [isHeart, setIsHeart] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(position.favoriteCount ?? 0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsHeart(false)
      return
    }
    positionApi.getFavorite(position.id)
      .then((res) => {
        setIsHeart(res.isFavorite)
        setFavoriteCount(res.favoriteCount)
      })
      .catch(() => {})
  }, [user, position.id])

  const toggleHeart = async () => {
    if (!user) {
      alert("请先登录后再收藏岗位")
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const res = await positionApi.favorite(position.id)
      setIsHeart(res.isFavorite)
      setFavoriteCount(res.favoriteCount)
    } catch {
      alert("操作失败，请稍后再试")
    } finally {
      setLoading(false)
    }
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
                disabled={loading}
                className={`rounded-full px-4 transition-all ${isHeart ? "border-rose-500 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700" : "text-[#475569] hover:border-rose-300 hover:text-rose-500"}`}
                onClick={toggleHeart}
              >
                <Heart className={`w-4 h-4 mr-1.5 ${isHeart ? "fill-current" : ""}`} />
                {isHeart ? "已设为心仪岗位" : "设为心仪岗位"}
                {favoriteCount > 0 && (
                  <span className="ml-1.5 text-xs opacity-80">({favoriteCount})</span>
                )}
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
            { icon: Eye, label: "收藏次数", value: favoriteCount.toLocaleString() },
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
