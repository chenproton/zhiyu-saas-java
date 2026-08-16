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
  hasMore: boolean
  onLoadMore: () => void
  children: React.ReactNode
}

export function HallShell({
  title,
  subtitle,
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
    <div className="max-w-6xl mx-auto space-y-5 px-4 sm:px-8 py-6">
      {/* 返回 + 标题 */}
      <div>
        <Link
          href="/portal/apps/ai/landing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('返回首页')}
        </Link>
        <div className="mt-3 flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
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
