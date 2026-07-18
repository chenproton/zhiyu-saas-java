"use client"

import { BatchGroupPage } from "@/components/shared/batch-group-page"
import { evaluationBatchApi } from "@/lib/api"

export default function BatchesPage() {
  return (
    <BatchGroupPage
      api={evaluationBatchApi}
      subtitle="管理测评资源建设批次分组，关联审批流程"
      namePlaceholder="例如：2026春季测评资源建设批次"
      workflowHint="批次内所有测评资源将强制使用相同的审批流程"
    />
  )
}
