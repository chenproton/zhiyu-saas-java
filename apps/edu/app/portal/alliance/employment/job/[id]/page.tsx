'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Briefcase,
  FileText,
  ListChecks,
  Target,
  Send,
  CheckCircle2,
  ArrowRight,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { allianceEmploymentPublicApi } from '@/lib/api'
import type { EmploymentApplication } from '@/lib/types'
import {
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
} from '@/lib/types'
import { formatDate } from '@/lib/format-utils'
import { formatSalaryRange } from '@/lib/format-salary'
import { LoadingView, useToast, useAsync, ErrorState } from '@zhiyu/ui'
import {
  AllianceDetailShell,
  DetailInfoBlock,
  DetailSectionCard,
} from '@/components/alliance/alliance-detail-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'

function ReadonlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-900 truncate">{value || '-'}</p>
    </div>
  )
}

export default function AllianceEmploymentJobDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { tenantId, user, major, orgNode, activeRoleCode } = usePortalAuth()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isStudent = activeRoleCode === 'student'

  const { data, loading, error, refresh, setData } = useAsync(
    async () => {
      if (!id || !tenantId) return undefined
      try {
        const [jobData, apps] = await Promise.all([
          allianceEmploymentPublicApi.getJob(id, tenantId),
          isStudent
            ? allianceEmploymentPublicApi
                .myApplications()
                .catch(() => ({ items: [] as EmploymentApplication[] }))
            : Promise.resolve({ items: [] as EmploymentApplication[] }),
        ])
        return { job: jobData, applied: apps.items.some((a) => a.jobId === id) }
      } catch (e) {
        // 岗位已下架/删除时 public 接口返回 404，给出友好提示而非通用错误态
        if ((e as { status?: number })?.status === 404) {
          throw new Error(t('该岗位已下架或不可见'))
        }
        throw e
      }
    },
    { deps: [id, tenantId, isStudent], onError: () => true },
  )

  const handleApply = async () => {
    if (!data) return
    const job = data.job
    setSubmitting(true)
    try {
      await allianceEmploymentPublicApi.apply(job.id, coverLetter.trim())
      toast({ title: t('投递成功') })
      setData({ ...data, applied: true })
      setDialogOpen(false)
    } catch (e) {
      const status = (e as { status?: number })?.status
      if (status === 409) {
        toast({ title: t('您已投递过该岗位') })
        setData({ ...data, applied: true })
        setDialogOpen(false)
      } else if (status === 403) {
        // 403 两种情形：非学生角色 / 学生不在岗位面向群体（target_groups）内，统一展示服务端文案
        toast({ title: t('暂不可投递'), description: (e as Error).message || undefined, variant: 'destructive' })
      } else if (status === 404) {
        toast({ title: t('该岗位暂不可投递'), variant: 'destructive' })
      } else {
        toast({
          title: t('投递失败'),
          description: (e as Error).message || t('未知错误'),
          variant: 'destructive',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || data === undefined) return <LoadingView />
  if (error) return <ErrorState description={error.message} onRetry={refresh} />

  const { job, applied } = data

  const typeLabel = EMPLOYMENT_JOB_TYPE_LABELS[job.jobType] ?? job.jobType
  const salary = formatSalaryRange(job)
  const majors = job.suitableMajors ?? []

  return (
    <>
      <AllianceDetailShell
        breadcrumbs={[
          { label: t('校企合作联盟首页'), href: '/portal/alliance/landing' },
          { label: t('人才与岗位供需服务大厅'), href: '/portal/alliance/employment' },
          ...(job.projectId && job.projectName
            ? [{ label: job.projectName, href: `/portal/alliance/employment/${job.projectId}` }]
            : []),
          { label: job.title },
        ]}
        backHref="/portal/alliance/employment"
        icon={Briefcase}
        iconGradient="from-primary to-primary/70"
        title={job.title}
        subtitle={job.enterpriseName || '-'}
        badges={[
          <Badge key="type" variant="outline" className="bg-white/70 border-slate-200 text-slate-600">
            {typeLabel}
          </Badge>,
          <Badge
            key="status"
            variant="outline"
            className="bg-white/70 border-slate-200 text-slate-600"
          >
            {EMPLOYMENT_JOB_STATUS_LABELS[job.status] ?? job.status}
          </Badge>,
          ...(job.deadline
            ? [
                <Badge
                  key="deadline"
                  variant="outline"
                  className="bg-white/70 border-slate-200 text-slate-600"
                >
                  {t('截止：{date}', { date: formatDate(job.deadline) })}
                </Badge>,
              ]
            : []),
        ]}
        stats={[
          {
            label: t('招聘人数'),
            value: job.headcount ?? '-',
            icon: Users,
            gradient: 'from-primary to-primary/80',
          },
          {
            label: t('累计投递'),
            value: job.applicationCount ?? 0,
            icon: FileText,
            gradient: 'from-primary/90 to-primary/70',
          },
        ]}
        tabs={[
          {
            value: 'info',
            label: t('岗位详情'),
            content: (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <DetailSectionCard icon={FileText} title={t('岗位介绍')}>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {job.description || '-'}
                    </p>
                  </DetailSectionCard>
                  {job.responsibilities && (
                    <DetailSectionCard icon={ListChecks} title={t('岗位职责')}>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {job.responsibilities}
                      </p>
                    </DetailSectionCard>
                  )}
                  {job.requirements && (
                    <DetailSectionCard icon={Target} title={t('任职要求')}>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {job.requirements}
                      </p>
                    </DetailSectionCard>
                  )}
                </div>

                <div className="space-y-6 h-fit self-start">
                  {isStudent && (
                    <DetailSectionCard icon={Send} title={t('投递申请')}>
                      {applied ? (
                        <Button disabled className="w-full">
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {t('已投递')}
                        </Button>
                      ) : (
                        <Button className="w-full" onClick={() => setDialogOpen(true)}>
                          <Send className="mr-2 h-4 w-4" />
                          {t('立即投递')}
                        </Button>
                      )}
                      <Link
                        href="/portal/alliance/employment/mine"
                        className="mt-3 flex items-center justify-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        {t('我的投递')}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </DetailSectionCard>
                  )}

                  <DetailSectionCard icon={Briefcase} title={t('岗位信息')}>
                    <div className="space-y-3">
                      <DetailInfoBlock label={t('所属企业')} value={job.enterpriseName || '-'} />
                      <DetailInfoBlock label={t('岗位类型')} value={typeLabel} />
                      <DetailInfoBlock label={t('工作地点')} value={job.location || '-'} />
                      <DetailInfoBlock
                        label={t('薪资（千元/月）')}
                        value={salary ?? '-'}
                      />
                      <DetailInfoBlock label={t('招聘人数')} value={job.headcount ?? '-'} />
                      <DetailInfoBlock label={t('学历要求')} value={job.education || '-'} />
                      <DetailInfoBlock
                        label={t('面向专业')}
                        value={majors.length > 0 ? majors.join('、') : '-'}
                      />
                      <DetailInfoBlock label={t('联系人')} value={job.contactPerson || '-'} />
                      <DetailInfoBlock
                        label={t('截止日期')}
                        value={job.deadline ? formatDate(job.deadline) : '-'}
                      />
                    </div>
                  </DetailSectionCard>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('确认投递')}</DialogTitle>
            <DialogDescription>
              {job.title}
              {job.enterpriseName ? ` · ${job.enterpriseName}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ReadonlyField label={t('姓名')} value={user?.name} />
              <ReadonlyField label={t('专业')} value={major?.name} />
              <ReadonlyField label={t('班级/组织')} value={orgNode?.name} />
              {user?.studentNo ? (
                <ReadonlyField label={t('学号')} value={user.studentNo} />
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                {t('求职信（选填）')}
              </label>
              <Textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder={t('简单介绍你的求职意向与个人优势...')}
                rows={4}
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600">{t('投递须知')}</p>
              <p>{t('· 投递后可在「我的投递」中查看进度')}</p>
              <p>{t('· 请确保联系方式准确，便于企业联系')}</p>
              <p>{t('· 同一岗位仅可投递一次')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleApply} disabled={submitting}>
              {submitting ? t('提交中...') : t('确认投递')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
