'use client'

// AI 中心收藏按钮（广场卡片/详情页共用，spec §1.4：v1 仅 toggle 与计数）。
// 列表响应不带收藏态，按 F1 约定卡片挂载时查询 status。
import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { aiCenterFavoriteApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { cn } from '@/lib/utils'

export function AICenterFavoriteButton({
  targetType,
  targetId,
  className,
}: {
  targetType: 'ai_kb' | 'ai_agent'
  targetId: string
  className?: string
}) {
  const t = useT()
  const { toast } = useToast()
  const [isFavorite, setIsFavorite] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [toggling, setToggling] = useState(false)
  // 卸载守卫：卡片随列表刷新卸载后不再回写状态
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    aiCenterFavoriteApi
      .status(targetType, targetId)
      .then((res) => {
        if (!aliveRef.current) return
        setIsFavorite(res.isFavorite)
        setCount(res.favoriteCount)
      })
      .catch(() => {
        // 收藏态查询失败不打扰用户，按钮按未收藏渲染
      })
    return () => {
      aliveRef.current = false
    }
  }, [targetType, targetId])

  const toggle = async (e: React.MouseEvent) => {
    // 卡片整体可点击跳转，收藏按钮需阻断冒泡
    e.stopPropagation()
    e.preventDefault()
    if (toggling) return
    setToggling(true)
    try {
      const res = await aiCenterFavoriteApi.toggle(targetType, targetId)
      setIsFavorite(res.isFavorite)
      setCount(res.favoriteCount)
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setToggling(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={toggling}
      title={isFavorite ? t('取消收藏') : t('收藏')}
      className={cn(
        'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50',
        isFavorite && 'text-red-500',
        className,
      )}
    >
      <Heart className={cn('h-3.5 w-3.5', isFavorite && 'fill-red-500')} />
      {count !== null && <span>{count}</span>}
    </button>
  )
}
