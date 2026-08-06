'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  Heart,
  BookOpen,
  Layers,
  FileText,
  Library,
  ClipboardList,
  Loader2,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { StatusBadge, useToast } from '@zhiyu/ui'
import { SectionCard } from './section-card'
import { favoriteApi, positionApi } from '@/lib/api'
import type { CareerPosition, Scenario, Course, QuestionBank, Exam } from '@/lib/types'
import type { FavoriteTargetType } from '@/lib/api'
import { JobCard } from '@/components/job/student/job-card'
import { SceneCard } from '@/components/scene/student/scene-card'

const coverGradients = [
  'linear-gradient(135deg,#1e3a8a,#3b7cff)',
  'linear-gradient(135deg,#7c2d12,#dc2626)',
  'linear-gradient(135deg,#064e3b,#0891b2)',
  'linear-gradient(135deg,#334155,#64748b)',
  'linear-gradient(135deg,#581c87,#a855f7)',
  'linear-gradient(135deg,#1e40af,#3b82f6)',
]

interface FavoritesState {
  jobs: CareerPosition[]
  scenes: Scenario[]
  courses: Course[]
  banks: QuestionBank[]
  exams: Exam[]
}

const emptyFavorites: FavoritesState = {
  jobs: [],
  scenes: [],
  courses: [],
  banks: [],
  exams: [],
}

const categoryConfig = {
  jobs: { label: '职业岗位', icon: Briefcase, color: 'blue' as const },
  scenes: { label: '实践场景', icon: Layers, color: 'amber' as const },
  courses: { label: '数字课程', icon: BookOpen, color: 'emerald' as const },
  exams: { label: '测评资源', icon: FileText, color: 'purple' as const },
}

// 分类 -> 收藏实体集合的键名映射（测评资源含题库与试卷）
const categoryKeys: Record<string, (keyof FavoritesState)[]> = {
  all: ['jobs', 'scenes', 'courses', 'banks', 'exams'],
  jobs: ['jobs'],
  scenes: ['scenes'],
  courses: ['courses'],
  exams: ['banks', 'exams'],
}

function CoverBadge({ label }: { label: string }) {
  return (
    <span className="absolute top-3 right-3 bg-white/25 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-white/10">
      {label}
    </span>
  )
}

function CourseCoverCard({
  course,
  index,
  onUnfavorite,
}: {
  course: Course
  index: number
  onUnfavorite: () => void
}) {
  return (
    <div className="relative group">
      <Link href={`/lesson/landing/${course.id}`} className="group block no-underline text-inherit">
        <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-emerald-200 hover:-translate-y-0.5 transition-all h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <div
            className="h-[110px] flex items-center justify-center shrink-0 relative bg-cover bg-center"
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
            <CoverBadge label="已发布" />
            {course.batchName && (
              <span className="absolute bottom-3 left-3 bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] border border-white/10">
                {course.batchName}
              </span>
            )}
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-800 mb-1.5 truncate">{course.name}</h3>
            {course.majorName && (
              <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {course.majorName}
              </p>
            )}
            <div className="mt-auto flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-2">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" /> {course.nodeCount} 节点
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> {course.resourceCount} 资源
              </span>
            </div>
          </div>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUnfavorite()
        }}
        className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/90 hover:text-rose-300 transition-colors"
        title="取消收藏"
      >
        <Heart className="w-3 h-3 fill-current" />
        取消收藏
      </button>
    </div>
  )
}

function BankCard({
  bank,
  index,
  onUnfavorite,
}: {
  bank: QuestionBank
  index: number
  onUnfavorite: () => void
}) {
  return (
    <div className="relative group">
      <Link
        href={`/evaluation/landing/banks/${bank.id}`}
        className="group block no-underline text-inherit"
      >
        <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)] hover:border-blue-200 hover:-translate-y-1 transition-all h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <div
            className="h-[110px] flex items-center justify-center shrink-0 relative"
            style={
              bank.coverImage
                ? {
                    backgroundImage: `url('${bank.coverImage}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : { background: coverGradients[(index + 2) % coverGradients.length] }
            }
          >
            {!bank.coverImage && <Library className="w-12 h-12 text-white/80" />}
            <CoverBadge label={`v${bank.version}`} />
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-800 mb-1.5 truncate">{bank.name}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">
              {bank.description || '暂无描述'}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-2">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" /> {bank.questionCount} 题
              </span>
              <span className="text-blue-500 group-hover:text-blue-600 font-medium">
                查看详情 →
              </span>
            </div>
          </div>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUnfavorite()
        }}
        className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/90 hover:text-rose-300 transition-colors"
        title="取消收藏"
      >
        <Heart className="w-3 h-3 fill-current" />
        取消收藏
      </button>
    </div>
  )
}

function ExamCard({
  exam,
  index,
  onUnfavorite,
}: {
  exam: Exam
  index: number
  onUnfavorite: () => void
}) {
  return (
    <div className="relative group">
      <Link
        href={`/evaluation/landing/exams/${exam.id}`}
        className="group block no-underline text-inherit"
      >
        <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)] hover:border-blue-200 hover:-translate-y-1 transition-all h-full flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <div
            className="h-[110px] flex items-center justify-center shrink-0 relative"
            style={
              exam.coverImage
                ? {
                    backgroundImage: `url('${exam.coverImage}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : { background: coverGradients[(index + 4) % coverGradients.length] }
            }
          >
            {!exam.coverImage && <ClipboardList className="w-12 h-12 text-white/80" />}
            <CoverBadge label={`${exam.duration} 分钟`} />
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-800 mb-1.5 truncate">{exam.name}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3 line-clamp-2 flex-1">
              {exam.description || '暂无描述'}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-50 pt-2">
              <span className="flex items-center gap-1">
                <ClipboardList className="w-3 h-3" /> {exam.totalScore} 分
              </span>
              <StatusBadge status={exam.status} className="text-[10px] px-1.5 py-0.5 rounded" />
            </div>
          </div>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUnfavorite()
        }}
        className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/90 hover:text-rose-300 transition-colors"
        title="取消收藏"
      >
        <Heart className="w-3 h-3 fill-current" />
        取消收藏
      </button>
    </div>
  )
}

export function CareerTab() {
  const { toast } = useToast()
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<FavoritesState>(emptyFavorites)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [jobsRes, favRes] = await Promise.all([
          positionApi.listFavorites().catch(() => null),
          favoriteApi.list().catch(() => null),
        ])
        if (cancelled) return
        setFavorites({
          jobs: jobsRes?.items || [],
          scenes: favRes?.scene || [],
          courses: favRes?.course || [],
          banks: favRes?.question_bank || [],
          exams: favRes?.exam || [],
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const removeFavorite = (key: keyof FavoritesState, id: string) => {
    setFavorites((prev) => ({
      ...prev,
      [key]: prev[key].filter((item) => item.id !== id),
    }))
  }

  const handleUnfavorite = async (
    key: keyof FavoritesState,
    id: string,
    targetType?: FavoriteTargetType,
  ) => {
    try {
      if (targetType) {
        await favoriteApi.toggle(targetType, id)
      } else {
        await positionApi.favorite(id)
      }
      removeFavorite(key, id)
    } catch {
      toast({ variant: 'destructive', title: '操作失败', description: '取消收藏失败，请稍后再试' })
    }
  }

  const cats = Object.entries(categoryConfig).map(([k, v]) => ({ id: k, ...v }))
  const visibleKeys = categoryKeys[activeCategory]

  const totalCount =
    favorites.jobs.length +
    favorites.scenes.length +
    favorites.courses.length +
    favorites.banks.length +
    favorites.exams.length

  return (
    <div className="space-y-5">
      <SectionCard title="我的收藏" icon={Heart} iconColor="rose">
        {/* 分类筛选 */}
        <div className="flex items-center gap-5 mb-5 border-b border-gray-100">
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-sm pb-2 border-b-2 transition-colors ${
              activeCategory === 'all'
                ? 'text-rose-600 border-rose-600 font-medium'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            全部收藏（{totalCount}）
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`text-sm pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeCategory === c.id
                  ? 'text-rose-600 border-rose-600 font-medium'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <c.icon className="w-3.5 h-3.5" />
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载收藏中...
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-50 flex items-center justify-center">
              <Heart className="w-8 h-8 text-rose-200" />
            </div>
            <div className="text-[15px] font-medium text-gray-600">暂无收藏内容</div>
            <div className="text-[13px] mt-1">
              浏览岗位、场景、课程或测评资源时，点击“收藏”即可在这里查看
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-rose-500">
              <Link href="/job/landing" className="hover:underline flex items-center gap-0.5">
                去收藏岗位 <ChevronRight className="w-3 h-3" />
              </Link>
              <Link href="/scene/landing" className="hover:underline flex items-center gap-0.5">
                去收藏场景 <ChevronRight className="w-3 h-3" />
              </Link>
              <Link href="/lesson/landing" className="hover:underline flex items-center gap-0.5">
                去收藏课程 <ChevronRight className="w-3 h-3" />
              </Link>
              <Link
                href="/evaluation/landing"
                className="hover:underline flex items-center gap-0.5"
              >
                去收藏测评 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 职业岗位 */}
            {visibleKeys.includes('jobs') && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-500" />
                  职业岗位
                  <span className="text-xs text-gray-400 font-normal">
                    （{favorites.jobs.length}）
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {favorites.jobs.map((job, i) => (
                    <div key={job.id} className="relative group">
                      <JobCard position={job} index={i} />
                      <button
                        onClick={() => handleUnfavorite('jobs', job.id)}
                        className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/90 hover:text-rose-300 transition-colors"
                        title="取消收藏"
                      >
                        <Heart className="w-3 h-3 fill-current" />
                        取消收藏
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 实践场景 */}
            {visibleKeys.includes('scenes') && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  实践场景
                  <span className="text-xs text-gray-400 font-normal">
                    （{favorites.scenes.length}）
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {favorites.scenes.map((scene, i) => (
                    <div key={scene.id} className="relative group">
                      <SceneCard scenario={scene} index={i} taskCount={scene.taskCount} />
                      <button
                        onClick={() => handleUnfavorite('scenes', scene.id, 'scene')}
                        className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/90 hover:text-rose-300 transition-colors"
                        title="取消收藏"
                      >
                        <Heart className="w-3 h-3 fill-current" />
                        取消收藏
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 数字课程 */}
            {visibleKeys.includes('courses') && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  数字课程
                  <span className="text-xs text-gray-400 font-normal">
                    （{favorites.courses.length}）
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {favorites.courses.map((course, i) => (
                    <CourseCoverCard
                      key={course.id}
                      course={course}
                      index={i}
                      onUnfavorite={() => handleUnfavorite('courses', course.id, 'course')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 测评资源（题库 + 试卷） */}
            {visibleKeys.includes('exams') && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  测评资源
                  <span className="text-xs text-gray-400 font-normal">
                    （{favorites.banks.length + favorites.exams.length}）
                  </span>
                </h4>
                {favorites.banks.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                      <Library className="w-3.5 h-3.5" /> 题库
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {favorites.banks.map((bank, i) => (
                        <BankCard
                          key={bank.id}
                          bank={bank}
                          index={i}
                          onUnfavorite={() => handleUnfavorite('banks', bank.id, 'question_bank')}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {favorites.exams.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5" /> 试卷
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {favorites.exams.map((exam, i) => (
                        <ExamCard
                          key={exam.id}
                          exam={exam}
                          index={i}
                          onUnfavorite={() => handleUnfavorite('exams', exam.id, 'exam')}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}
