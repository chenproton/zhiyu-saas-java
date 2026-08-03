'use client'

import { useState } from 'react'
import {
  Briefcase,
  Building2,
  MapPin,
  Heart,
  BookOpen,
  Layers,
  FileText,
  Bookmark,
  Clock,
  Play,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@zhiyu/ui'
import { SectionCard } from './section-card'
import { DIFFICULTY_LABELS } from '@/lib/types'

// 收藏数据暂由后端提供，当前无收藏 API，默认空状态

interface FavoriteJob {
  id: string
  name: string
  company: string
  location: string
  salary: string
  tags: string[]
  matchScore: number
}

interface FavoriteCourse {
  id: string
  name: string
  provider: string
  duration: string
  level: string
  score: number
}

interface FavoriteScene {
  id: string
  name: string
  tasks: number
  company: string
  status: string
}

interface FavoriteExam {
  id: string
  name: string
  type: string
  questions: number
  difficulty: string
}

const emptyFavoriteJobs: FavoriteJob[] = []

const emptyFavoriteCourses: FavoriteCourse[] = []

const emptyFavoriteScenes: FavoriteScene[] = []

const emptyFavoriteExams: FavoriteExam[] = []

const categoryConfig = {
  jobs: { label: '职业岗位', icon: Briefcase, color: 'blue' as const },
  scenes: { label: '实践场景', icon: Layers, color: 'amber' as const },
  courses: { label: '数字课程', icon: BookOpen, color: 'emerald' as const },
  exams: { label: '测评资源', icon: FileText, color: 'purple' as const },
}

export function CareerTab() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [favorites, setFavorites] = useState({
    jobs: emptyFavoriteJobs,
    courses: emptyFavoriteCourses,
    scenes: emptyFavoriteScenes,
    exams: emptyFavoriteExams,
  })

  const handleUnfavorite = (category: keyof typeof categoryConfig, id: string) => {
    setFavorites((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item.id !== id),
    }))
  }

  const cats = Object.entries(categoryConfig).map(([k, v]) => ({ id: k, ...v }))

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
            全部收藏
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

        {/* 职业岗位 */}
        {(activeCategory === 'all' || activeCategory === 'jobs') && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-500" />
              职业岗位
              <span className="text-xs text-gray-400 font-normal">（{favorites.jobs.length}）</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {favorites.jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">{job.company}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnfavorite('jobs', job.id)
                      }}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-rose-500 transition-colors"
                      title="取消收藏"
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                      取消收藏
                    </button>
                  </div>
                  <h5 className="text-sm font-semibold text-gray-900 truncate mb-1">{job.name}</h5>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                    <span className="font-medium text-gray-900 ml-auto">{job.salary}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                      {job.matchScore}%匹配
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 text-gray-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 数字课程 */}
        {(activeCategory === 'all' || activeCategory === 'courses') && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              数字课程
              <span className="text-xs text-gray-400 font-normal">
                （{favorites.courses.length}）
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {favorites.courses.map((course) => (
                <div
                  key={course.id}
                  className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-emerald-200 text-emerald-600"
                    >
                      {course.level}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnfavorite('courses', course.id)
                      }}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-rose-500 transition-colors"
                      title="取消收藏"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                      取消收藏
                    </button>
                  </div>
                  <h5 className="text-sm font-semibold text-gray-900 truncate mb-1">
                    {course.name}
                  </h5>
                  <p className="text-xs text-gray-500 mb-2">{course.provider}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.duration}
                    </span>
                    <span className="text-amber-500 font-medium">★ {course.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 实践场景 */}
        {(activeCategory === 'all' || activeCategory === 'scenes') && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              实践场景
              <span className="text-xs text-gray-400 font-normal">
                （{favorites.scenes.length}）
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {favorites.scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-amber-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">{scene.company}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={scene.status}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnfavorite('scenes', scene.id)
                        }}
                        className="text-[10px] text-gray-400 hover:text-rose-500 transition-colors"
                        title="取消收藏"
                      >
                        取消收藏
                      </button>
                    </div>
                  </div>
                  <h5 className="text-sm font-semibold text-gray-900 truncate mb-1">
                    {scene.name}
                  </h5>
                  <p className="text-xs text-gray-500 mb-3">{scene.tasks} 个任务</p>
                  <Button
                    size="sm"
                    className="w-full text-[10px] h-7 bg-amber-500 hover:bg-amber-600"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    进入场景
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 测评资源 */}
        {(activeCategory === 'all' || activeCategory === 'exams') && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              测评资源
              <span className="text-xs text-gray-400 font-normal">
                （{favorites.exams.length}）
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {favorites.exams.map((exam) => (
                <div
                  key={exam.id}
                  className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-purple-200 text-purple-600"
                    >
                      {exam.type}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          exam.difficulty === 'easy'
                            ? 'bg-emerald-50 text-emerald-600'
                            : exam.difficulty === 'medium'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {DIFFICULTY_LABELS[exam.difficulty] || exam.difficulty}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnfavorite('exams', exam.id)
                        }}
                        className="text-[10px] text-gray-400 hover:text-rose-500 transition-colors"
                        title="取消收藏"
                      >
                        取消收藏
                      </button>
                    </div>
                  </div>
                  <h5 className="text-sm font-semibold text-gray-900 truncate mb-2">{exam.name}</h5>
                  <p className="text-xs text-gray-500 mb-3">{exam.questions} 道题目</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-[10px] h-7 border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    开始练习
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
