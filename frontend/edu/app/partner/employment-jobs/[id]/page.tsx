'use client'

import { useState } from 'react'
import { useParams } from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAsync } from '@zhiyu/ui'
import { partnerEmploymentApi } from '@/lib/api'
import {
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  type EmploymentApplication,
} from '@/lib/types'
import { formatDate, formatDateTime } from '@/lib/format-utils'
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

function salaryText(job: { salaryMin?: number; salaryMax?: number }): string | undefined {
  if (job.salaryMin == null && job.salaryMax == null) return undefined
  if (job.salaryMin != null && job.salaryMax != null) {
    return `${job.salaryMin} ~ ${job.salaryMax} 千元/月`
  }
  return `${job.salaryMin ?? job.salaryMax} 千元/月`
}

export default function PartnerEmploymentJobDetailPage() {
  const { id } = useParams() as { id: string }
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()
  const [selectedApp, setSelectedApp] = useState<EmploymentApplication | null>(null)

  const { data: job, loading, error } = useAsync(
    async () => {
      if (authLoading || !user || !id) return null
      return await partnerEmploymentApi.getJob(id)
    },
    { deps: [authLoading, user?.id, id], onError: () => true },
  )

  const { data: apps } = useAsync(
    async () => {
      if (authLoading || !user || !id) return []
      const res = await partnerEmploymentApi.listApplications(id)
      return res.items || []
    },
    { deps: [authLoading, user?.id, id], onError: () => true },
  )
  const applications = apps ?? []

  const notFound = !loading && !error && !job

  const tabs = [
    {
      key: 'info',
      label: t('岗位详情'),
      content: job ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoItem label={t('岗位名称')} value={job.title} />
          <InfoItem label={t('岗位类型')} value={EMPLOYMENT_JOB_TYPE_LABELS[job.jobType] ?? job.jobType} />
          <InfoItem label={t('所属就业项目')} value={job.projectName || t('独立岗位')} />
          <InfoItem label={t('工作地点')} value={job.location} />
          <InfoItem label={t('薪资范围')} value={salaryText(job)} />
          <InfoItem label={t('招聘人数')} value={job.headcount} />
          <InfoItem label={t('学历要求')} value={job.education} />
          <InfoItem
            label={t('面向专业')}
            value={(job.suitableMajors ?? []).join('、')}
            full
          />
          <InfoItem label={t('联系人')} value={job.contactPerson} />
          <InfoItem label={t('联系电话')} value={job.contactPhone} />
          <InfoItem label={t('截止日期')} value={formatDate(job.deadline)} />
          <InfoItem label={t('投递数')} value={job.applicationCount} />
          <InfoItem label={t('岗位介绍')} value={job.description} full />
          <InfoItem label={t('工作职责')} value={job.responsibilities} full />
          <InfoItem label={t('任职要求')} value={job.requirements} full />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('岗位不存在')}</p>
      ),
    },
    {
      key: 'applications',
      label: t('学生投递'),
      badge: applications.length,
      content: (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>{t('学生')}</TableHead>
                <TableHead>{t('学号')}</TableHead>
                <TableHead>{t('专业')}</TableHead>
                <TableHead>{t('班级')}</TableHead>
                <TableHead>{t('电话')}</TableHead>
                <TableHead>{t('邮箱')}</TableHead>
                <TableHead className="w-40">{t('投递时间')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer border-border hover:bg-gray-50"
                  onClick={() => setSelectedApp(a)}
                >
                  <TableCell className="font-medium text-indigo-600">
                    {a.studentName || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.studentNo || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{a.majorName || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{a.className || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{a.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{a.email || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                </TableRow>
              ))}
              {applications.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {t('暂无学生投递。')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ),
    },
  ]

  return (
    <>
      <AllianceDetailShell
        title={job?.title ?? ''}
        subtitle={job ? EMPLOYMENT_JOB_TYPE_LABELS[job.jobType] ?? job.jobType : undefined}
        statusBadge={
          job ? (
            <StatusBadge status={job.status} label={EMPLOYMENT_JOB_STATUS_LABELS[job.status]} />
          ) : undefined
        }
        backHref="/partner/employment-jobs"
        editHref={job ? `/partner/employment-jobs/${id}/edit` : undefined}
        tabs={tabs}
        defaultTab="info"
        loading={loading || authLoading}
        notFound={notFound}
        notFoundMessage={error?.message || t('岗位不存在')}
      />

      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('投递详情')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoItem label={t('学生')} value={selectedApp?.studentName} />
              <InfoItem label={t('学号')} value={selectedApp?.studentNo} />
              <InfoItem label={t('专业')} value={selectedApp?.majorName} />
              <InfoItem label={t('班级')} value={selectedApp?.className} />
              <InfoItem label={t('电话')} value={selectedApp?.phone} />
              <InfoItem label={t('邮箱')} value={selectedApp?.email} />
              <InfoItem label={t('应聘岗位')} value={selectedApp?.jobTitle} />
              <InfoItem label={t('投递时间')} value={selectedApp ? formatDateTime(selectedApp.createdAt) : undefined} />
              <InfoItem label={t('投递内容')} value={selectedApp?.coverLetter} full />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
