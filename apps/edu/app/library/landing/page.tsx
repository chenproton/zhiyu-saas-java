'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye,
  Building2,
  GraduationCap,
  Clock,
  Video,
  FileText,
  Table,
  Image as ImageIcon,
  Link2,
  Music,
  Archive,
  MapPin,
  Wrench,
  Cpu,
  Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'
import {
  resourceLibraryApi,
} from '@/lib/api'
import { RESOURCE_TYPE_LABELS } from '@/lib/types/library'
import type { ResourceLibraryItem } from '@/lib/types/library'
import { formatSize } from '@/lib/resource-type-constants'
import { reportError } from '@/lib/error-handling'
import { LandingFilterRow } from '@/components/shared/landing-filter-row'
import { LandingPagination } from '@/components/shared/landing-pagination'
import { LandingShell, LandingSkeleton, LandingEmpty } from '@/components/shared/landing-shell'

// 资源类型展示顺序（与共享 RESOURCE_TYPE_LABELS 对应）
const ALL_TYPES = Object.keys(RESOURCE_TYPE_LABELS) as (keyof typeof RESOURCE_TYPE_LABELS)[]

const TYPE_EMOJI: Record<string, string> = {
  video: '🎬',
  document: '📄',
  spreadsheet: '📊',
  image: '🖼️',
  link: '🔗',
  audio: '🎵',
  archive: '📦',
  venue: '📍',
  facility: '🔧',
  software: '💻',
  other: '📦',
}

const TYPE_COLORS: Record<string, string> = {
  video: '#3b82f6',
  document: '#f97316',
  spreadsheet: '#22c55e',
  image: '#a855f7',
  link: '#06b6d4',
  audio: '#ec4899',
  venue: '#ef4444',
  facility: '#64748b',
  software: '#6366f1',
  archive: '#14b8a6',
  other: '#78716c',
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  video: Video,
  document: FileText,
  spreadsheet: Table,
  image: ImageIcon,
  link: Link2,
  audio: Music,
  archive: Archive,
  venue: MapPin,
  facility: Wrench,
  software: Cpu,
  other: Package,
}

const STAT_GRADIENTS = [
  'from-primary to-primary/80',
  'from-primary/90 to-primary/70',
  'from-primary/80 to-primary/60',
  'from-primary/90 to-primary/70',
]

const TIME_RANGES = [
  { value: 'all', label: '全部时间' },
  { value: 'week', label: '近一周' },
  { value: 'month', label: '近一月' },
  { value: 'year', label: '近一年' },
]

const TYPE_FILTER_ITEMS = [
  '全部',
  ...ALL_TYPES.map((t) => `${TYPE_EMOJI[t] || '📦'} ${RESOURCE_TYPE_LABELS[t] || t}`),
]

const CARDS_PER_PAGE = 12

function typeLabel(type: string): string {
  if (type === '全部') return '全部'
  const idx = ALL_TYPES.indexOf(type as keyof typeof RESOURCE_TYPE_LABELS)
  return idx >= 0 ? TYPE_FILTER_ITEMS[idx + 1] : type
}

function typeFromLabel(label: string): string {
  if (label === '全部') return '全部'
  return (
    ALL_TYPES.find(
      (t) => `${TYPE_EMOJI[t] || '📦'} ${RESOURCE_TYPE_LABELS[t] || t}` === label,
    ) || '全部'
  )
}

function timeLabel(value: string): string {
  return TIME_RANGES.find((r) => r.value === value)?.label || '全部时间'
}

function timeFromLabel(label: string): string {
  return TIME_RANGES.find((r) => r.label === label)?.value || 'all'
}

function ResourceCard({
  resource,
  onPreview,
}: {
  resource: ResourceLibraryItem
  onPreview: (resource: ResourceLibraryItem) => void
}) {
  const color = TYPE_COLORS[resource.resourceType] || TYPE_COLORS.other
  const hasPreview = !!resource.url
  const TypeIcon = TYPE_ICONS[resource.resourceType] || Package
  const coverStyle = resource.thumbnail
    ? {
        backgroundImage: `url('${resource.thumbnail}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #0f172a))`,
      }
  return (
    <button
      onClick={() => onPreview(resource)}
      disabled={!hasPreview}
      className={`group bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 cursor-pointer h-full flex flex-col w-full text-left shadow-[0_2px_6px_rgba(0,0,0,0.04)] ${
        hasPreview ? '' : 'opacity-85 cursor-default'
      }`}
    >
      <div
        className="h-[110px] relative shrink-0 flex items-center justify-center"
        style={coverStyle}
      >
        {!resource.thumbnail && (
          <TypeIcon className="w-12 h-12 text-white/80" strokeWidth={1.5} />
        )}
        <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
          {RESOURCE_TYPE_LABELS[resource.resourceType] || resource.resourceType}
        </span>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-[15px] font-semibold text-slate-800 leading-snug line-clamp-2 mb-2">
          {resource.name}
        </h3>

        {(resource.uploaderOrgName || resource.uploaderMajorName) && (
          <div className="flex items-center gap-3 mb-2 text-[11px] text-[#94a3b8]">
            {resource.uploaderOrgName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {resource.uploaderOrgName}
              </span>
            )}
            {resource.uploaderMajorName && (
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                {resource.uploaderMajorName}
              </span>
            )}
          </div>
        )}

        {resource.description && (
          <p className="text-xs text-[#94a3b8] leading-relaxed mb-3 line-clamp-2">
            {resource.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50 text-[11px] text-[#cbd5e1]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(resource.createdAt).toLocaleDateString('zh-CN', {
              month: 'numeric',
              day: 'numeric',
            })}
          </span>
          {resource.fileSize != null && <span>{formatSize(resource.fileSize)}</span>}
          {hasPreview && (
            <span className="flex items-center gap-1 font-medium" style={{ color }}>
              预览 <Eye className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function LibraryLandingPage() {
  const listRef = useRef<HTMLDivElement>(null)
  const [resources, setResources] = useState<ResourceLibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('全部')
  const [timeFilter, setTimeFilter] = useState('all')
  const [orgFilter, setOrgFilter] = useState('全部')
  const [majorFilter, setMajorFilter] = useState('全部')
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const resRes = await resourceLibraryApi.list({ limit: 500 })
        setResources(resRes.items)
      } catch (err) {
        reportError(err, '加载 landing 资源统计')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const r of resources) {
      stats[r.resourceType] = (stats[r.resourceType] || 0) + 1
    }
    stats['total'] = resources.length
    return stats
  }, [resources])

  const orgNames = useMemo(() => {
    const set = new Set<string>()
    for (const r of resources) {
      if (r.uploaderOrgName) set.add(r.uploaderOrgName)
    }
    return Array.from(set).sort()
  }, [resources])

  const majorNames = useMemo(() => {
    const set = new Set<string>()
    if (orgFilter === '全部') {
      for (const r of resources) {
        if (r.uploaderMajorName) set.add(r.uploaderMajorName)
      }
    } else {
      for (const r of resources) {
        if (r.uploaderOrgName === orgFilter && r.uploaderMajorName) set.add(r.uploaderMajorName)
      }
    }
    return Array.from(set).sort()
  }, [resources, orgFilter])

  const topTypes = useMemo(() => {
    return ALL_TYPES.filter((t) => (typeStats[t] || 0) > 0)
      .map((t) => ({ type: t, count: typeStats[t] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [typeStats])

  const [now] = useState(() => Date.now())

  const filteredResources = useMemo(() => {
    let list = resources
    if (typeFilter !== '全部') list = list.filter((r) => r.resourceType === typeFilter)
    if (timeFilter !== 'all') {
      const ms =
        timeFilter === 'week'
          ? 7 * 86400000
          : timeFilter === 'month'
            ? 30 * 86400000
            : 365 * 86400000
      list = list.filter((r) => now - new Date(r.createdAt).getTime() < ms)
    }
    if (orgFilter !== '全部') list = list.filter((r) => r.uploaderOrgName === orgFilter)
    if (majorFilter !== '全部') list = list.filter((r) => r.uploaderMajorName === majorFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q),
      )
    }
    if (sortBy === 'popular') {
      list = [...list].sort(
        (a, b) =>
          (b.metadata?.viewCount ?? 0) - (a.metadata?.viewCount ?? 0) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    } else {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }
    return list
  }, [resources, typeFilter, search, timeFilter, orgFilter, majorFilter, sortBy, now])

  useEffect(() => {
    ;(async () => {
      setCurrentPage(1)
    })()
  }, [typeFilter, search, timeFilter, orgFilter, majorFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredResources.length / CARDS_PER_PAGE))
  const pageResources = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE
    return filteredResources.slice(start, start + CARDS_PER_PAGE)
  }, [filteredResources, currentPage])

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string }[] = []
    if (typeFilter !== '全部') filters.push({ type: 'type', label: `分类：${typeLabel(typeFilter)}` })
    if (timeFilter !== 'all') filters.push({ type: 'time', label: `时间：${timeLabel(timeFilter)}` })
    if (orgFilter !== '全部') filters.push({ type: 'org', label: `院系：${orgFilter}` })
    if (majorFilter !== '全部') filters.push({ type: 'major', label: `专业：${majorFilter}` })
    if (search.trim()) filters.push({ type: 'keyword', label: `关键词：${search.trim()}` })
    return filters
  }, [typeFilter, timeFilter, orgFilter, majorFilter, search])

  const removeFilter = (type: string) => {
    if (type === 'type') setTypeFilter('全部')
    if (type === 'time') setTimeFilter('all')
    if (type === 'org') setOrgFilter('全部')
    if (type === 'major') setMajorFilter('全部')
    if (type === 'keyword') setSearch('')
  }

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('全部')
    setTimeFilter('all')
    setOrgFilter('全部')
    setMajorFilter('全部')
  }

  const executeSearch = () => {
    setCurrentPage(1)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <>
      <LandingShell
        hero={{
          badge: '教学资产 · 一站式共享',
          title: (
            <>
              教学资产共享中心
              <br />
              <span className="text-white/80">汇聚教学资源，服务一线教师</span>
            </>
          ),
          description: '汇聚视频、文档、软件、场地等教学资源，为教师提供一站式资源共享服务',
          ctaLabel: '浏览资源',
        }}
        stats={topTypes.map((s, i) => ({
          icon: TYPE_ICONS[s.type] || Package,
          value: s.count,
          label: RESOURCE_TYPE_LABELS[s.type] || s.type,
          gradient: STAT_GRADIENTS[i % STAT_GRADIENTS.length],
        }))}
        filterTitle="资源筛选"
        filterRows={
          <>
            <LandingFilterRow
              label="分类"
              items={TYPE_FILTER_ITEMS}
              selected={typeFilter === '全部' ? '全部' : typeLabel(typeFilter)}
              onSelect={(d) => setTypeFilter(typeFromLabel(d))}
              accentColor="primary"
            />
            <LandingFilterRow
              label="时间"
              items={TIME_RANGES.map((r) => r.label)}
              selected={timeLabel(timeFilter)}
              onSelect={(d) => setTimeFilter(timeFromLabel(d))}
              accentColor="primary"
            />
            <LandingFilterRow
              label="院系"
              items={['全部', ...orgNames]}
              selected={orgFilter}
              onSelect={(d) => {
                setOrgFilter(d)
                setMajorFilter('全部')
              }}
              accentColor="primary"
            />
            <LandingFilterRow
              label="专业"
              items={orgFilter === '全部' ? ['全部'] : ['全部', ...majorNames]}
              selected={majorFilter}
              onSelect={setMajorFilter}
              showBorder={false}
              accentColor="primary"
            />
          </>
        }
        activeFilters={activeFilters}
        onRemoveFilter={removeFilter}
        onClearFilters={clearFilters}
        sortOptions={[
          { value: 'newest', label: '最新' },
          { value: 'popular', label: '热门' },
        ]}
        sort={sortBy}
        onSortChange={(v) => setSortBy(v as 'newest' | 'popular')}
        keyword={search}
        onKeywordChange={setSearch}
        onSearch={executeSearch}
        searchPlaceholder="搜索视频、文档、软件、场地等教学资源..."
        totalCount={filteredResources.length}
        countLabel="个资源"
        listRef={listRef}
      >
        {loading ? (
          <LandingSkeleton />
        ) : filteredResources.length === 0 ? (
          <LandingEmpty title="暂无符合条件的资源" hint="试试调整筛选条件或搜索关键词" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {pageResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onPreview={(r) => addPreviewResource(r as any)}
                />
              ))}
            </div>
            <LandingPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => {
                setCurrentPage(p)
                listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              accentColor="primary"
            />
          </>
        )}
      </LandingShell>

      {previewResources.length > 0 && (
        <div
          className="fixed inset-0 bg-black/40 z-[90]"
          onClick={() => previewResources.forEach((r) => removePreviewResource(r.id))}
        />
      )}
      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}
    </>
  )
}
