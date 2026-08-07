'use client'

import { BatchGroupPage } from '@/components/shared/batch-group-page'
import { sceneBatchApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export default function BatchesPage() {
  const t = useT()
  return (
    <BatchGroupPage
      api={sceneBatchApi}
      subtitle={t('管理场景建设批次分组，关联审批流程')}
      namePlaceholder={t('例如：2026春季电商实训场景开发')}
      workflowHint={t('批次内所有场景将强制使用相同的审批流程')}
    />
  )
}
