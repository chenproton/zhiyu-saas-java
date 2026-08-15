'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Eye } from 'lucide-react'
import { useAsync } from '@zhiyu/ui'
import { partnerEmploymentApi } from '@/lib/api'
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  deriveEmploymentProjectPhase,
  allianceLabel,
} from '@/lib/types'
import { formatDate } from '@/lib/format-utils'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { StatusBadge } from '@/components/shared/status-badge'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

function InfoItem({
  label,
  value,
  full,
}: {
  label: string
  value?: string | number | null
  full?: boolean
}) {
  if (value == null || value === '') return null
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
        {String(value)}
      </p>
    </div>
  )
}

export default function PartnerEmploymentProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()

  const { data: project, loading, error } = useAsync(
    async () => {
      if (authLoading || !user || !id) return null
      return await partnerEmploymentApi.getProject(id)
    },
    { deps: [authLoading, user?.id, id], onError: () => true },
  )

  const { data: jobs } = useAsync(
    async () => {
      if (authLoading || !user || !id) return []
      const res = await partnerEmploymentApi.listJobs({ projectId: id })
      return res.items || []
    },
    { deps: [authLoading, user?.id, id], onError: () => true },
  )
  const jobList = jobs ?? []

  const notFound = !loading && !error && !project

  const tabs = [
    {
      key: 'info',
      label: t('项目信息'),
      content: project ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoItem label={t('项目名称')} value={project.name} />
          <InfoItem
            label={t('项目类型')}
            value={EMPLOYMENT_PROJECT_TYPE_LABELS[project.type] ?? project.type}
          />
          <InfoItem
            label={t('当前状态')}
            value={EMPLOYMENT_PROJECT_PHASE_LABELS[deriveEmploymentProjectPhase(project)]}
          />
          <InfoItem label={t('发起单位')} value={project.organizer} />
          <InfoItem label={t('开始日期')} value={formatDate(project.startDate)} />
          <InfoItem label={t('结束日期')} value={formatDate(project.endDate)} />
          <InfoItem
            label={t('发布状态')}
            value={allianceLabel('publishStatus', project.publishStatus)}
          />
          <InfoItem label={t('岗位数')} value={project.jobCount} />
          <InfoItem label={t('投递数')} value={project.applicationCount} />
          <InfoItem
            label={t('面向学生群体')}
            value={(project.targetGroups ?? []).map((g) => g.majorName).filter(Boolean).join('、')}
            full
          />
          <InfoItem label={t('项目简介')} value={project.description} full />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('项目不存在或未分配给本企业')}</p>
      ),
    },
    {
      key: 'jobs',
      label: t('本企业岗位'),
      badge: jobList.length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() =>
                router.push(
                  `/partner/employment-jobs/new?projectId=${id}&schoolTenantId=${project?.tenantId ?? ''}`,
                )
              }
              disabled={!project}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('在该项目下新建岗位')}
            </Button>
          </div>
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>{t('岗位名称')}</TableHead>
                  <TableHead className="w-24">{t('类型')}</TableHead>
                  <TableHead className="w-24">{t('状态')}</TableHead>
                  <TableHead className="w-24">{t('投递数')}</TableHead>
                  <TableHead className="w-32">{t('操作')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobList.map((j) => (
                  <TableRow key={j.id} className="border-border">
                    <TableCell className="font-medium">{j.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {EMPLOYMENT_JOB_TYPE_LABELS[j.jobType] ?? j.jobType}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={j.status} label={EMPLOYMENT_JOB_STATUS_LABELS[j.status]} />
                    </TableCell>
                    <TableCell>{j.applicationCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/partner/employment-jobs/${j.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {t('查看')}
                          </Button>
                        </Link>
                        <Link href={`/partner/employment-jobs/${j.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            {t('编辑')}
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {jobList.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {t('该项目下暂无本企业岗位。')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={project?.name ?? ''}
      subtitle={project ? EMPLOYMENT_PROJECT_TYPE_LABELS[project.type] ?? project.type : undefined}
      backHref="/partner/employment-projects"
      tabs={tabs}
      defaultTab="info"
      loading={loading || authLoading}
      notFound={notFound}
      notFoundMessage={error?.message || t('项目不存在或未分配给本企业')}
    />
  )
}
