"use client"

import { BatchGroupPage } from "@/components/shared/batch-group-page"
import { batchApi } from "@/lib/api"

export default function BatchesPage() {
  return (
    <BatchGroupPage
      api={batchApi}
      subtitle="管理教务批次分组，关联审批流程"
      namePlaceholder="例如：2025秋季人才培养方案建设"
      workflowHint="批次内所有人培方案将使用相同的审批流程"
    />
  )
}
