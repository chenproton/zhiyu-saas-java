'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  AllianceDetailShell,
  DetailEmpty,
  DetailInfoBlock,
  DetailSectionCard,
  type DetailStat,
} from '@/components/alliance/alliance-detail-shell'
import {
  FolderKanban,
  Building2,
  FileText,
  Award,
  Target,
  Calendar,
  CheckCircle2,
  Circle,
  ArrowUpRight,
} from 'lucide-react'
import { portalRequest, allianceProjectApi } from '@/lib/api'
import { allianceLabel } from '@zhiyu/shared-types'
import type {
  AllianceProject,
  AllianceProjectMilestone,
  AllianceEnterprise,
  AllianceAchievement,
  AlliancePublicAgreement,
} from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'

export default function AlliancePublicProjectDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const [project, setProject] = useState<AllianceProject | null>(null)
  const [partners, setPartners] = useState<AllianceEnterprise[]>([])
  const [agreements, setAgreements] = useState<AlliancePublicAgreement[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [milestones, setMilestones] = useState<AllianceProjectMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const q = tenantId ? `?tenantId=${tenantId}` : ''
    Promise.all([
      portalRequest<AllianceProject>(`/alliance/public/projects/${id}${q}`),
      portalRequest<{ items: AllianceEnterprise[] }>(`/alliance/public/enterprises${q}`),
      portalRequest<{ items: AlliancePublicAgreement[] }>(`/alliance/public/agreements${q}`),
      portalRequest<{ items: AllianceAchievement[] }>(`/alliance/public/achievements${q}`),
      allianceProjectApi.listPublicMilestones(id, tenantId),
    ])
      .then(([p, entsRes, agrRes, achRes, msRes]) => {
        setProject(p)
        const entIds = p.enterpriseIds ?? []
        setPartners((entsRes.items ?? []).filter((e) => entIds.includes(e.id)))
        setAgreements(
          (agrRes.items ?? []).filter(
            (a) =>
              (a.projectIds ?? []).includes(id) ||
              (p.agreementIds ?? []).includes(a.id),
          ),
        )
        setAchievements(
          (achRes.items ?? []).filter((a) => (a.projectIds ?? []).includes(id)),
        )
        setMilestones(msRes.items ?? [])
      })
      .catch((err) => {
        reportError(err, { source: '加载合作项目详情' })
      })
      .finally(() => setLoading(false))
  }, [id, tenantId])

  const progress = useMemo(() => {
    if (milestones.length === 0) return 0
    const done = milestones.filter((m) => m.isCompleted).length
    return Math.round((done / milestones.length) * 100)
  }, [milestones])

  if (loading) return <LoadingView />
  if (!project)
    return <div className="text-center py-12 text-muted-foreground">{t('项目不存在')}</div>

  const stats: DetailStat[] = [
    {
      label: t('里程碑进度'),
      value: `${progress}%`,
      icon: Target,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      label: t('合作协议'),
      value: agreements.length,
      icon: FileText,
      gradient: 'from-violet-500 to-violet-600',
    },
    {
      label: t('关联成果'),
      value: achievements.length,
      icon: Award,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      label: t('合作主体'),
      value: partners.length,
      icon: Building2,
      gradient: 'from-amber-500 to-amber-600',
    },
  ]

  const milestoneIcons = (done: boolean) =>
    done ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
    ) : (
      <Circle className="h-5 w-5 text-slate-300" />
    )

  return (
    <AllianceDetailShell
      backHref="/portal/alliance/projects"
      backLabel={t('返回列表')}
      icon={FolderKanban}
      iconGradient="from-indigo-500 to-violet-600"
      pageGradient="from-slate-50/80 via-white to-indigo-50/30"
      glowClass="from-indigo-600/5 via-transparent to-blue-600/5"
      title={project.name}
      subtitle={project.type}
      badges={[
        <Badge key="phase" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {allianceLabel('projectPhase', project.phase)}
        </Badge>,
        <Badge key="publish" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {allianceLabel('publishStatus', project.publishStatus)}
        </Badge>,
      ]}
      stats={stats}
      tabs={[
        {
          value: 'info',
          label: t('项目信息'),
          content: (
            <div className="grid lg:grid-cols-3 gap-6">
              <DetailSectionCard title={t('项目简介')} className="lg:col-span-2">
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {project.description || '-'}
                </p>
              </DetailSectionCard>

              <DetailSectionCard title={t('关联信息')} className="h-fit self-start">
                <div className="space-y-3">
                  {partners.length > 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400">{t('合作主体')}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          {partners.map((p) => (
                            <Link
                              key={p.id}
                              href={`/portal/alliance/enterprises/${p.id}`}
                              className="font-medium text-slate-900 hover:text-indigo-600 transition-colors text-sm inline-flex items-center gap-0.5"
                            >
                              {p.name} <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {agreements.length > 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">{t('项目协议')}</p>
                        <p className="font-semibold text-slate-900">
                          {t('{count} 项协议', { count: agreements.length })}
                        </p>
                      </div>
                    </div>
                  )}
                  {achievements.length > 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">{t('关联成果')}</p>
                        <p className="font-semibold text-slate-900">
                          {t('{count} 项成果', { count: achievements.length })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </DetailSectionCard>

              <DetailSectionCard title={t('项目信息')} className="lg:col-span-3">
                <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">
                  <DetailInfoBlock label={t('合作类型')} value={project.type} />
                  <DetailInfoBlock
                    label={t('当前阶段')}
                    value={allianceLabel('projectPhase', project.phase)}
                  />
                  <DetailInfoBlock
                    label={t('关联二级学院')}
                    value={(project.secondaryColleges ?? []).join('、')}
                  />
                  <DetailInfoBlock
                    label={t('开始日期')}
                    value={project.startDate ? new Date(project.startDate).toLocaleDateString('zh-CN') : '-'}
                  />
                  <DetailInfoBlock
                    label={t('结束日期')}
                    value={project.endDate ? new Date(project.endDate).toLocaleDateString('zh-CN') : '-'}
                  />
                  <DetailInfoBlock label={t('预算')} value={project.budget} />
                  <DetailInfoBlock
                    label={t('创建时间')}
                    value={new Date(project.createdAt).toLocaleDateString('zh-CN')}
                  />
                  <DetailInfoBlock
                    label={t('更新时间')}
                    value={new Date(project.updatedAt).toLocaleDateString('zh-CN')}
                  />
                </div>
                {project.coverImage && (
                  <div className="mt-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={project.coverImage}
                      alt={project.name}
                      className="w-full max-h-72 object-cover rounded-2xl border border-slate-100 shadow-sm"
                    />
                  </div>
                )}
              </DetailSectionCard>
            </div>
          ),
        },
        {
          value: 'milestones',
          label: t('项目里程碑'),
          count: milestones.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {milestones.length > 0 ? (
                  <>
                    <div className="mb-8">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>{t('总体进度')}</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <div className="relative">
                      <div className="absolute left-[10px] top-0 bottom-0 w-0.5 bg-slate-200" />
                      <div className="space-y-6">
                        {milestones.map((m) => (
                          <div key={m.id} className="relative flex gap-4">
                            <div className="relative z-10 bg-white rounded-full">
                              {milestoneIcons(m.isCompleted)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">{m.name}</p>
                                  {m.description && (
                                    <p className="text-sm text-slate-500 mt-1">{m.description}</p>
                                  )}
                                </div>
                                <Badge
                                  variant={m.isCompleted ? 'secondary' : 'outline'}
                                  className={
                                    m.isCompleted
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'text-slate-500'
                                  }
                                >
                                  {m.isCompleted ? t('已完成') : t('未完成')}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                                {m.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {t('计划：{date}', { date: new Date(m.dueDate).toLocaleDateString('zh-CN') })}
                                  </span>
                                )}
                                {m.completedDate && (
                                  <span className="flex items-center gap-1 text-emerald-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {t('完成：{date}', { date: new Date(m.completedDate).toLocaleDateString('zh-CN') })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <DetailEmpty icon={Target} title={t('暂无里程碑数据')} />
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'agreements',
          label: t('项目协议'),
          count: agreements.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {agreements.length > 0 ? (
                  <div className="space-y-4">
                    {agreements.map((agreement) => (
                      <div key={agreement.id} className="p-5 bg-slate-50 rounded-2xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                            <p className="font-semibold text-slate-900 text-sm">{agreement.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {agreement.type && (
                              <Badge variant="secondary" className="text-[10px]">
                                {agreement.type}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px]">
                              {allianceLabel('agreementStatus', agreement.status)}
                            </Badge>
                          </div>
                        </div>
                        {(agreement.startDate || agreement.endDate) && (
                          <p className="text-xs text-slate-500">
                            {agreement.startDate || '-'} {t('至')} {agreement.endDate || '-'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <DetailEmpty icon={FileText} title={t('暂无项目协议')} />
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'achievements',
          label: t('关联成果'),
          count: achievements.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {achievements.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {achievements.map((item) => (
                      <Card key={item.id} className="border-0 shadow-sm rounded-3xl bg-slate-50">
                        <CardContent className="p-5">
                          <Link
                            href={`/portal/alliance/achievements/${item.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 transition-colors inline-flex items-center gap-1 text-base line-clamp-2"
                          >
                            {item.title} <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                          </Link>
                          <p className="text-xs text-slate-400 mt-1">
                            {item.achievementDate || item.createdAt?.slice(0, 10) || '-'}
                          </p>
                          {item.description && (
                            <p className="text-sm text-slate-500 line-clamp-2 mt-2">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-3">
                            <Badge variant="secondary">
                              {allianceLabel('achievementType', item.type)}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <DetailEmpty icon={Award} title={t('暂无关联成果')} />
                )}
              </CardContent>
            </Card>
          ),
        },
      ]}
    />
  )
}
