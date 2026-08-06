'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

// 各业务模块固定主题色（不跟随系统主题）：岗位=紫 / 场景=青 / 测评=绿 / 课程=黄 / 联盟=红 / 默认蓝
const ACCENT_CLASSES: Record<
  string,
  {
    active: string
    hover: string
  }
> = {
  primary: {
    active: 'bg-primary border-primary text-white shadow-md shadow-primary/20',
    hover: 'hover:border-primary/30 hover:text-primary hover:bg-primary/5',
  },
  purple: {
    active: 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-500/20',
    hover: 'hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50/50',
  },
  cyan: {
    active: 'bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-500/20',
    hover: 'hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50/50',
  },
  emerald: {
    active: 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20',
    hover: 'hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/50',
  },
  amber: {
    active: 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20',
    hover: 'hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/50',
  },
  red: {
    active: 'bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20',
    hover: 'hover:border-red-300 hover:text-red-600 hover:bg-red-50/50',
  },
  blue: {
    active: 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/20',
    hover: 'hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50',
  },
}

interface LandingPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  accentColor?: 'primary' | 'purple' | 'cyan' | 'emerald' | 'amber' | 'red' | 'blue'
}

export function LandingPagination({
  currentPage,
  totalPages,
  onPageChange,
  accentColor = 'blue',
}: LandingPaginationProps) {
  const t = useT()
  if (totalPages <= 1) return null

  const cls = ACCENT_CLASSES[accentColor] || ACCENT_CLASSES.blue
  const pageBtn = `min-w-[36px] h-9 px-2.5 rounded-xl border text-[13px] flex items-center justify-center transition-all ${cls.hover}`
  const pageBtnIdle = 'bg-white border-slate-200 text-slate-500'
  const arrowBtn = `w-9 h-9 border border-slate-200 rounded-xl bg-white text-slate-500 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${cls.hover}`

  const pages: (number | string)[] = []
  const maxVisible = 5

  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages)
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        className={arrowBtn}
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label={t('上一页')}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`${pageBtn} ${currentPage === p ? `${cls.active} font-semibold` : pageBtnIdle}`}
            >
              {p}
            </button>
          ),
        )}
      </div>
      <button
        className={arrowBtn}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label={t('下一页')}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
