"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { ContentListPage } from "@/components/shared/content-list-page"
import { EvaluationListTable } from "@/components/evaluation/evaluation-list-table"
import { ExamFormDialog } from "@/components/evaluation/exam-form-dialog"
import { examApi, evaluationBatchApi, approvalApi, importExportApi } from "@/lib/api"
import type { ContentBatch } from "@/components/shared/content-list-page"
import type { ExamFormData } from "@/lib/types"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@zhiyu/ui"

interface ExamItem {
  id: string
  name: string
  status: string
  batchId?: string
  creatorId?: string
  coCreatorIds: string[]
  rejectReason?: string
  code: string
  description: string
  questionCount: number
  totalScore: number
  collaboratorNames: string[]
  creatorName: string
  updatedAt: string
  questions: any[]
}

function mapExamItem(backend: any, _currentUserId: string): ExamItem {
  return {
    id: backend.id,
    name: backend.name,
    status: backend.status,
    batchId: backend.batchId ?? undefined,
    creatorId: backend.creatorId ?? undefined,
    coCreatorIds: backend.collaboratorIds || [],
    rejectReason: (backend as any).rejectReason ?? undefined,
    code: backend.code || "",
    description: backend.description || "",
    questionCount: (backend.questions || []).length,
    totalScore: backend.totalScore || 0,
    collaboratorNames: backend.collaboratorNames || [],
    creatorName: backend.creatorName || backend.creatorId || "",
    updatedAt: backend.updatedAt,
    questions: backend.questions || [],
  }
}

function mapBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function ExamsPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ""
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  const handleReview = useCallback(async (id: string, status: "approved" | "rejected") => {
    try {
      const records = await approvalApi.list({ targetType: "exam", targetId: id, limit: 1 })
      if (records.items.length === 0) {
        toast({ variant: "destructive", title: "操作失败", description: "未找到审批记录" })
        return
      }
      await approvalApi.review(records.items[0].id, { status })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error("审批操作失败", err)
      toast({ variant: "destructive", title: "审批操作失败" })
    }
  }, [toast])

  return (
    <ContentListPage<ExamItem>
      key={refreshKey}
      title="试卷资源管理"
      subtitle="维护试卷资源，支持组卷、审批、发布与批次分组管理"
      entityLabel="试卷"
      addHref="/evaluation/exams"
      permissionModule="evaluation"
      permissionResource="exams"
      itemApi={examApi as any}
      batchApi={evaluationBatchApi as any}
      approvalApi={approvalApi as any}
      importExportApi={importExportApi}
      approvalTargetType="exam"
      importEntityName="exams"
      exportEntityName="exams"
      importExcelEntity="exams"
      coBuilderField="collaboratorIds"
      statusFilterOptions={[
        { value: "draft", label: "草稿" },
        { value: "pending", label: "审批中" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已驳回" },
        { value: "published", label: "已发布" },
        { value: "archived", label: "已归档" },
      ]}
      mapItem={(b) => mapExamItem(b, currentUserId)}
      mapBatch={mapBatch}
      createPayload={() => ({
        name: `新建试卷_${draftSuffix()}`,
        description: "",
        duration: 60,
        coverImage: "",
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: "",
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        questions: [],
      })}
      createRedirectUrl={(id) => `/evaluation/exams/${id}?new=true`}
      renderList={(props) => <EvaluationListTable {...(props as any)} type="exam" onReview={handleReview} />}
    />
  )
}
