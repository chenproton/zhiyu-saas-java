'use client'

import { useRef } from 'react'
import { ChevronRight, Filter, Search, Sparkles, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlatformFooter } from '@/components/job/student/platform-footer'

export interface LandingStat {
  icon: LucideIcon
  value: number | string
  label: string
  gradient?: string
}

export interface LandingFilterItem {
  type: string
  label: string
}

interface LandingShellProps {
  hero: {
    badge: string
    title: React.ReactNode
    description: string
    ctaLabel: string
    right?: React.ReactNode
  }
  stats?: LandingStat[]
  beforeList?: React.ReactNode
  filterTitle?: string
  filterRows?: React.ReactNode
  activeFilters?: LandingFilterItem[]
  onRemoveFilter?: (type: string) => void
  onClearFilters?: () => void
  sortOptions?: { value: string; label: string }[]
  sort?: string
  onSortChange?: (value: string) => void
  keyword?: string
  onKeywordChange?: (value: string) => void
  onSearch?: () => void
  searchPlaceholder?: string
  totalCount?: number
  countLabel?: string
  listRef?: React.RefObject<HTMLDivElement | null>
  children?: React.ReactNode
}

/**
 * 统一 Landing 页面骨架（6 个业务模块共用）：
 * Hero（跟随系统主题色 primary）→ 统计条 → 附加区块 → 筛选卡 → 工具栏 → 计数 → 内容 → 统一页脚。
 * 全部交互色使用 primary，随 /superadmin 配置的系统主题色变化。
 */
export function LandingShell({
  hero,
  stats,
  beforeList,
  filterTitle = '筛选',
  filterRows,
  activeFilters,
  onRemoveFilter,
  onClearFilters,
  sortOptions,
  sort,
  onSortChange,
  keyword,
  onKeywordChange,
  onSearch,
  searchPlaceholder,
  totalCount,
  countLabel,
  listRef,
  children,
}: LandingShellProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const targetRef = listRef ?? innerRef

  const scrollToList = () => {
    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hasFilter = !!filterRows
  const hasToolbar = (sortOptions && sortOptions.length > 0) || keyword !== undefined

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa]">
      {/* Hero Banner */}
      <div className="relative w-full pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/60" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '52px 52px',
          }}
        />
        <div className="absolute top-[-120px] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[8%] w-[400px] h-[400px] rounded-full bg-primary/15 blur-[100px] pointer-events-none" />
        <div className="absolute top-[20%] left-[30%] w-[300px] h-[300px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pb-14 pt-2 flex flex-col lg:flex-row justify-between items-start gap-8">
          <div className="flex-1 pt-4">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-[13px] border border-white/25 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              {hero.badge}
            </div>
            <h1 className="text-[42px] sm:text-[48px] lg:text-[52px] font-bold text-white leading-[1.15] mb-5 drop-shadow-sm">
              {hero.title}
            </h1>
            <p className="text-[17px] text-white/85 mb-7 max-w-2xl leading-relaxed">
              {hero.description}
            </p>
            <Button
              className="inline-flex items-center gap-2 bg-white text-primary hover:bg-primary/5 hover:-translate-y-0.5 px-7 h-12 rounded-full text-sm font-semibold shadow-lg transition-all"
              onClick={scrollToList}
            >
              {hero.ctaLabel} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {hero.right && (
            <div className="w-full lg:w-[460px] shrink-0 flex flex-col gap-4 pt-4">
              {hero.right}
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-8 -mt-10 relative z-20 w-full">
          <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f8fafc] cursor-default group"
              >
                <div
                  className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${
                    s.gradient || 'from-primary to-primary/80'
                  } shrink-0 overflow-hidden`}
                >
                  <s.icon className="w-7 h-7 relative z-10" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[28px] font-bold text-[#0f172a] leading-none tracking-tight">
                    {s.value.toLocaleString()}
                  </div>
                  <div className="text-[13px] text-[#64748b] mt-1 font-medium">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-8 py-6 w-full flex-1">
        {beforeList}

        <div ref={targetRef}>
          {/* Filter */}
          {hasFilter && (
            <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 mb-5">
              <div className="flex items-center gap-2.5 text-[16px] font-bold text-[#0f172a] mb-5">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
                <Filter className="w-4 h-4 text-primary" />
                {filterTitle}
              </div>
              <div className="space-y-0">{filterRows}</div>
              {activeFilters && activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-4 mt-3 border-t border-dashed border-[#cbd5e1]">
                  <span className="text-[13px] text-[#64748b]">已选条件：</span>
                  {activeFilters.map((f) => (
                    <span
                      key={f.type}
                      className="inline-flex items-center gap-1.5 bg-primary/5 text-primary text-xs px-2.5 py-1 rounded-full border border-primary/10"
                    >
                      {f.label}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors"
                        onClick={() => onRemoveFilter?.(f.type)}
                      />
                    </span>
                  ))}
                  <button
                    onClick={onClearFilters}
                    className="text-[13px] text-primary hover:text-primary font-medium"
                  >
                    清空筛选
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Toolbar */}
          {hasToolbar && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              {sortOptions && sortOptions.length > 0 && (
                <div className="flex items-center gap-0.5 bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm">
                  {sortOptions.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => onSortChange?.(s.value)}
                      className={`px-5 py-2 rounded-[10px] text-[13px] transition-all font-medium ${
                        sort === s.value
                          ? 'bg-primary text-white shadow-md'
                          : 'text-[#475569] hover:text-primary hover:bg-[#f8fafc]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {keyword !== undefined && (
                <div className="relative w-full sm:w-[340px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                  <Input
                    value={keyword}
                    onChange={(e) => onKeywordChange?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSearch?.()
                    }}
                    placeholder={searchPlaceholder}
                    className="pl-10 pr-[72px] h-11 bg-[#f8fafc] border-[#e7e5e4] rounded-xl text-sm shadow-sm focus:border-primary/30 focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all"
                  />
                  <Button
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[10px] px-5 h-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-xs font-medium shadow-sm hover:shadow-md transition-all"
                    onClick={onSearch}
                  >
                    搜索
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Count line */}
          {totalCount !== undefined && (
            <div className="text-[13px] text-[#64748b] mb-5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                当前共展示 <b className="text-primary">{totalCount}</b> {countLabel}
              </span>
            </div>
          )}

          {children}
        </div>
      </main>

      <PlatformFooter />
    </div>
  )
}

export function LandingSkeleton({
  count = 12,
  height = 'h-[360px]',
}: {
  count?: number
  height?: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-white rounded-2xl border border-[#e7e5e4] ${height} animate-pulse shadow-sm`}
        />
      ))}
    </div>
  )
}

export function LandingEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#f8fafc] flex items-center justify-center">
        <Search className="w-8 h-8 opacity-30" />
      </div>
      <div className="text-[15px] font-medium text-[#475569]">{title}</div>
      {hint && <div className="text-[13px] mt-1">{hint}</div>}
    </div>
  )
}
