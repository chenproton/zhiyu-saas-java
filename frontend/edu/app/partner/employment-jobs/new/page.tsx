'use client'

import { Suspense, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { partnerEmploymentApi } from '@/lib/api'
import {
  EmploymentJobForm,
  type EmploymentJobSubmitValues,
} from '../_components/employment-job-form'
import { FormPageShell } from '@/components/shared/form-page-shell'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

function NewEmploymentJobPageContent() {
  const { loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') ?? undefined
  const schoolTenantId = searchParams.get('schoolTenantId') ?? undefined
  const [submitting, setSubmitting] = useState(false)

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleSubmit = async (values: EmploymentJobSubmitValues) => {
    setSubmitting(true)
    try {
      const created = await partnerEmploymentApi.createJob(values)
      toast({ title: t('已创建') })
      navigate(`/partner/employment-jobs/${created.id}`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('创建失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
      setSubmitting(false)
    }
  }

  return (
    <FormPageShell
      title={t('新建就业岗位')}
      description={t('保存后岗位为草稿状态，可在岗位列表中发布。')}
      backHref="/partner/employment-jobs"
    >
      <Card>
        <CardContent className="pt-6">
          <EmploymentJobForm
            mode="create"
            fixedProjectId={projectId}
            fixedSchoolTenantId={schoolTenantId}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </FormPageShell>
  )
}

export default function NewEmploymentJobPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NewEmploymentJobPageContent />
    </Suspense>
  )
}
