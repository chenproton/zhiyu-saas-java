'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContentListPage } from '@/components/shared/content-list-page'
import { EvaluationListTable } from '@/components/evaluation/evaluation-list-table'
import { ExamFormDialog } from '@/components/evaluation/exam-form-dialog'
import { examApi, evaluationBatchApi, approvalApi, importExportApi } from '@/lib/api'
import type { ContentBatch } from '@/components/shared/content-list-page'
import type { ExamFormData, Exam, EvaluationBatch } from '@/lib/types'
import { useAuth } from '@/components/auth-provider'
import { useToast } from '@zhiyu/ui'
import { reportError } from '@/lib/error-handling'
import { STATUS_FILTER_OPTIONS } from '@zhiyu/shared-types'

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
    rejectReason: backend.rejectReason ?? undefined,
    code: backend.code || '',
    description: backend.description || '',
    questionCount: (backend.questions || []).length,
    totalScore: backend.totalScore || 0,
    collaboratorNames: backend.collaboratorNames || [],
    creatorName: backend.creatorName || backend.creatorId || '',
    updatedAt: backend.updatedAt,
    questions: backend.questions || [],
  }
}

function mapBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function ExamsPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { toast } = useToast()

  const handleCreate = useCallback(
    async (data: ExamFormData) => {
      try {
        const newItem = await examApi.create({
          name: data.name,
          description: data.description,
          duration: data.duration || 60,
          coverImage: data.coverImage || '',
          collaboratorIds: data.collaboratorIds || [],
          collaboratorDeptIds: [],
          batchId: data.batchId || '',
          status: 'draft',
          ownerType: 'mine',
          version: 'v1.0',
          questions: [],
        })
        setRefreshKey((k) => k + 1)
        router.push(`/evaluation/exams/${newItem.id}?new=true`)
      } catch (err: any) {
        toast({ variant: 'destructive', title: '创建失败', description: err.message || '创建失败' })
      }
    },
    [router, toast],
  )

  const handleReview = useCallback(
    async (id: string, status: 'approved' | 'rejected') => {
      try {
        const records = await approvalApi.list({ targetType: 'exam', targetId: id, limit: 1 })
        if (records.items.length === 0) {
          toast({ variant: 'destructive', title: '操作失败', description: '未找到审批记录' })
          return
        }
        await approvalApi.review(records.items[0].id, { status })
        setRefreshKey((k) => k + 1)
      } catch (err) {
        reportError(err, '审批操作')
        toast({ variant: 'destructive', title: '审批操作失败' })
      }
    },
    [toast],
  )

  return (
    <>
      <ContentListPage<ExamItem, Exam, EvaluationBatch>
        key={refreshKey}
        title="试卷资源管理"
        subtitle="维护试卷资源，支持组卷、审批、发布与批次分组管理"
        entityLabel="试卷"
        addHref="/evaluation/exams"
        permissionModule="evaluation"
        permissionResource="exams"
        itemApi={examApi}
        batchApi={evaluationBatchApi}
        approvalApi={approvalApi}
        importExportApi={importExportApi}
        approvalTargetType="exam"
        importEntityName="exams"
        exportEntityName="exams"
        importExcelEntity="exams"
        coBuilderField="collaboratorIds"
        statusFilterOptions={STATUS_FILTER_OPTIONS}
        mapItem={(b) => mapExamItem(b, currentUserId)}
        mapBatch={mapBatch}
        createPayload={() => ({
          name: '',
          description: '',
          duration: 60,
          coverImage: '',
          collaboratorIds: [],
          collaboratorDeptIds: [],
          batchId: '',
        })}
        createRedirectUrl={(id) => `/evaluation/exams/${id}?new=true`}
        onCreate={() => setCreateDialogOpen(true)}
        renderList={(props) => (
          <EvaluationListTable {...props} type="exam" onReview={handleReview} />
        )}
      />
      <ExamFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        exam={null}
        onSubmit={handleCreate}
      />
    </>
  )
}
