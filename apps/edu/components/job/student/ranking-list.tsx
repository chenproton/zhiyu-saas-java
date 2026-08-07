'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Trophy, ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CareerPosition } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface RankingListProps {
  positions?: CareerPosition[]
  industryMap?: Map<string, string>
}

const ROWS_PER_PAGE = 5

const subscribeMobile = (callback: () => void) => {
  const mql = window.matchMedia('(max-width: 639px)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

const getIsMobile = () => window.matchMedia('(max-width: 639px)').matches

const cardPalette = {
  bg: 'bg-primary/5',
  hover: 'hover:bg-primary/10',
  border: 'border-primary/10',
}

export function RankingList({ positions = [], industryMap }: RankingListProps) {
  const t = useT()
  const [page, setPage] = useState(0)
  const isMobile = useSyncExternalStore(subscribeMobile, getIsMobile, () => false)

  const ranked = useMemo(() => {
    return [...positions]
      .filter((p) => p.status === 'published')
      .sort((a, b) => {
        const countA = a.favoriteCount ?? 0
        const countB = b.favoriteCount ?? 0
        if (countB !== countA) return countB - countA
        return a.name.localeCompare(b.name, 'zh-CN')
      })
  }, [positions])

  // 移动端单列每页 5 行，桌面端双列每页 10 行
  const rowsPerPage = isMobile ? ROWS_PER_PAGE : ROWS_PER_PAGE * 2
  const totalPages = Math.max(1, Math.ceil(ranked.length / rowsPerPage))
  // 视口切换导致每页行数变化时，在渲染期夹紧页码，避免空页
  const activePage = Math.min(page, totalPages - 1)
  const pageItems = useMemo(() => {
    const start = activePage * rowsPerPage
    return ranked.slice(start, start + rowsPerPage)
  }, [ranked, activePage, rowsPerPage])

  const getRankStyle = (rank: number) => {
    if (rank === 1)
      return 'bg-gradient-to-br from-amber-400 to-yellow-300 text-white shadow-lg shadow-amber-400/30'
    if (rank === 2)
      return 'bg-gradient-to-br from-slate-400 to-slate-300 text-white shadow-lg shadow-slate-400/30'
    if (rank === 3)
      return 'bg-gradient-to-br from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/30'
    return 'bg-slate-100 text-slate-400'
  }

  const formatCount = (n?: number) => {
    if (!n || n <= 0) return '0'
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
    return n.toLocaleString()
  }

  const categoryFor = (pos: CareerPosition) => {
    if (pos.industryId && industryMap?.get(pos.industryId)) return industryMap.get(pos.industryId)!
    return pos.positionType === 'enterprise' ? t('企业') : t('教学')
  }

  const renderItem = (pos: CareerPosition, idx: number) => {
    const globalRank = activePage * rowsPerPage + idx + 1
    const display = pos.shortName || pos.name
    const count = pos.favoriteCount ?? 0
    const palette = cardPalette
    return (
      <Link key={pos.id} href={`/job/landing/${pos.id}`}>
        <div
          className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${palette.bg} ${palette.hover} cursor-pointer transition-all group`}
        >
          <span
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${getRankStyle(globalRank)}`}
          >
            {globalRank}
          </span>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">
                {display}
              </span>
              <span className="text-[11px] text-rose-500 flex items-center gap-0.5 whitespace-nowrap font-medium">
                <Heart className={`w-3 h-3 ${count > 0 ? 'fill-current' : ''}`} />{' '}
                {formatCount(count)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="px-1.5 py-0.5 rounded-md bg-white/70 text-primary whitespace-nowrap font-medium border border-primary/10 shrink-0">
                {categoryFor(pos)}
              </span>
              {(pos.majorNames?.filter(Boolean) || []).length === 0 ? (
                <span className="px-1.5 py-0.5 rounded-md bg-white/70 text-emerald-600 whitespace-nowrap font-medium border border-emerald-100 shrink-0">
                  {t('未分类')}
                </span>
              ) : (
                pos.majorNames?.filter(Boolean).map((m: string) => (
                  <span
                    key={m}
                    className="px-1.5 py-0.5 rounded-md bg-white/70 text-emerald-600 whitespace-nowrap font-medium border border-emerald-100 shrink-0"
                  >
                    {m}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  if (ranked.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center gap-2 text-[15px] font-bold text-slate-800 mb-3">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
          <Trophy className="w-4 h-4 text-primary" />
          {t('收藏岗位排行榜')}
        </div>
        <div className="text-center py-6 text-slate-400 text-sm">{t('暂无岗位数据')}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 text-[15px] font-bold text-slate-800">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
          <Trophy className="w-4 h-4 text-primary" />
          {t('收藏岗位排行榜')}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg border-slate-200 bg-white text-slate-500 hover:border-primary/30 hover:text-primary hover:bg-primary/5 disabled:opacity-30 transition-all"
            disabled={activePage <= 0}
            onClick={() => setPage(activePage - 1)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-slate-400 min-w-[40px] text-center font-medium">
            {activePage + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg border-slate-200 bg-white text-slate-500 hover:border-primary/30 hover:text-primary hover:bg-primary/5 disabled:opacity-30 transition-all"
            disabled={activePage >= totalPages - 1}
            onClick={() => setPage(activePage + 1)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {pageItems.map((pos, i) => renderItem(pos, i))}
      </div>
    </div>
  )
}
