'use client'

import { BatchGroupPage } from '@/components/shared/batch-group-page'
import { affairsBatchApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export default function BatchesPage() {
  const t = useT()
  return (
    <BatchGroupPage
      api={affairsBatchApi}
      subtitle={t('管理教务批次分组，关联审批流程')}
      namePlaceholder={t('例如：2025秋季人才培养方案建设')}
      workflowHint={t('批次内所有人培方案将使用相同的审批流程')}
    />
  )
}
