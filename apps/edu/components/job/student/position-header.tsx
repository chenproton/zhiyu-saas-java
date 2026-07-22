"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, ArrowLeft, Share2, User, Users, Calendar, Edit3, PlayCircle, Briefcase, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { positionApi } from "@/lib/api"
import type { CareerPosition } from "@/lib/types"

interface PositionHeaderProps {
  position: CareerPosition
  industryName?: string
  onStartLearning?: () => void
}

function formatSalary(min?: number | null, max?: number | null) {
  if ((min ?? 0) > 0 && (max ?? 0) > 0) {
    return `${Math.floor(min! / 1000)}K-${Math.floor(max! / 1000)}K`
  }
  if ((min ?? 0) > 0) return `${Math.floor(min! / 1000)}K起`
  if ((max ?? 0) > 0) return `${Math.floor(max! / 1000)}K以内`
  return "面议"
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "-"
  return dateStr.split("T")[0] || dateStr.split(" ")[0] || dateStr
}

export function PositionHeader({ position, industryName, onStartLearning }: PositionHeaderProps) {
  const { user } = useAuth()
  const router = useRouter()
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

  const displayTitle = position.shortName || position.name
  const majorsText = position.majorNames?.filter(Boolean).join("、") || "未分类"
  const creatorName = position.createdByName || position.createdBy || "-"
  const coBuilderNames = position.collaboratorNames?.filter(Boolean).join(", ") || "-"

  const coverStyle = position.coverImage
    ? { backgroundImage: `url('${position.coverImage}')` }
    : undefined

  return (
    <div className="bg-white border-b border-[#e7e5e4]">
      <div className="max-w-[1400px] mx-auto px-8 py-6">
        <div className="flex items-center gap-2 mb-5">
          <Button variant="ghost" size="sm" className="text-[#64748b] hover:text-blue-600 pl-0" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" /> 返回上一页
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6 shadow-[0_4px_20px_rgba(69,26,3,0.06)]">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Cover */}
            <div
              className="w-full lg:w-[280px] h-[180px] rounded-xl bg-cover bg-center bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 relative overflow-hidden self-stretch"
              style={coverStyle}
            >
              {!position.coverImage && (
                <span className="text-white text-[48px] font-bold opacity-25 select-none">
                  {displayTitle.charAt(0)}
                </span>
              )}
              <span className="absolute top-3 left-3 bg-white/25 text-white px-3 py-1 rounded text-sm font-semibold backdrop-blur-sm">
                {position.version}
              </span>
              <span className="absolute bottom-3 right-0 translate-x-0 bg-black/40 text-white px-3 py-1 rounded-l text-xs">
                {position.id.slice(0, 8)}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-[#0f172a]">{position.name}</h1>
                    <span className="text-2xl font-bold text-blue-600 leading-none">{formatSalary(position.salaryMin, position.salaryMax)}</span>
                  </div>
                  {position.shortName && position.shortName !== position.name && (
                    <p className="text-sm text-[#64748b] mb-3">别名：{position.shortName}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-3 py-1 rounded-md text-xs border bg-[#fff7ed] border-[#ffedd5] text-[#c2410c] flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> 面向行业：{industryName || (position.positionType === "enterprise" ? "企业" : "教学")}
                    </span>
                    <span className="px-3 py-1 rounded-md text-xs border bg-[#dcfce7] border-[#bbf7d0] text-[#15803d] flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" /> 适用专业：{majorsText}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 mb-4">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#64748b]">
                  <span className="flex items-center gap-2"><User className="w-4 h-4 text-[#94a3b8]" /> 创建人：{creatorName}</span>
                  <span className="flex items-center gap-2"><Users className="w-4 h-4 text-[#94a3b8]" /> 共建人：{coBuilderNames}</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#64748b]">
                  <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#94a3b8]" /> 创建时间：{formatDate(position.createdAt)}</span>
                  <span className="flex items-center gap-2"><Edit3 className="w-4 h-4 text-[#94a3b8]" /> 更新时间：{formatDate(position.updatedAt)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-auto">
                {onStartLearning && (
                  <Button
                    className="rounded-md px-6 h-10 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white font-medium"
                    onClick={onStartLearning}
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" /> 开始学习
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={loading}
                  className={`rounded-md px-5 h-10 transition-all ${isHeart ? "border-rose-500 text-rose-600 bg-rose-50 hover:bg-rose-100" : "text-[#475569] hover:border-rose-300 hover:text-rose-500"}`}
                  onClick={toggleHeart}
                >
                  <Heart className={`w-4 h-4 mr-1.5 ${isHeart ? "fill-current" : ""}`} />
                  {isHeart ? "已设为心仪岗位" : "设为心仪岗位"}
                  {favoriteCount > 0 && <span className="ml-1.5 text-xs opacity-80">({favoriteCount})</span>}
                </Button>
                <Button variant="outline" size="icon" className="rounded-md h-10 w-10 text-[#475569]">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
