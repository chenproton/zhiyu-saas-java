"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  publicPositionApi,
  learnRoadApi,
  scenarioApi,
  taskApi,
} from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useIndustryMap } from "@/lib/use-resource-maps"
import type {
  CareerPosition,
  LearnRoad,
  Scenario,
  ScenarioTask,
} from "@/lib/types"
import { PositionHeader } from "@/components/job/student/position-header"
import { LearningPath } from "@/components/job/student/learning-path"
import { PlatformFooter } from "@/components/job/student/platform-footer"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Briefcase } from "lucide-react"

export default function JobStudentLearnPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const industryMap = useIndustryMap()

  const [position, setPosition] = useState<CareerPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [roads, setRoads] = useState<LearnRoad[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenarioTasks, setScenarioTasks] = useState<ScenarioTask[]>([])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    publicPositionApi
      .get(id)
      .then(setPosition)
      .catch(() => setPosition(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id || !position) return

    scenarioApi
      .list({ careerPositionId: id, status: "published", limit: 1000 })
      .then((res) => {
        const scens = res.items || []
        setScenarios(scens)
        return Promise.all(scens.map((s: Scenario) => taskApi.list({ scenarioId: s.id, limit: 1000 })))
      })
      .then((results) => {
        const allTasks = results.flatMap((r) => r.items || [])
        setScenarioTasks(allTasks)
      })
      .catch(() => {
        setScenarios([])
        setScenarioTasks([])
      })

    if (!user) return

    learnRoadApi
      .list({ limit: 100 })
      .then((roadRes) => {
        const relatedRoads = (roadRes.items || []).filter((r: LearnRoad) => r.positionIds?.includes(id))
        setRoads(relatedRoads)
      })
      .catch(() => {})
  }, [id, position, user])

  const industryName = useMemo(() => {
    if (!position?.industryId) return undefined
    return industryMap.get(position.industryId)
  }, [position, industryMap])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
        <Skeleton className="h-[320px] w-full" />
        <div className="max-w-[1400px] mx-auto px-8 py-8 w-full flex-1">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
        <PlatformFooter />
      </div>
    )
  }

  if (!position) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
        <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8]">
          <Briefcase className="w-16 h-16 mb-4 opacity-40" />
          <div className="text-lg font-semibold text-[#475569]">岗位不存在或暂未公开</div>
          <Link href="/job/student" className="text-blue-600 hover:underline mt-2">返回岗位列表</Link>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
      <PositionHeader position={position} industryName={industryName} />

      <main className="flex-1 max-w-[1400px] mx-auto px-8 py-6 w-full">
        <Link href={`/job/student/${id}`} className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-blue-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> 返回岗位详情
        </Link>

        <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(69,26,3,0.06)] p-6 min-h-[500px]">
          {user ? (
            <LearningPath roads={roads} scenarios={scenarios} tasks={scenarioTasks} />
          ) : (
            <LoginPrompt text="学习路径需登录后查看" desc="登录账号后可查看岗位关联的学习路径" />
          )}
        </div>
      </main>

      <PlatformFooter />
    </div>
  )
}

function LoginPrompt({ text, desc }: { text: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-12 text-center text-[#94a3b8]">
      <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
      <div className="text-base font-semibold text-[#475569]">{text}</div>
      <p className="text-sm mt-1">{desc}</p>
    </div>
  )
}
