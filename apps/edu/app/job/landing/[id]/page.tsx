'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  publicPositionApi,
  positionResponsibilityApi,
  abilityApi,
  positionCertificateApi,
  scenarioApi,
  taskApi,
} from '@/lib/api'
import { useAuth } from '@/components/auth-provider'
import { useIndustryMap } from '@/lib/use-resource-maps'
import { reportError } from '@/lib/error-handling'
import { useToast } from '@zhiyu/ui'
import type {
  CareerPosition,
  PositionResponsibility,
  PositionCertificate,
  AbilityPoint,
  PositionAbilityBinding,
  AbilityDomain,
  Scenario,
  ScenarioTask,
} from '@/lib/types'
import { PositionHeader } from '@/components/job/student/position-header'
import { StatsBox } from '@/components/job/student/stats-box'
import { OverviewTab } from '@/components/job/student/overview-tab'
import { DutyTable } from '@/components/job/student/duty-table'
import { CertCards } from '@/components/job/student/cert-cards'
import { AbilityTree } from '@/components/job/student/ability-tree'
import { CompetencyStandards } from '@/components/job/student/competency-standards'
import { KnowledgeGraph } from '@/components/job/student/knowledge-graph'
import { SceneList } from '@/components/job/student/scene-list'
import { Footer } from '@/components/portal/footer'
import { MobileTabDropdown } from '@/components/shared/mobile-tab-dropdown'
import { useT } from '@/lib/i18n/locale-provider'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Briefcase,
  FileText,
  ListChecks,
  Award,
  Layers,
  Target,
  GitBranch,
  BookOpen,
} from 'lucide-react'

const TABS = [
  { value: 'overview', label: '岗位概况', icon: FileText },
  { value: 'duties', label: '岗位职责', icon: ListChecks },
  { value: 'certs', label: '涉及证书', icon: Award },
  { value: 'ability', label: '能力模型', icon: Layers },
  { value: 'competency', label: '胜任标准', icon: Target },
  { value: 'graph', label: '知识图谱', icon: GitBranch },
  { value: 'scenes', label: '实践场景', icon: BookOpen },
]

export default function JobStudentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const t = useT()
  const { user } = useAuth()
  const industryMap = useIndustryMap()

  const [position, setPosition] = useState<CareerPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const tabsRef = useRef<HTMLDivElement>(null)

  const handleStartLearning = () => {
    router.push(`/job/landing/${id}/learn`)
  }

  const [responsibilities, setResponsibilities] = useState<PositionResponsibility[]>([])
  const [bindings, setBindings] = useState<PositionAbilityBinding[]>([])
  const [abilityPoints, setAbilityPoints] = useState<AbilityPoint[]>([])
  const [abilityDomains, setAbilityDomains] = useState<AbilityDomain[]>([])
  const [certificates, setCertificates] = useState<PositionCertificate[]>([])
  const [allPositions, setAllPositions] = useState<CareerPosition[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenarioTasks, setScenarioTasks] = useState<ScenarioTask[]>([])
  // 岗位详情加载请求序号：快速切换 id 时丢弃过期响应
  const loadSeqRef = useRef(0)
  // 详情加载使用独立序号：与关联数据加载（loadSeqRef）互不抢占，
  // 避免切换岗位时 detail effect 的 finally 被抢占导致 loading 永不复位（骨架屏卡死）
  const detailSeqRef = useRef(0)

  useEffect(() => {
    if (!id) return
    const seq = ++detailSeqRef.current
    ;(async () => {
      setLoading(true)
      try {
        const pos = await publicPositionApi.get(id)
        if (seq !== detailSeqRef.current) return
        setPosition(pos)
      } catch {
        if (seq !== detailSeqRef.current) return
        setPosition(null)
      } finally {
        if (seq === detailSeqRef.current) setLoading(false)
      }
    })()
  }, [id])

  useEffect(() => {
    if (!id || !position) return
    const seq = ++loadSeqRef.current

    publicPositionApi
      .list({ status: 'published', limit: 20 })
      .then((res) => {
        if (seq === loadSeqRef.current) setAllPositions(res.items || [])
      })
      .catch(() => {
        if (seq === loadSeqRef.current) setAllPositions([])
      })

    scenarioApi
      .list({ careerPositionId: id, status: 'published', limit: 1000 })
      .then(async (res) => {
        const scens = res.items || []
        // 逐任务加载，单个场景任务失败只记录错误，不清空已加载的数据
        const allTasks: ScenarioTask[] = []
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
        // 快速切换岗位 id 时丢弃过期响应
        if (seq !== loadSeqRef.current) return
        setScenarios(scens)
        setScenarioTasks(allTasks)
      })
      .catch((err) => {
        // 场景列表本身加载失败时保留已加载部分，不清空整体
        reportError(err, '加载场景列表')
        toast({ title: t('部分数据加载失败'), variant: 'destructive' })
      })

    if (!user) return

    // 复用上方 seq：再次递增会让前两个请求的响应被判为过期而丢弃
    Promise.all([
      positionResponsibilityApi.list({ careerPositionId: id }),
      abilityApi.listBindings({ careerPositionId: id }),
      abilityApi.list({ limit: 1000 }),
      abilityApi.listDomains(id),
      positionCertificateApi.list({ careerPositionId: id }),
    ])
      .then(([respRes, bindingRes, abilityRes, domainRes, certRes]) => {
        if (seq !== loadSeqRef.current) return
        setResponsibilities(respRes.items || [])
        setBindings(bindingRes.items || [])
        setAbilityPoints(abilityRes.items || [])
        setAbilityDomains(domainRes.items || [])
        setCertificates(certRes.items || [])
      })
      .catch((err) => {
        reportError(err, '加载岗位详情数据')
        toast({ title: t('部分数据加载失败'), variant: 'destructive' })
      })
  }, [id, position, user, toast, t])

  const industryName = useMemo(() => {
    if (!position?.industryId) return undefined
    return industryMap.get(position.industryId)
  }, [position, industryMap])

  const scenarioCount = scenarios.length
  const taskCount = scenarioTasks.length
  const abilityPointCount = useMemo(
    () => new Set(bindings.map((b) => b.abilityPointId).filter(Boolean)).size,
    [bindings],
  )

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
        <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8]">
          <Briefcase className="w-16 h-16 mb-4 opacity-40" />
          <div className="text-lg font-semibold text-[#475569]">{t('岗位不存在或暂未公开')}</div>
          <Link href="/job/landing" className="text-primary hover:underline mt-2">
            {t('返回岗位列表')}
          </Link>
        </div>
        <Footer className="mt-auto" />
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab position={position} />
      case 'duties':
        return (
          <DutyTable
            responsibilities={responsibilities}
            bindings={bindings}
            abilityPoints={abilityPoints}
            requirements={position.requirements}
          />
        )
      case 'certs':
        return <CertCards certificates={certificates} />
      case 'ability':
        return user ? (
          <AbilityTree
            bindings={bindings}
            abilityPoints={abilityPoints}
            abilityDomains={abilityDomains}
          />
        ) : (
          <LoginPrompt text={t('能力模型需登录后查看')} desc={t('登录账号后可查看岗位的职责与能力点要求')} />
        )
      case 'competency':
        return user ? (
          <CompetencyStandards
            responsibilities={responsibilities}
            bindings={bindings}
            abilityPoints={abilityPoints}
          />
        ) : (
          <LoginPrompt text={t('胜任标准需登录后查看')} desc={t('登录账号后可查看岗位能力点的目标等级')} />
        )
      case 'graph':
        return user ? (
          <KnowledgeGraph
            position={position}
            bindings={bindings}
            abilityPoints={abilityPoints}
            abilityDomains={abilityDomains}
            relatedPositions={allPositions}
            tasks={scenarioTasks}
          />
        ) : (
          <LoginPrompt text={t('知识图谱需登录后查看')} desc={t('登录账号后可查看岗位知识图谱')} />
        )
      case 'scenes':
        return <SceneList scenarios={scenarios} tasks={scenarioTasks} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
      <PositionHeader
        position={position}
        industryName={industryName}
        onStartLearning={handleStartLearning}
      />

      <main className="flex-1 max-w-[1400px] mx-auto px-4 sm:px-8 py-6 w-full">
        <StatsBox
          position={position}
          scenarioCount={scenarioCount}
          taskCount={taskCount}
          abilityPointCount={abilityPointCount}
        />

        <div
          ref={tabsRef}
          className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(69,26,3,0.06)] overflow-visible md:overflow-hidden"
        >
          {/* Tabs */}
          <MobileTabDropdown
            items={TABS.map((tab) => ({ ...tab, label: t(tab.label) }))}
            value={activeTab}
            onValueChange={setActiveTab}
            className="md:hidden m-4"
          />
          <div className="hidden md:flex gap-4 sm:gap-8 border-b border-[#f5f5f4] px-4 sm:px-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`
                  py-4 text-[15px] whitespace-nowrap relative transition-colors cursor-pointer
                  ${activeTab === tab.value ? 'text-primary font-semibold' : 'text-[#64748b] hover:text-primary'}
                `}
              >
                <tab.icon className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {t(tab.label)}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6 min-h-[500px]">{renderTabContent()}</div>
        </div>
      </main>

      <Footer className="mt-auto" />
    </div>
  )
}

function LoginPrompt({ text, desc }: { text: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] p-12 text-center text-[#94a3b8]">
      <svg
        className="w-12 h-12 mx-auto mb-3 opacity-40"
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
      <div className="text-base font-semibold text-[#475569]">{text}</div>
      <p className="text-sm mt-1">{desc}</p>
    </div>
  )
}
