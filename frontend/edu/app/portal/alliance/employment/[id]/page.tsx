'use client'

import { useParams } from 'react-router'
import { Link } from 'react-router'
import { Briefcase, Calendar, Building2, Users, ArrowUpRight, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { allianceEmploymentPublicApi } from '@/lib/api'
import type { EmploymentJob } from '@/lib/types'
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  EMPLOYMENT_JOB_TYPE_LABELS,
  deriveEmploymentProjectPhase,
} from '@/lib/types'
import { formatDate } from '@/lib/format-utils'
import { formatSalaryRange } from '@/lib/format-salary'
import { LoadingView, useAsync, ErrorState } from '@zhiyu/ui'
import {
  AllianceDetailShell,
  DetailInfoBlock,
  DetailSectionCard,
  DetailEmpty,
} from '@/components/alliance/alliance-detail-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'

function JobRow({ job }: { job: EmploymentJob }) {
  const t = useT()
  const salary = formatSalaryRange(job)
  return (
    <Link
      to={`/portal/alliance/employment/job/${job.id}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-primary/[0.03] border-b border-slate-100 last:border-0"
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/15 group-hover:to-primary/10 transition-colors">
        <Briefcase className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-slate-900 truncate group-hover:text-primary transition-colors">
          {job.title}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {job.enterpriseName || '-'}
          </span>
          {job.jobType && <span>{EMPLOYMENT_JOB_TYPE_LABELS[job.jobType]}</span>}
          {job.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
        </div>
      </div>
      {salary && (
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-base font-bold text-primary leading-tight">{salary}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{t('千元/月')}</p>
        </div>
      )}
      <div className="shrink-0 text-right hidden md:block">
        <p className="text-sm font-semibold text-slate-700">{job.headcount ?? '-'}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{t('招聘人数')}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
    </Link>
  )
}

export default function AllianceEmploymentProjectDetailPage() {
  const t = useT()
  const { id } = useParams() as { id: string }
  const { tenantId } = usePortalAuth()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!id || !tenantId) return undefined
      const [proj, jobsRes] = await Promise.all([
        allianceEmploymentPublicApi.getProject(id, tenantId),
        allianceEmploymentPublicApi.listProjectJobs(id, tenantId),
      ])
      return { project: proj, jobs: jobsRes.items ?? [] }
    },
    { deps: [id, tenantId], onError: () => true },
  )

  if (loading || data === undefined) return <LoadingView />
  if (error) return <ErrorState description={error.message} onRetry={refresh} />

  const { project, jobs } = data
  const phase = deriveEmploymentProjectPhase(project)
  const typeLabel = EMPLOYMENT_PROJECT_TYPE_LABELS[project.type] ?? project.type

  return (
    <AllianceDetailShell
      breadcrumbs={[
        { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
        { label: t('人才与岗位供需服务大厅'), href: '/portal/alliance/employment' },
        { label: project.name },
      ]}
      backHref="/portal/alliance/employment"
      icon={Briefcase}
      iconGradient="from-primary to-primary/70"
      title={project.name}
      subtitle={typeLabel}
      badges={[
        <Badge key="type" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {typeLabel}
        </Badge>,
        <Badge
          key="phase"
          variant="outline"
          className={`border-0 text-white ${
            phase === 'ongoing'
              ? 'bg-emerald-500'
              : phase === 'preparing'
                ? 'bg-amber-500'
                : 'bg-slate-500'
          }`}
        >
          {EMPLOYMENT_PROJECT_PHASE_LABELS[phase]}
        </Badge>,
        <Badge key="period" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
          {project.startDate ? formatDate(project.startDate) : '-'} ~{' '}
          {project.endDate ? formatDate(project.endDate) : '-'}
        </Badge>,
      ]}
      stats={[
        {
          label: t('在招岗位'),
          value: jobs.length,
          icon: Briefcase,
          gradient: 'from-primary to-primary/80',
        },
        {
          label: t('累计投递'),
          value: project.applicationCount ?? 0,
          icon: Users,
          gradient: 'from-primary/90 to-primary/70',
        },
      ]}
      tabs={[
        {
          value: 'info',
          label: t('项目信息'),
          content: (
            <div className="grid lg:grid-cols-3 gap-6">
              <DetailSectionCard icon={Briefcase} title={t('项目简介')} className="lg:col-span-2">
                {/* 封面图：与其他联盟详情页同款（projects/[id]） */}
                {project.coverImage && (
                  <div className="mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={project.coverImage}
                      alt={project.name}
                      className="w-full max-h-72 object-cover rounded-2xl border border-slate-100 shadow-sm"
                    />
                  </div>
                )}
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {project.description || '-'}
                </p>
              </DetailSectionCard>

              <DetailSectionCard icon={Calendar} title={t('项目信息')} className="h-fit self-start">
                <div className="space-y-3">
                  <DetailInfoBlock label={t('项目类型')} value={typeLabel} />
                  <DetailInfoBlock label={t('展示状态')} value={EMPLOYMENT_PROJECT_PHASE_LABELS[phase]} />
                  <DetailInfoBlock label={t('发起单位')} value={project.organizer || '-'} />
                  <DetailInfoBlock
                    label={t('起止日期')}
                    value={`${project.startDate ? formatDate(project.startDate) : '-'} ~ ${
                      project.endDate ? formatDate(project.endDate) : '-'
                    }`}
                  />
                  <DetailInfoBlock label={t('在招岗位')} value={String(jobs.length)} />
                  <DetailInfoBlock
                    label={t('累计投递')}
                    value={String(project.applicationCount ?? 0)}
                  />
                </div>
              </DetailSectionCard>
            </div>
          ),
        },
        {
          value: 'jobs',
          label: t('岗位列表'),
          count: jobs.length,
          content: (
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardContent className="p-0">
                {jobs.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {jobs.map((job) => (
                      <JobRow key={job.id} job={job} />
                    ))}
                  </div>
                ) : (
                  <DetailEmpty icon={Briefcase} title={t('本项目暂无已发布岗位')} />
                )}
              </CardContent>
            </Card>
          ),
        },
      ]}
    />
  )
}
