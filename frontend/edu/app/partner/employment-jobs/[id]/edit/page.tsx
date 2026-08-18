'use client'

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useAsync, useToast } from '@zhiyu/ui'
import { partnerEmploymentApi } from '@/lib/api'
import {
  EmploymentJobForm,
  type EmploymentJobSubmitValues,
} from '../../_components/employment-job-form'
import { FormPageShell } from '@/components/shared/form-page-shell'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function EditEmploymentJobPage() {
  const { id } = useParams() as { id: string }
  const { loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const { data: job, loading } = useAsync(
    async () => {
      if (authLoading || !id) return null
      return await partnerEmploymentApi.getJob(id)
    },
    { deps: [authLoading, id], onError: () => true },
  )

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t('岗位不存在')}</p>
      </div>
    )
  }

  const handleSubmit = async (values: EmploymentJobSubmitValues) => {
    setSubmitting(true)
    try {
      await partnerEmploymentApi.updateJob(id, {
        title: values.title,
        jobType: values.jobType,
        location: values.location,
        salaryMin: values.salaryMin,
        salaryMax: values.salaryMax,
        headcount: values.headcount,
        education: values.education,
        suitableMajors: values.suitableMajors,
        description: values.description,
        responsibilities: values.responsibilities,
        requirements: values.requirements,
        contactPerson: values.contactPerson,
        contactPhone: values.contactPhone,
        deadline: values.deadline,
      })
      toast({ title: t('已保存') })
      navigate(`/partner/employment-jobs/${id}`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
      setSubmitting(false)
    }
  }

  return (
    <FormPageShell
      title={t('编辑就业岗位')}
      description={t('岗位名称为「{title}」。', { title: job.title })}
      backHref="/partner/employment-jobs"
    >
      <Card>
        <CardContent className="pt-6">
          <EmploymentJobForm
            mode="edit"
            job={job}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </FormPageShell>
  )
}
