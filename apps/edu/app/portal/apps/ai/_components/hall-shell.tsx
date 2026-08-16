'use client'

// AI 大厅页共享骨架（智能体大厅/知识库大厅共用，spec §2.1 大厅页）：
// 返回首页条 → 标题+统计 → 标签筛选 chips → 工具栏（计数/排序/搜索）→ 内容网格 → 加载更多。
// 视觉对齐 docs/demo 大厅原型，配色走系统 primary 主题。
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

export interface HallSortOption {
  value: string
  label: string
}

interface HallShellProps {
  title: string
  subtitle?: string
  headerIcon?: React.ReactNode
  stats?: { value: number | string; label: string }[]
  tags?: string[]
  activeTag?: string
  onTagChange?: (tag: string) => void
  sortOptions: HallSortOption[]
  sort: string
  onSortChange: (value: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  searchPlaceholder: string
  total: number
  loading: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  children: React.ReactNode
}

export function HallShell({
  title,
  subtitle,
  headerIcon,
  stats,
  tags,
  activeTag,
  onTagChange,
  sortOptions,
  sort,
  onSortChange,
  searchValue,
  onSearchChange,
  onSearch,
  searchPlaceholder,
  total,
  loading,
  hasMore,
  onLoadMore,
  children,
}: HallShellProps) {
  const t = useT()
  return (
    <div className="max-w-[1400px] mx-auto space-y-5 px-4 sm:px-8 py-6">
      {/* 渐变页头（对齐 exam-center 页头模式，负边距全幅出血） */}
      <div className="bg-gradient-to-br from-primary via-primary/75 to-primary/40 -mx-4 sm:-mx-8 -mt-6 px-4 sm:px-8 py-7 rounded-b-2xl shadow-[0_8px_24px_rgba(22,119,255,0.18)]">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/portal/apps/ai/landing"
            className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('返回首页')}
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
              {headerIcon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              {subtitle && <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* 统计条 */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-background px-4 py-3 shadow-sm"
            >
              <div className="text-xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 筛选工具面板 */}
      <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_2px_6px_rgba(0,0,0,0.04)] p-4 space-y-3">
      {/* 标签筛选 */}
      {tags && tags.length > 0 && onTagChange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">{t('按标签')}：</span>
          <Badge
            variant={!activeTag ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => onTagChange('')}
          >
            {t('全部')}
          </Badge>
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={activeTag === tag ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => onTagChange(activeTag === tag ? '' : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* 工具栏：计数 + 排序 + 搜索 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {t('共 {n} 个').replace('{n}', String(total))}
          </span>
          <div className="flex items-center gap-1">
            {sortOptions.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={sort === opt.value ? 'default' : 'ghost'}
                onClick={() => onSortChange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          onSearch={onSearch}
          placeholder={searchPlaceholder}
          wrapperClassName="w-full sm:w-72"
        />
      </div>
      </div>

      {/* 内容 */}
      {children}

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2 pb-6">
          <Button variant="outline" onClick={onLoadMore}>
            {t('加载更多')}
          </Button>
        </div>
      )}
    </div>
  )
}
