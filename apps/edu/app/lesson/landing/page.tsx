'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Layers, FileText, GraduationCap } from 'lucide-react'
import { courseApi } from '@/lib/api'
import type { Course } from '@/lib/types'
import { coverGradientFor } from '@/lib/cover-gradients'
import { LandingFilterRow } from '@/components/shared/landing-filter-row'
import { LandingPagination } from '@/components/shared/landing-pagination'
import { LandingShell, LandingSkeleton, LandingEmpty } from '@/components/shared/landing-shell'
import { formatDate } from '@/lib/format-utils'

const CARDS_PER_PAGE = 12
const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' },
]

function CourseCard({ course }: { course: Course; index: number }) {
  const creatorName = course.creatorName || course.creatorId?.slice(0, 8) || '-'
  const coverStyle = course.coverImage
    ? { backgroundImage: `url('${course.coverImage}')` }
    : { background: coverGradientFor(course.id) }

  return (
    <Link href={`/lesson/landing/${course.id}`} className="group block no-underline text-inherit">
      <div className="group bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 cursor-pointer h-full flex flex-col">
        <div
          className="h-44 relative bg-cover bg-center flex flex-col justify-end p-4"
          style={coverStyle}
        >
          {!course.coverImage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <BookOpen
                className="w-12 h-12 text-white/85 drop-shadow-md"
                strokeWidth={1.5}
              />
            </div>
          )}
          <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
            <div className="flex gap-1.5">
              <span className="bg-[#0f172a]/40 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/20">
                {course.version || 'v1.0'}
              </span>
              <span className="bg-[#0f172a]/40 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/20">
                创建人：{creatorName}
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-base font-bold leading-snug mb-1 line-clamp-2 text-white text-shadow-md group-hover:text-white/90 transition-colors">
              {course.name}
            </div>
            <div className="text-xs text-white/85 text-shadow-sm">
              课程编码：{course.code || course.id.slice(0, 8)}
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5 flex-1 flex flex-col">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-50 rounded-xl p-2 sm:p-2.5 text-center border border-slate-100">
              <div className="text-base sm:text-lg font-bold text-slate-800">
                {course.viewCount ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">浏览次数</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2 sm:p-2.5 text-center border border-slate-100">
              <div className="text-base sm:text-lg font-bold text-slate-800">
                {course.nodeCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">关联节点</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2 sm:p-2.5 text-center border border-slate-100">
              <div className="text-base sm:text-lg font-bold text-slate-800">
                {course.resourceCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">关联资源</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100 font-medium">
              面向行业：{course.industryName || '未分类'}
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/5 text-primary border border-primary/10 font-medium">
              适用专业：{course.majorName || '未分类'}
            </span>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2.5">
            <span className="text-xs text-slate-500">收录：{formatDate(course.createdAt)}</span>
            <span className="text-xs text-slate-500">更新：{formatDate(course.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function LessonLandingPage() {
  const listRef = useRef<HTMLDivElement>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState('default')
  const [keyword, setKeyword] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('全部')
  const [selectedBatch, setSelectedBatch] = useState('全部')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await courseApi.list({ status: 'published', limit: 1000 } as any)
        setCourses(res.items || [])
      } catch {
        setCourses([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const industries = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c) => {
      if (c.industryName) set.add(c.industryName)
    })
    return ['全部', ...Array.from(set).sort()]
  }, [courses])

  const batches = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c) => {
      if (c.batchName) set.add(c.batchName)
    })
    return ['全部', ...Array.from(set).sort()]
  }, [courses])

  const filtered = useMemo(() => {
    let list = [...courses]

    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(k) ||
          (c.description || '').toLowerCase().includes(k) ||
          (c.majorName || '').toLowerCase().includes(k),
      )
    }
    if (selectedIndustry !== '全部') list = list.filter((c) => c.industryName === selectedIndustry)
    if (selectedBatch !== '全部') list = list.filter((c) => c.batchName === selectedBatch)

    switch (sort) {
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'update':
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      default:
        list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        break
    }
    return list
  }, [courses, keyword, selectedIndustry, selectedBatch, sort])

  const systemCourses = useMemo(() => filtered.filter((c) => c.type === 'system'), [filtered])
  const granularCourses = useMemo(() => filtered.filter((c) => c.type === 'granular'), [filtered])

  const totalPages = Math.max(1, Math.ceil(systemCourses.length / CARDS_PER_PAGE))
  const pageSystemCourses = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE
    return systemCourses.slice(start, start + CARDS_PER_PAGE)
  }, [systemCourses, currentPage])

  useEffect(() => {
    ;(async () => {
      setCurrentPage(1)
    })()
  }, [selectedIndustry, selectedBatch, keyword, sort])

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string }[] = []
    if (selectedIndustry !== '全部')
      filters.push({ type: 'industry', label: `行业：${selectedIndustry}` })
    if (selectedBatch !== '全部') filters.push({ type: 'batch', label: `批次：${selectedBatch}` })
    if (keyword.trim()) filters.push({ type: 'keyword', label: `关键词：${keyword.trim()}` })
    return filters
  }, [selectedIndustry, selectedBatch, keyword])

  const executeSearch = () => {
    setCurrentPage(1)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const removeFilter = (type: string) => {
    if (type === 'industry') setSelectedIndustry('全部')
    if (type === 'batch') setSelectedBatch('全部')
    if (type === 'keyword') setKeyword('')
  }

  const clearFilters = () => {
    setSelectedIndustry('全部')
    setSelectedBatch('全部')
    setKeyword('')
  }

  const totalNodes = courses.reduce((sum, c) => sum + (c.nodeCount || 0), 0)
  const totalResources = courses.reduce((sum, c) => sum + (c.resourceCount || 0), 0)

  return (
    <LandingShell
      hero={{
        badge: '体系化课程 · 颗粒化知识管理',
        title: (
          <>
            课程教学管理平台
            <br />
            <span className="text-white/80">从基础到进阶，系统提升专业能力</span>
          </>
        ),
        description: '体系化课程设计、颗粒化知识点管理、多维度教学资源整合，让教与学更高效',
        ctaLabel: '浏览课程',
      }}
      stats={[
        {
          icon: BookOpen,
          value: systemCourses.length,
          label: '体系课',
          gradient: 'from-primary to-primary/80',
        },
        {
          icon: Layers,
          value: granularCourses.length,
          label: '颗粒课',
          gradient: 'from-primary/90 to-primary/70',
        },
        {
          icon: FileText,
          value: totalResources,
          label: '教学资源',
          gradient: 'from-primary/80 to-primary/60',
        },
        {
          icon: GraduationCap,
          value: totalNodes,
          label: '课程节点',
          gradient: 'from-primary/90 to-primary/70',
        },
      ]}
      filterTitle="课程筛选"
      filterRows={
        <>
          {industries.length > 1 && (
            <LandingFilterRow
              label="行业"
              items={industries}
              selected={selectedIndustry}
              onSelect={setSelectedIndustry}
              accentColor="primary"
            />
          )}
          {batches.length > 1 && (
            <LandingFilterRow
              label="批次"
              items={batches}
              selected={selectedBatch}
              onSelect={setSelectedBatch}
              showBorder={industries.length <= 1}
              accentColor="primary"
            />
          )}
        </>
      }
      activeFilters={activeFilters}
      onRemoveFilter={removeFilter}
      onClearFilters={clearFilters}
      sortOptions={SORT_OPTIONS}
      sort={sort}
      onSortChange={setSort}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onSearch={executeSearch}
      searchPlaceholder="搜索课程名称、描述或专业"
      totalCount={filtered.length}
      countLabel="个课程"
      listRef={listRef}
    >
      {loading ? (
        <LandingSkeleton />
      ) : filtered.length === 0 ? (
        <LandingEmpty title="暂无匹配的课程" hint="试试调整筛选条件或搜索关键词" />
      ) : (
        <>
          {/* 体系课 */}
          {systemCourses.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
                  体系课
                  <span className="text-[13px] text-[#64748b] font-normal ml-1">
                    ({systemCourses.length})
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {pageSystemCourses.map((course, i) => (
                  <CourseCard key={course.id} course={course} index={i} />
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
            </div>
          )}

          {/* 颗粒课 */}
          {granularCourses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
                  颗粒课
                  <span className="text-[13px] text-[#64748b] font-normal ml-1">
                    ({granularCourses.length})
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {granularCourses.map((course, i) => (
                  <CourseCard key={course.id} course={course} index={i} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </LandingShell>
  )
}
