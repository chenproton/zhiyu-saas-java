'use client'

import { WorkflowConfigPage } from '@/components/shared/workflow-config-page'
import { useT } from '@/lib/i18n/locale-provider'

export default function WorkflowsPage() {
  const t = useT()
  return <WorkflowConfigPage subtitle={t('配置教务审批流模板，供批次关联使用')} />
}
