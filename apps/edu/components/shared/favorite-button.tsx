'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { useToast } from '@zhiyu/ui'
import { favoriteApi } from '@/lib/api'
import type { FavoriteTargetType } from '@/lib/api'

interface FavoriteButtonProps {
  targetType: FavoriteTargetType
  targetId: string
  label: string
  activeLabel?: string
  /** light 变体用于深色背景（如试卷概览页渐变头部） */
  light?: boolean
  className?: string
}

/**
 * 通用收藏按钮：场景/课程/题库/试卷详情页复用，
 * 未登录点击时提示登录；登录后按需拉取收藏状态并支持切换。
 */
export function FavoriteButton({
  targetType,
  targetId,
  label,
  activeLabel,
  light,
  className,
}: FavoriteButtonProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!user || !targetId) return
      try {
        const res = await favoriteApi.get(targetType, targetId)
        if (cancelled) return
        setIsFavorite(res.isFavorite)
        setFavoriteCount(res.favoriteCount)
      } catch {
        // 收藏状态查询失败不阻塞页面
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, targetType, targetId])

  const handleToggle = async () => {
    if (!user) {
      toast({ title: '提示', description: `请先登录后再${label}` })
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const res = await favoriteApi.toggle(targetType, targetId)
      setIsFavorite(res.isFavorite)
      setFavoriteCount(res.favoriteCount)
    } catch {
      toast({ variant: 'destructive', title: '操作失败', description: '操作失败，请稍后再试' })
    } finally {
      setLoading(false)
    }
  }

  const displayActive = activeLabel || `已${label}`

  if (light) {
    return (
      <Button
        variant="outline"
        disabled={loading}
        onClick={handleToggle}
        className={`rounded-xl h-11 px-5 text-sm font-medium transition-all ${
          isFavorite
            ? 'border-rose-300 bg-rose-500/90 text-white hover:bg-rose-500'
            : 'border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20'
        } ${className || ''}`}
      >
        <Heart className={`w-4 h-4 mr-1.5 ${isFavorite ? 'fill-current' : ''}`} />
        {isFavorite ? displayActive : label}
        {favoriteCount > 0 && <span className="ml-1 text-xs opacity-80">({favoriteCount})</span>}
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      disabled={loading}
      onClick={handleToggle}
      className={`rounded-md px-5 h-10 transition-all ${
        isFavorite
          ? 'border-rose-500 text-rose-600 bg-rose-50 hover:bg-rose-100'
          : 'text-[#475569] hover:border-rose-300 hover:text-rose-500'
      } ${className || ''}`}
    >
      <Heart className={`w-4 h-4 mr-1.5 ${isFavorite ? 'fill-current' : ''}`} />
      {isFavorite ? displayActive : label}
      {favoriteCount > 0 && <span className="ml-1.5 text-xs opacity-80">({favoriteCount})</span>}
    </Button>
  )
}
