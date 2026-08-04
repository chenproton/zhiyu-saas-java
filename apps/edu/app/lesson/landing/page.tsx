'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Filter,
  X,
  ChevronRight,
  BookOpen,
  Layers,
  FileText,
  GraduationCap,
  Clock,
  Sparkles,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { courseApi } from '@/lib/api'
import type { Course } from '@/lib/types'
import { PlatformFooter } from '@/components/job/student/platform-footer'
import { LandingFilterRow } from '@/components/shared/landing-filter-row'
import { LandingPagination } from '@/components/shared/landing-pagination'

const CARDS_PER_PAGE = 12
const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' },
]

const coverGradients = [
  'linear-gradient(135deg,#059669,#10b981)',
  'linear-gradient(135deg,#0891b2,#06b6d4)',
  'linear-gradient(135deg,#7c3aed,#8b5cf6)',
  'linear-gradient(135deg,#db2777,#ec4899)',
  'linear-gradient(135deg,#ea580c,#f97316)',
  'linear-gradient(135deg,#2563eb,#3b82f6)',
]

function CourseCard({ course, index }: { course: Course; index: number }) {
  return (
    <Link href={`/lesson/landing/${course.id}`} className="group block no-underline text-inherit">
      <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-emerald-200 hover:-translate-y-0.5 transition-all h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <div
          className="h-[120px] flex items-center justify-center shrink-0 relative bg-cover bg-center"
          style={
            course.coverImage
              ? { backgroundImage: `url('${course.coverImage}')` }
              : { background: coverGradients[index % coverGradients.length] }
          }
        >
          {!course.coverImage && (
            <span className="text-white text-lg font-bold drop-shadow-lg">
              {course.name.slice(0, 8)}
            </span>
          )}
          <span className="absolute top-3 right-3 bg-white/25 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
            已发布
          </span>
          {course.batchName && (
            <span className="absolute bottom-3 left-3 bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] border border-white/10">
              {course.batchName}
            </span>
          )}
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[15px] font-semibold text-slate-800 mb-1.5 truncate">
            {course.name}
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {course.majorName && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {course.majorName}
              </span>
            )}
            {course.industryName && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-100">
                {course.industryName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">
            {course.description || '暂无课程描述'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-50 pt-3">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" /> {course.nodeCount} 节点
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {course.resourceCount} 资源
            </span>
            <span className="flex items-center gap-1">
              <GraduationCap className="w-3 h-3" /> {course.studyCount} 人次
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {course.onlineHours || 0}h
            </span>
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

  const totalNodes = courses.reduce((sum, c) => sum + (c.nodeCount || 0), 0)
  const totalResources = courses.reduce((sum, c) => sum + (c.resourceCount || 0), 0)

  return (
    <div className="min-h-screen flex flex-col bg-[#F1FAFF]">
      {/* Hero Banner */}
      <div className="relative w-full pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(5,150,105,0.88)] via-[rgba(16,185,129,0.78)] to-[rgba(20,184,166,0.78)]" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '52px 52px',
          }}
        />
        <div className="absolute top-[-120px] right-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-300/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[8%] w-[400px] h-[400px] rounded-full bg-teal-400/15 blur-[100px] pointer-events-none" />
        <div className="absolute top-[20%] left-[30%] w-[300px] h-[300px] rounded-full bg-cyan-400/10 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pb-14 pt-2 flex flex-col lg:flex-row justify-between items-start gap-8">
          <div className="flex-1 pt-4">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-[13px] border border-white/25 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              体系化课程 · 颗粒化知识管理
            </div>
            <h1 className="text-[42px] sm:text-[48px] lg:text-[52px] font-bold text-white leading-[1.15] mb-5 drop-shadow-sm">
              课程教学管理平台
              <br />
              <span className="text-emerald-200">从基础到进阶，系统提升专业能力</span>
            </h1>
            <p className="text-[17px] text-white/85 mb-7 max-w-2xl leading-relaxed">
              体系化课程设计、颗粒化知识点管理、多维度教学资源整合，让教与学更高效
            </p>
            <Button
              className="inline-flex items-center gap-2 bg-white text-emerald-600 hover:bg-emerald-50 hover:-translate-y-0.5 px-7 h-12 rounded-full text-sm font-semibold shadow-lg transition-all"
              onClick={() =>
                listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              浏览课程 <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-7 text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
              <div className="text-[15px] font-bold text-white/90 mb-5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                  📊
                </span>
                课程统计
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-white/65">课程总数</span>
                  <span className="text-[26px] font-bold">{courses.length.toLocaleString()}</span>
                </div>
                <hr className="border-white/8" />
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-white/65">课程节点</span>
                  <span className="text-[26px] font-bold">{totalNodes.toLocaleString()}</span>
                </div>
                <hr className="border-white/8" />
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-white/65">教学资源</span>
                  <span className="text-[26px] font-bold">{totalResources.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-[1400px] mx-auto px-8 -mt-10 relative z-20 w-full">
        <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: BookOpen,
              value: systemCourses.length,
              label: '体系课',
              gradient: 'from-emerald-500 to-emerald-400',
            },
            {
              icon: Layers,
              value: granularCourses.length,
              label: '颗粒课',
              gradient: 'from-teal-500 to-teal-400',
            },
            {
              icon: FileText,
              value: totalResources,
              label: '教学资源',
              gradient: 'from-cyan-500 to-cyan-400',
            },
            {
              icon: GraduationCap,
              value: totalNodes,
              label: '课程节点',
              gradient: 'from-green-500 to-green-400',
            },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[#f8fafc] cursor-default group"
            >
              <div
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${s.gradient} shrink-0 overflow-hidden`}
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

      <main ref={listRef} className="max-w-[1400px] mx-auto px-8 py-6 w-full flex-1">
        {/* Filter */}
        <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 mb-5">
          <div className="flex items-center gap-2.5 text-[16px] font-bold text-[#0f172a] mb-5">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
            <Filter className="w-4 h-4 text-emerald-500" />
            课程筛选
          </div>
          <div className="space-y-0">
            {industries.length > 1 && (
              <LandingFilterRow
                label="行业"
                items={industries}
                selected={selectedIndustry}
                onSelect={setSelectedIndustry}
                accentColor="emerald"
              />
            )}
            {batches.length > 1 && (
              <LandingFilterRow
                label="批次"
                items={batches}
                selected={selectedBatch}
                onSelect={setSelectedBatch}
                showBorder={industries.length <= 1}
                accentColor="emerald"
              />
            )}
          </div>
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-4 mt-3 border-t border-dashed border-[#cbd5e1]">
              <span className="text-[13px] text-[#64748b]">已选条件：</span>
              {activeFilters.map((f) => (
                <span
                  key={f.type}
                  className="inline-flex items-center gap-1.5 bg-[#ecfdf5] text-emerald-600 text-xs px-2.5 py-1 rounded-full border border-emerald-100"
                >
                  {f.label}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors"
                    onClick={() => {
                      if (f.type === 'industry') setSelectedIndustry('全部')
                      if (f.type === 'batch') setSelectedBatch('全部')
                      if (f.type === 'keyword') setKeyword('')
                    }}
                  />
                </span>
              ))}
              <button
                onClick={() => {
                  setSelectedIndustry('全部')
                  setSelectedBatch('全部')
                  setKeyword('')
                }}
                className="text-[13px] text-emerald-600 hover:text-emerald-700 font-medium"
              >
                清空筛选
              </button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-0.5 bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`px-5 py-2 rounded-[10px] text-[13px] transition-all font-medium ${
                  sort === s.value
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-[#475569] hover:text-emerald-600 hover:bg-[#f8fafc]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-[340px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeSearch()
              }}
              placeholder="搜索课程名称、描述或专业"
              className="pl-10 pr-[72px] h-11 bg-[#f8fafc] border-[#e7e5e4] rounded-xl text-sm shadow-sm focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 focus:bg-white transition-all"
            />
            <Button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[10px] px-5 h-8 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500 text-white text-xs font-medium shadow-sm hover:shadow-md transition-all"
              onClick={executeSearch}
            >
              搜索
            </Button>
          </div>
        </div>

        <div className="text-[13px] text-[#64748b] mb-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            当前共展示 <b className="text-emerald-600">{filtered.length}</b> 个课程
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#e7e5e4] h-[360px] animate-pulse shadow-sm"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#f8fafc] flex items-center justify-center">
              <Search className="w-8 h-8 opacity-30" />
            </div>
            <div className="text-[15px] font-medium text-[#475569]">暂无匹配的课程</div>
            <div className="text-[13px] mt-1">试试调整筛选条件或搜索关键词</div>
          </div>
        ) : (
          <>
            {/* 体系课 */}
            {systemCourses.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
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
                  accentColor="emerald"
                />
              </div>
            )}

            {/* 颗粒课 */}
            {granularCourses.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
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
      </main>

      <PlatformFooter />

      <style jsx>{`
        .custom-scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}
