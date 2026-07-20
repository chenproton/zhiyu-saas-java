"use client"

import { BatchGroupPage } from "@/components/shared/batch-group-page"
import { batchApi } from "@/lib/api"

export default function BatchesPage() {
  return (
    <BatchGroupPage
      api={batchApi}
      subtitle="管理岗位建设批次分组，关联审批流程"
      namePlaceholder="例如：2026春季电商实训岗位开发"
      workflowHint="批次内所有岗位将强制使用相同的审批流程"
      detailHref={(id) => `/job/batches/${id}`}
      scene="job"
    />
  )
}
