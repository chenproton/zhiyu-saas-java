"use client"

import { ContentListPage } from "@/components/shared/content-list-page"
import { EvaluationListTable } from "@/components/evaluation/evaluation-list-table"
import { questionBankApi, evaluationBatchApi, approvalApi, importExportApi } from "@/lib/api"
import type { ContentBatch } from "@/components/shared/content-list-page"
import { useAuth } from "@/components/auth-provider"

interface BankItem {
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
  collaboratorNames: string[]
  creatorName: string
  isDraftPool?: boolean
  updatedAt: string
}

function draftSuffix() {
  const d = new Date()
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return `${ds}_${c[Math.floor(Math.random() * 36)]}${c[Math.floor(Math.random() * 36)]}`
}

function mapBankItem(backend: any, _currentUserId: string): BankItem {
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
    questionCount: backend.questionCount || 0,
    collaboratorNames: backend.collaboratorNames || [],
    creatorName: backend.creatorName || backend.creatorId || "",
    isDraftPool: backend.isDraftPool,
    updatedAt: backend.updatedAt,
  }
}

function mapBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function QuestionBanksPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ""

  return (
    <ContentListPage<BankItem>
      title="题库资源管理"
      subtitle="维护题库及题目资源，支持审批、发布与批次分组管理"
      entityLabel="题库"
      addHref="/evaluation/question-banks"
      permissionModule="evaluation"
      permissionResource="question-banks"
      itemApi={questionBankApi as any}
      batchApi={evaluationBatchApi as any}
      approvalApi={approvalApi as any}
      importExportApi={importExportApi}
      approvalTargetType="question_bank"
      importEntityName="question_banks"
      exportEntityName="question_banks"
      importExcelEntity="question-banks"
      coBuilderField="collaboratorIds"
      statusFilterOptions={[
        { value: "draft", label: "草稿" },
        { value: "pending", label: "审批中" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已驳回" },
        { value: "published", label: "已发布" },
        { value: "archived", label: "已归档" },
      ]}
      mapItem={(b) => mapBankItem(b, currentUserId)}
      mapBatch={mapBatch}
      createPayload={() => ({
        name: `新建题库_${draftSuffix()}`,
        description: "",
        coverImage: "",
        collaboratorIds: [],
        collaboratorDeptIds: [],
        batchId: "",
        status: "draft",
        ownerType: "mine",
        version: "v1.0",
        isDraftPool: false,
      })}
      createRedirectUrl={(id) => `/evaluation/question-banks/${id}?new=true`}
      renderList={(props) => <EvaluationListTable {...(props as any)} type="bank" />}
    />
  )
}
