'use client'

import { BatchGroupPage } from '@/components/shared/batch-group-page'
import { lessonBatchApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export default function BatchesPage() {
  const t = useT()
  return (
    <BatchGroupPage
      api={lessonBatchApi}
      subtitle={t('管理课程建设批次分组，关联审批流程')}
      namePlaceholder={t('例如：2026春季电商实训课程开发')}
      workflowHint={t('批次内所有课程将强制使用相同的审批流程')}
    />
  )
}
