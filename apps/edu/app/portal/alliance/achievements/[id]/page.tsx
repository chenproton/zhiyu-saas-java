'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  AllianceDetailShell,
  DetailInfoBlock,
  DetailSectionCard,
} from '@/components/alliance/alliance-detail-shell'
import {
  Award,
  Building2,
  FolderKanban,
  FileText,
  Calendar,
  Users,
  Handshake,
  Layers,
  BookOpen,
  Briefcase,
  Image as ImageIcon,
  ArrowUpRight,
} from 'lucide-react'
import { portalRequest } from '@/lib/api'
import { fetchAllPages } from '@zhiyu/api-client'
import { allianceLabel } from '@zhiyu/shared-types'
import {
  RelatedObjectCard,
  normalizeRelatedRefs,
} from '@/components/alliance/related-object-card'
import type {
  AllianceAchievement,
  AllianceEnterprise,
  AllianceProject,
} from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { LoadingView, EmptyState, ErrorState } from '@zhiyu/ui'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'

function StringList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <Badge key={s} variant="secondary" className="font-normal px-2.5 py-1">
          {s}
        </Badge>
      ))}
    </div>
  )
}

function RelatedRow({
  icon: Icon,
  iconClass,
  label,
  value,
  href,
}: {
  icon: React.ElementType
  iconClass: string
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
      <div
        className={`h-10 w-10 rounded-lg ${iconClass} flex items-center justify-center shrink-0`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        {href ? (
          <Link
            href={href}
            className="font-medium text-slate-900 hover:text-emerald-600 transition-colors text-sm inline-flex items-center gap-0.5"
          >
            {value} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <p className="font-medium text-slate-900 text-sm">{value}</p>
        )}
      </div>
    </div>
  )
}

export default function AlliancePublicAchievementDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const [achievement, setAchievement] = useState<AllianceAchievement | null>(null)
  const [partners, setPartners] = useState<AllianceEnterprise[]>([])
  const [relatedProject, setRelatedProject] = useState<AllianceProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id || !tenantId) return
    const q = `?tenantId=${tenantId}`
    // 关联企业/项目分页全量拉取：public 接口默认 100 条截断，避免学校链接对象超量时关联信息静默缺失
    Promise.all([
      portalRequest<AllianceAchievement>(`/alliance/public/achievements/${id}${q}`),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceEnterprise[] }>(
          `/alliance/public/enterprises${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
      fetchAllPages((page, pageSize) =>
        portalRequest<{ items: AllianceProject[] }>(
          `/alliance/public/projects${q}&limit=${pageSize}&offset=${page * pageSize}`,
        ),
      ),
    ])
      .then(([a, ents, projs]) => {
        setAchievement(a)
        const entIds = a.enterpriseIds ?? []
        setPartners(ents.filter((e) => entIds.includes(e.id)))
        const pid = (a.projectIds ?? [])[0]
        setRelatedProject(projs.find((p) => p.id === pid) ?? null)
      })
      .catch((err) => {
        reportError(err, { source: '加载成果详情' })
        setLoadError(err instanceof Error ? err.message : t('加载失败'))
      })
      .finally(() => setLoading(false))
  }, [id, tenantId, reloadKey, t])

  if (loading) return <LoadingView />
  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
  }
  if (!achievement) return <EmptyState title={t('成果不存在')} />

  const attachments = achievement.attachments ?? []
  const scenes = normalizeRelatedRefs(achievement.relatedScenes)
  const courses = normalizeRelatedRefs(achievement.relatedCourses)
  const positions = normalizeRelatedRefs(achievement.relatedPositions)
  const ownerPersons = achievement.ownerPersons ?? []
  const coBuilders = achievement.coBuilders ?? []

  return (
    <AllianceDetailShell
      breadcrumbs={[
        { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
        { label: t('合作成果列表'), href: '/portal/alliance/achievements' },
        { label: achievement.title },
      ]}
      backHref="/portal/alliance/achievements"
      icon={Award}
      iconGradient="from-violet-500 to-purple-600"
      pageGradient="from-slate-50 via-white to-violet-50/40"
      title={achievement.title}
      subtitle={allianceLabel('achievementType', achievement.type)}
      badges={[
        <Badge key="type" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {allianceLabel('achievementType', achievement.type)}
        </Badge>,
        <Badge key="date" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {achievement.achievementDate
            ? new Date(achievement.achievementDate).toLocaleDateString('zh-CN')
            : '-'}
        </Badge>,
      ]}
      tabs={[
        {
          value: 'info',
          label: t('基本信息'),
          content: (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <DetailSectionCard title={t('成果简介')}>
                  <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                    {achievement.description || '-'}
                  </p>
                </DetailSectionCard>

                {achievement.citationReason && (
                  <DetailSectionCard icon={Handshake} title={t('引用原因 / 核心亮点')}>
                    <p className="text-slate-700 leading-7 text-[15px] whitespace-pre-wrap">
                      {achievement.citationReason}
                    </p>
                  </DetailSectionCard>
                )}

                {achievement.coverImage && (
                  <DetailSectionCard icon={ImageIcon} title={t('成果封面')}>
                    <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-100 max-w-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={achievement.coverImage}
                        alt={t('成果封面')}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </DetailSectionCard>
                )}

                {(ownerPersons.length > 0 || coBuilders.length > 0) && (
                  <DetailSectionCard icon={Users} title={t('人员信息')}>
                    <div className="space-y-5">
                      {ownerPersons.length > 0 && (
                        <div>
                          <p className="text-sm text-slate-500 mb-2.5">{t('成果归属人')}</p>
                          <StringList items={ownerPersons} />
                        </div>
                      )}
                      {coBuilders.length > 0 && (
                        <div>
                          <p className="text-sm text-slate-500 mb-2.5">{t('成果共建人')}</p>
                          <StringList items={coBuilders} />
                        </div>
                      )}
                    </div>
                  </DetailSectionCard>
                )}
              </div>

              <div className="space-y-6">
                <DetailSectionCard title={t('关联信息')}>
                  <div className="space-y-3">
                    {partners.length > 0 &&
                      partners.map((p) => (
                        <RelatedRow
                          key={p.id}
                          icon={Building2}
                          iconClass="bg-blue-100 text-blue-600"
                          label={t('合作企业')}
                          value={p.name}
                          href={`/portal/alliance/enterprises/${p.id}`}
                        />
                      ))}
                    {relatedProject && (
                      <RelatedRow
                        icon={FolderKanban}
                        iconClass="bg-violet-100 text-violet-600"
                        label={t('归属项目')}
                        value={relatedProject.name}
                        href={`/portal/alliance/projects/${relatedProject.id}`}
                      />
                    )}
                    {partners.length === 0 && !relatedProject && (
                      <p className="text-sm text-slate-400">{t('暂无关联信息')}</p>
                    )}
                  </div>
                </DetailSectionCard>

                <DetailSectionCard icon={Calendar} title={t('成果信息')}>
                  <div className="space-y-3">
                    <DetailInfoBlock
                      label={t('成果类型')}
                      value={allianceLabel('achievementType', achievement.type)}
                    />
                    <DetailInfoBlock
                      label={t('关联二级学院')}
                      value={(achievement.secondaryColleges ?? []).join('、')}
                    />
                    <DetailInfoBlock
                      label={t('发布日期')}
                      value={achievement.achievementDate || '-'}
                    />
                    <DetailInfoBlock
                      label={t('创建时间')}
                      value={new Date(achievement.createdAt).toLocaleDateString('zh-CN')}
                    />
                    <DetailInfoBlock
                      label={t('更新时间')}
                      value={new Date(achievement.updatedAt).toLocaleDateString('zh-CN')}
                    />
                  </div>
                </DetailSectionCard>
              </div>
            </div>
          ),
        },
        {
          value: 'attachments',
          label: t('成果佐证材料'),
          count: attachments.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {attachments.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {attachments.map((file, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={idx}
                        src={file}
                        alt={t('佐证材料 {idx}', { idx: idx + 1 })}
                        className="w-full aspect-[4/3] object-cover rounded-2xl border border-slate-100 shadow-sm"
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText className="h-10 w-10 opacity-50" />}
                    title={t('暂无佐证材料')}
                    titleClassName="text-slate-500"
                    className="py-16"
                  />
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'scenes',
          label: t('关联实践场景'),
          count: scenes.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {scenes.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {scenes.map((scene) => (
                      <RelatedObjectCard key={scene.id} item={scene} kind="scenes" />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Layers className="h-10 w-10 opacity-50" />}
                    title={t('暂无关联场景')}
                    titleClassName="text-slate-500"
                    className="py-16"
                  />
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'courses',
          label: t('关联数字课程'),
          count: courses.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {courses.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {courses.map((course) => (
                      <RelatedObjectCard key={course.id} item={course} kind="courses" />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<BookOpen className="h-10 w-10 opacity-50" />}
                    title={t('暂无关联课程')}
                    titleClassName="text-slate-500"
                    className="py-16"
                  />
                )}
              </CardContent>
            </Card>
          ),
        },
        {
          value: 'positions',
          label: t('关联职业岗位'),
          count: positions.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-6">
                {positions.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {positions.map((position) => (
                      <RelatedObjectCard key={position.id} item={position} kind="positions" />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Briefcase className="h-10 w-10 opacity-50" />}
                    title={t('暂无关联岗位')}
                    titleClassName="text-slate-500"
                    className="py-16"
                  />
                )}
              </CardContent>
            </Card>
          ),
        },
      ]}
    />
  )
}
