'use client'

import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router'
import { useParams } from 'react-router'
import { publicPositionApi, learnRoadApi, scenarioApi, taskApi } from '@/lib/api'
import { useAuth } from '@/components/auth-provider'
import { reportError } from '@/lib/error-handling'
import { useToast, EmptyState } from '@zhiyu/ui'
import type { CareerPosition, LearnRoad, Scenario, ScenarioTask } from '@/lib/types'
import { LearningPath } from '@/components/job/student/learning-path'
import { Footer } from '@/components/portal/footer'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Briefcase } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

export default function JobStudentLearnPage() {
  const t = useT()
  const params = useParams()
  const id = params.id as string
  const { toast } = useToast()
  const { user } = useAuth()

  const [position, setPosition] = useState<CareerPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [roads, setRoads] = useState<LearnRoad[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenarioTasks, setScenarioTasks] = useState<ScenarioTask[]>([])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const pos = await publicPositionApi.get(id)
        if (!cancelled) setPosition(pos)
      } catch {
        if (!cancelled) setPosition(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !position) return
    // 请求序号：岗位快速切换时丢弃过期响应（与详情页 loadSeqRef 一致）
    const seq = ++learnSeqRef.current

    scenarioApi
      .list({ careerPositionId: id, status: 'published', limit: 1000 })
      .then(async (res) => {
        const scens = res.items || []
        if (seq !== learnSeqRef.current) return
        setScenarios(scens)
        const allTasks: ScenarioTask[] = []
        // 逐任务容错：单个场景任务加载失败只记录错误，不清空已加载数据
        await Promise.all(
          scens.map(async (s: Scenario) => {
            try {
              const r = await taskApi.list({ scenarioId: s.id, limit: 1000 })
              allTasks.push(...(r.items || []))
            } catch (err) {
              reportError(err, `加载场景任务（${s.id}）`)
            }
          }),
        )
        if (seq !== learnSeqRef.current) return
        setScenarioTasks(allTasks)
      })
      .catch(() => {
        if (seq === learnSeqRef.current) {
          setScenarios([])
          setScenarioTasks([])
        }
      })

    if (!user) return

    learnRoadApi
      .list({ limit: 100 })
      .then((roadRes) => {
        if (seq !== learnSeqRef.current) return
        const relatedRoads = (roadRes.items || []).filter((r: LearnRoad) =>
          r.positionIds?.includes(id),
        )
        setRoads(relatedRoads)
      })
      .catch((err) => {
        if (seq !== learnSeqRef.current) return
        reportError(err, '加载学习路径数据')
        toast({ title: t('部分数据加载失败'), variant: 'destructive' })
      })
  }, [id, position, user, toast, t])

  // 岗位内容加载序号
  const learnSeqRef = useRef(0)

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
        <Skeleton className="h-[320px] w-full" />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 w-full flex-1">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  if (!position) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
        <EmptyState
          className="flex-1"
          icon={<Briefcase className="w-16 h-16 opacity-40" />}
          iconClassName="mb-4"
          title={t('岗位不存在或暂未公开')}
          titleClassName="text-lg font-semibold text-[#475569]"
          action={
            <Link to="/job/landing" className="text-primary hover:underline">
              {t('返回岗位列表')}
            </Link>
          }
        />
        <Footer className="mt-auto" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-8 py-6 w-full">
        <Link
          replace
          to={`/job/landing/${id}`}
          className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> {t('返回岗位详情')}
        </Link>

        <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(69,26,3,0.06)] p-4 sm:p-6 min-h-[500px]">
          {user ? (
            <LearningPath roads={roads} scenarios={scenarios} tasks={scenarioTasks} />
          ) : (
            <LoginPrompt text={t('学习路径需登录后查看')} desc={t('登录账号后可查看岗位关联的学习路径')} />
          )}
        </div>
      </main>

      <Footer className="mt-auto" />
    </div>
  )
}

function LoginPrompt({ text, desc }: { text: string; desc: string }) {
  return (
    <EmptyState
      className="bg-white rounded-2xl border border-[#e7e5e4] p-12"
      iconClassName="text-[#94a3b8]"
      icon={
        <svg
          className="w-12 h-12 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      }
      title={text}
      titleClassName="text-base font-semibold text-[#475569]"
      description={desc}
    />
  )
}
