"use client"

import { BatchGroupPage } from "@/components/shared/batch-group-page"
import { lessonBatchApi } from "@/lib/api"

export default function BatchesPage() {
  return (
    <BatchGroupPage
      api={lessonBatchApi}
      subtitle="管理课程建设批次分组，关联审批流程"
      namePlaceholder="例如：2026春季电商实训课程开发"
      workflowHint="批次内所有课程将强制使用相同的审批流程"
      scene="lesson"
    />
  )
}
