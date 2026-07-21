"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  publicPositionApi,
  positionResponsibilityApi,
  abilityApi,
  positionCertificateApi,
  learnRoadApi,
} from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useIndustryMap } from "@/lib/use-resource-maps"
import type {
  CareerPosition,
  PositionResponsibility,
  PositionCertificate,
  LearnRoad,
} from "@/lib/types/job"
import { PositionHeader } from "@/components/job/student/position-header"
import { AbilityTree } from "@/components/job/student/ability-tree"
import { SceneList } from "@/components/job/student/scene-list"
import { LearningPath } from "@/components/job/student/learning-path"
import { RelatedPositions } from "@/components/job/student/related-positions"
import { PlatformFooter } from "@/components/job/student/platform-footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Layers, BookOpen, Route, Briefcase, Lock } from "lucide-react"

export default function JobStudentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const industryMap = useIndustryMap()

  const [position, setPosition] = useState<CareerPosition | null>(null)
  const [loading, setLoading] = useState(true)

  const [responsibilities, setResponsibilities] = useState<PositionResponsibility[]>([])
  const [bindings, setBindings] = useState<import("@/lib/types/job").PositionAbilityBinding[]>([])
  const [abilityNames, setAbilityNames] = useState<Record<string, string>>({})
  const [certificates, setCertificates] = useState<PositionCertificate[]>([])
  const [roads, setRoads] = useState<LearnRoad[]>([])
  const [allPositions, setAllPositions] = useState<CareerPosition[]>([])

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

    // Public: related positions
    publicPositionApi
      .list({ status: "published", limit: 20 })
      .then((res) => setAllPositions(res.items || []))
      .catch(() => setAllPositions([]))

    if (!user) return

    // Authenticated-only detail data
    Promise.all([
      positionResponsibilityApi.list({ careerPositionId: id }),
      abilityApi.listBindings({ careerPositionId: id }),
      abilityApi.list({ limit: 1000 }),
      positionCertificateApi.list({ careerPositionId: id }),
      learnRoadApi.list({ limit: 100 }),
    ])
      .then(([respRes, bindingRes, abilityRes, certRes, roadRes]) => {
        setResponsibilities(respRes.items || [])
        setBindings(bindingRes.items || [])
        const nameMap: Record<string, string> = {}
        abilityRes.items.forEach((a) => { nameMap[a.id] = a.name })
        setAbilityNames(nameMap)
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
        <Skeleton className="h-[280px] w-full" />
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
          <a href="/job/student" className="text-blue-600 hover:underline mt-2">返回岗位列表</a>
        </div>
        <PlatformFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFC]">
      <PositionHeader position={position} industryName={industryName} />

      <main className="flex-1 max-w-[1400px] mx-auto px-8 py-6 w-full">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-white border border-[#e7e5e4] p-1 rounded-xl mb-6 h-auto">
            {[
              { value: "overview", label: "岗位概况", icon: FileText },
              { value: "ability", label: "能力模型", icon: Layers },
              { value: "scenes", label: "实践场景", icon: BookOpen },
              { value: "learning", label: "学习路径", icon: Route },
              { value: "related", label: "相关岗位", icon: Briefcase },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="px-5 py-2.5 rounded-[10px] text-[13px] data-[state=active]:bg-[#eff6ff] data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              >
                <t.icon className="w-4 h-4 mr-1.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6">
                  <h3 className="text-base font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    岗位介绍
                  </h3>
                  <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-line">
                    {position.description || "暂无岗位介绍"}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6">
                  <h3 className="text-base font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-500" />
                    岗位要求
                  </h3>
                  {position.requirements?.length ? (
                    <ul className="space-y-3">
                      {position.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-[#475569]">
                          <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {req}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-[#94a3b8]">暂无岗位要求</div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6">
                  <h3 className="text-base font-bold text-[#0f172a] mb-4">岗位信息</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">岗位类型</span>
                      <span className="text-[#0f172a] font-medium">{position.positionType === "enterprise" ? "企业" : "教学"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">版本号</span>
                      <span className="text-[#0f172a] font-medium">{position.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">发布时间</span>
                      <span className="text-[#0f172a] font-medium">{position.createdAt?.slice(0, 10) || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">更新时间</span>
                      <span className="text-[#0f172a] font-medium">{position.updatedAt?.slice(0, 10) || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#e7e5e4] p-6">
                  <h3 className="text-base font-bold text-[#0f172a] mb-4">相关证书</h3>
                  {user ? (
                    certificates.length ? (
                      <div className="space-y-3">
                        {certificates.map((cert) => (
                          <div key={cert.id} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-[#0f172a]">{cert.name}</div>
                              {cert.description && <div className="text-xs text-[#64748b] mt-0.5">{cert.description}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-[#94a3b8]">暂无相关证书</div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                      <Lock className="w-4 h-4" /> 登录后查看相关证书
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ability" className="mt-0">
            {user ? (
              <AbilityTree responsibilities={responsibilities} bindings={bindings} abilityNames={abilityNames} />
            ) : (
              <div className="bg-white rounded-2xl border border-[#e7e5e4] p-12 text-center text-[#94a3b8]">
                <Lock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div className="text-base font-semibold text-[#475569]">能力模型需登录后查看</div>
                <p className="text-sm mt-1">登录账号后可查看岗位的职责与能力点要求</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scenes" className="mt-0">
            <SceneList />
          </TabsContent>

          <TabsContent value="learning" className="mt-0">
            {user ? (
              <LearningPath roads={roads} />
            ) : (
              <div className="bg-white rounded-2xl border border-[#e7e5e4] p-12 text-center text-[#94a3b8]">
                <Lock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div className="text-base font-semibold text-[#475569]">学习路径需登录后查看</div>
                <p className="text-sm mt-1">登录账号后可查看岗位关联的学习路径</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="related" className="mt-0">
            <RelatedPositions positions={allPositions} currentId={position.id} />
          </TabsContent>
        </Tabs>
      </main>

      <PlatformFooter />
    </div>
  )
}
