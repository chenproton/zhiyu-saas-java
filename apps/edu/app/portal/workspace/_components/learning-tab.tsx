'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, BookOpen, Clock, Layers, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@zhiyu/ui'
import { SectionCard } from './section-card'
import { StatCard } from './stat-card'
import { portalApi } from '@/lib/api'
import type { WorkspaceCourse, WorkspaceSceneTask } from '@/lib/types'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import { lessonLandingHref, sceneLandingHref } from '@/lib/learn-links'
import { useT } from '@/lib/i18n/locale-provider'

export function LearningTab() {
  const router = useRouter()
  const t = useT()
  const [courses, setCourses] = useState<WorkspaceCourse[]>([])
  const [sceneTasks, setSceneTasks] = useState<WorkspaceSceneTask[]>([])
  const [loading, setLoading] = useState(true)
  const [courseFilter, setCourseFilter] = useState('all')
  const [sceneFilter, setSceneFilter] = useState('all')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await portalApi.workspaceDashboard({ role: 'student' })
        setCourses(res.courses || [])
        setSceneTasks(res.sceneTasks || [])
      } catch {
        setCourses([])
        setSceneTasks([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filteredCourses = courses.filter((c) => {
    if (courseFilter !== 'all' && c.status !== courseFilter) return false
    return true
  })

  const filteredScenes = sceneTasks.filter((s) => {
    if (sceneFilter !== 'all' && s.status !== sceneFilter) return false
    return true
  })

  // 中文标签 → 颜色，由共享 DIFFICULTY_LABELS/DIFFICULTY_COLORS 派生（与后端 difficultyLabel 中文输出对齐）
  const difficultyColorMap: Record<string, string> = Object.fromEntries(
    Object.entries(DIFFICULTY_LABELS).map(([key, label]) => [label, DIFFICULTY_COLORS[key]]),
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('在修课程')}
            value="-"
            icon={BookOpen}
            trend={t('加载中...')}
            color="blue"
          />
          <StatCard
            title={t('场景任务')}
            value="-"
            icon={Layers}
            trend={t('加载中...')}
            color="green"
          />
          <StatCard
            title={t('学习时长')}
            value="-"
            icon={Clock}
            trend={t('加载中...')}
            color="amber"
          />
          <StatCard
            title={t('本周完成任务')}
            value="-"
            icon={BarChart3}
            trend={t('加载中...')}
            color="purple"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 顶部指标 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('在修课程')}
          value={courses.length}
          icon={BookOpen}
          trend={t('本学期共 5 门')}
          color="blue"
        />
        <StatCard
          title={t('场景任务')}
          value={sceneTasks.length}
          icon={Layers}
          trend={t('2 个待完成')}
          color="green"
        />
        <StatCard
          title={t('学习时长')}
          value="86h"
          icon={Clock}
          trend={t('本月 +12h')}
          trendUp
          color="amber"
        />
        <StatCard
          title={t('本周完成任务')}
          value={12}
          icon={BarChart3}
          trend={t('较上周 +3')}
          trendUp
          color="purple"
        />
      </div>

      {/* 课程与任务内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 实践场景（左侧） */}
        <SectionCard
          title={t('我的实践场景')}
          icon={Layers}
          iconColor="green"
          action={{ label: t('全部场景') }}
        >
          <Tabs value={sceneFilter} onValueChange={setSceneFilter}>
            <TabsList className="h-8 bg-gray-100 mb-4">
              <TabsTrigger
                value="all"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('全部')}
              </TabsTrigger>
              <TabsTrigger
                value="进行中"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('进行中')}
              </TabsTrigger>
              <TabsTrigger
                value="待提交"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('待提交')}
              </TabsTrigger>
              <TabsTrigger
                value="已完成"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('已完成')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-3">
            {filteredScenes.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">{t('暂无实践场景')}</div>
            )}
            {filteredScenes.map((task) => (
              <div
                key={task.id}
                className="group p-4 rounded-xl border border-gray-100 bg-white hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 flex items-center justify-center text-xl font-bold shrink-0">
                    {task.sceneName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                          {task.taskName}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {t('{scene} · 目标岗位：{position}', {
                            scene: task.sceneName,
                            position: task.position,
                          })}
                        </p>
                      </div>
                      <StatusBadge status={task.status} className="shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {task.abilityTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t('截止 {deadline}', { deadline: task.deadline || t('未设置') })}
                      </span>
                      <span className={difficultyColorMap[task.difficulty]}>
                        {t('难度：{difficulty}', { difficulty: task.difficulty })}
                      </span>
                      {task.score !== undefined && (
                        <span className="text-emerald-600 font-medium">
                          {t('得分：{score}/{total}', {
                            score: task.score,
                            total: task.totalScore,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => router.push(sceneLandingHref(task.scenarioId, task.resourceVersion))}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    {task.status === '已完成' ? t('查看') : t('继续')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 混合课（右侧） */}
        <SectionCard
          title={t('我的课程')}
          icon={BookOpen}
          iconColor="blue"
          action={{ label: t('全部课程') }}
        >
          <Tabs value={courseFilter} onValueChange={setCourseFilter}>
            <TabsList className="h-8 bg-gray-100 mb-4">
              <TabsTrigger
                value="all"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('全部')}
              </TabsTrigger>
              <TabsTrigger
                value="进行中"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('进行中')}
              </TabsTrigger>
              <TabsTrigger
                value="未开始"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('未开始')}
              </TabsTrigger>
              <TabsTrigger
                value="已完成"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {t('已完成')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-3">
            {filteredCourses.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400">{t('暂无课程')}</div>
            )}
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="group p-4 rounded-xl border border-gray-100 bg-white hover:border-primary/25 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
                    {course.cover}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary transition-colors">
                          {course.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {course.code} · {course.teacher} ·{' '}
                          {t('{credit}学分', { credit: course.credit })} · {course.hours}
                          {t('学时')}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 border-primary/15 text-primary bg-primary/5"
                      >
                        {t(course.type)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/5 text-primary font-medium">
                        {t('{progress}% 完成', { progress: course.progress })}
                      </span>
                    </div>
                    {course.nextTask && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {t('下一步：')}
                          <span className="text-gray-900 font-medium">
                            {course.nextTask}
                          </span> · {t('截止 {deadline}', { deadline: course.nextDeadline ?? '-' })}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-primary hover:bg-primary/90"
                    onClick={() => router.push(lessonLandingHref(course.id, course.resourceVersion))}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    {course.status === '已完成' ? t('复习') : t('学习')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
