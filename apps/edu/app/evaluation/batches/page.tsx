'use client'

import { BatchGroupPage } from '@/components/shared/batch-group-page'
import { evaluationBatchApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export default function BatchesPage() {
  const t = useT()
  return (
    <BatchGroupPage
      api={evaluationBatchApi}
      subtitle={t('管理测评资源建设批次分组，关联审批流程')}
      namePlaceholder={t('例如：2026春季测评资源建设批次')}
      workflowHint={t('批次内所有测评资源将强制使用相同的审批流程')}
    />
  )
}
