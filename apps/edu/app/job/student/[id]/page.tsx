"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  publicPositionApi,
  positionResponsibilityApi,
  abilityApi,
  positionCertificateApi,
  learnRoadApi,
  scenarioApi,
  taskApi,
} from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useIndustryMap } from "@/lib/use-resource-maps"
import type {
  CareerPosition,
  PositionResponsibility,
  PositionCertificate,
  LearnRoad,
  AbilityPoint,
  PositionAbilityBinding,
  AbilityDomain,
  Scenario,
  ScenarioTask,
} from "@/lib/types"
import { PositionHeader } from "@/components/job/student/position-header"
import { StatsBox } from "@/components/job/student/stats-box"
import { OverviewTab } from "@/components/job/student/overview-tab"
import { DutyTable } from "@/components/job/student/duty-table"
import { CertCards } from "@/components/job/student/cert-cards"
import { AbilityTree } from "@/components/job/student/ability-tree"
import { CompetencyStandards } from "@/components/job/student/competency-standards"
import { KnowledgeGraph } from "@/components/job/student/knowledge-graph"
import { SceneList } from "@/components/job/student/scene-list"
import { LearningPath } from "@/components/job/student/learning-path"
import { PlatformFooter } from "@/components/job/student/platform-footer"
import { Skeleton } from "@/components/ui/skeleton"
import { Briefcase, FileText, ListChecks, Award, Layers, Target, GitBranch, BookOpen, BriefcaseIcon } from "lucide-react"

const TABS = [
  { value: "overview", label: "岗位概况", icon: FileText },
  { value: "duties", label: "岗位职责", icon: ListChecks },
  { value: "certs", label: "涉及证书", icon: Award },
  { value: "ability", label: "能力模型", icon: Layers },
  { value: "competency", label: "胜任标准", icon: Target },
  { value: "graph", label: "知识图谱", icon: GitBranch },
  { value: "scenes", label: "实践场景", icon: BookOpen },
  { value: "learning", label: "学习路径", icon: BriefcaseIcon },
]

export default function JobStudentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const industryMap = useIndustryMap()

  const [position, setPosition] = useState<CareerPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const tabsRef = useRef<HTMLDivElement>(null)

  const handleStartLearning = () => {
    setActiveTab("learning")
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const [responsibilities, setResponsibilities] = useState<PositionResponsibility[]>([])
  const [bindings, setBindings] = useState<PositionAbilityBinding[]>([])
  const [abilityPoints, setAbilityPoints] = useState<AbilityPoint[]>([])
  const [abilityDomains, setAbilityDomains] = useState<AbilityDomain[]>([])
  const [certificates, setCertificates] = useState<PositionCertificate[]>([])
  const [roads, setRoads] = useState<LearnRoad[]>([])
  const [allPositions, setAllPositions] = useState<CareerPosition[]>([])
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

    publicPositionApi
      .list({ status: "published", limit: 20 })
      .then((res) => setAllPositions(res.items || []))
      .catch(() => setAllPositions([]))

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

    Promise.all([
      positionResponsibilityApi.list({ careerPositionId: id }),
      abilityApi.listBindings({ careerPositionId: id }),
      abilityApi.list({ limit: 1000 }),
      abilityApi.listDomains(id),
      positionCertificateApi.list({ careerPositionId: id }),
      learnRoadApi.list({ limit: 100 }),
    ])
      .then(([respRes, bindingRes, abilityRes, domainRes, certRes, roadRes]) => {
        setResponsibilities(respRes.items || [])
        setBindings(bindingRes.items || [])
        setAbilityPoints(abilityRes.items || [])
        setAbilityDomains(domainRes.items || [])
        setCertificates(certRes.items || [])
        const relatedRoads = (roadRes.items || []).filter((r: LearnRoad) => r.positionIds?.includes(id))
        setRoads(relatedRoads)
      })
      .catch(() => {})
  }, [id, position, user])

  const industryName = useMemo(() => {
    if (!position?.industryId) return undefined
    return industryMap.get(position.industryId)
  }, [position, industryMap])

  const scenarioCount = scenarios.length
  const taskCount = scenarioTasks.length
  const abilityPointCount = useMemo(
    () => new Set(bindings.map((b) => b.abilityPointId).filter(Boolean)).size,
    [bindings]
  )

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

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab position={position} />
      case "duties":
        return <DutyTable responsibilities={responsibilities} bindings={bindings} abilityPoints={abilityPoints} requirements={position.requirements} />
      case "certs":
        return <CertCards certificates={certificates} />
      case "ability":
        return user ? (
          <AbilityTree responsibilities={responsibilities} bindings={bindings} abilityPoints={abilityPoints} abilityDomains={abilityDomains} />
        ) : (
          <LoginPrompt text="能力模型需登录后查看" desc="登录账号后可查看岗位的职责与能力点要求" />
        )
      case "competency":
        return user ? (
          <CompetencyStandards responsibilities={responsibilities} bindings={bindings} abilityPoints={abilityPoints} />
        ) : (
          <LoginPrompt text="胜任标准需登录后查看" desc="登录账号后可查看岗位能力点的目标等级" />
        )
      case "graph":
        return user ? <KnowledgeGraph position={position} bindings={bindings} abilityPoints={abilityPoints} relatedPositions={allPositions} /> : <LoginPrompt text="知识图谱需登录后查看" desc="登录账号后可查看岗位知识图谱" />
      case "scenes":
        return <SceneList scenarios={scenarios} tasks={scenarioTasks} />
      case "learning":
        return user ? <LearningPath roads={roads} scenarios={scenarios} tasks={scenarioTasks} /> : <LoginPrompt text="学习路径需登录后查看" desc="登录账号后可查看岗位关联的学习路径" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
      <PositionHeader position={position} industryName={industryName} onStartLearning={handleStartLearning} />

      <main className="flex-1 max-w-[1400px] mx-auto px-8 py-6 w-full">
        <StatsBox
          position={position}
          scenarioCount={scenarioCount}
          taskCount={taskCount}
          abilityPointCount={abilityPointCount}
        />

        <div ref={tabsRef} className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(69,26,3,0.06)] overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-8 border-b border-[#f5f5f4] px-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`
                  py-4 text-[15px] whitespace-nowrap relative transition-colors cursor-pointer
                  ${activeTab === t.value ? "text-blue-500 font-semibold" : "text-[#64748b] hover:text-blue-600"}
                `}
              >
                <t.icon className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {t.label}
                {activeTab === t.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6 min-h-[500px]">
            {renderTabContent()}
          </div>
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
