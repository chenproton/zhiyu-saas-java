'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ContentListPage } from '@/components/shared/content-list-page'
import { EvaluationListTable } from '@/components/evaluation/evaluation-list-table'
import { BankFormDialog } from '@/components/evaluation/bank-form-dialog'
import { questionBankApi, evaluationBatchApi, approvalApi, importExportApi } from '@/lib/api'
import type { ContentBatch } from '@/components/shared/content-list-page'
import type { QuestionBankFormData, QuestionBank, EvaluationBatch } from '@/lib/types'
import { useAuth } from '@/components/auth-provider'
import { useToast } from '@zhiyu/ui'
import { STATUS_FILTER_OPTIONS } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'

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

function mapBankItem(backend: any, _currentUserId: string): BankItem {
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
    questionCount: backend.questionCount || 0,
    collaboratorNames: backend.collaboratorNames || [],
    creatorName: backend.creatorName || backend.creatorId || '',
    isDraftPool: backend.isDraftPool,
    updatedAt: backend.updatedAt,
  }
}

function mapBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId }
}

export default function QuestionBanksPage() {
  const t = useT()
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const router = useRouter()
  const { toast } = useToast()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreate = useCallback(
    async (data: QuestionBankFormData) => {
      try {
        const newItem = await questionBankApi.create({
          name: data.name,
          description: data.description,
          coverImage: data.coverImage || '',
          collaboratorIds: data.collaboratorIds || [],
          collaboratorDeptIds: [],
          batchId: data.batchId || '',
          status: 'draft',
          ownerType: 'mine',
          version: 'v1.0',
        })
        setRefreshKey((k) => k + 1)
        router.push(`/evaluation/question-banks/${newItem.id}?new=true`)
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: t('创建失败'),
          description: err.message || t('创建失败'),
        })
      }
    },
    [router, toast, t],
  )

  return (
    <>
      <ContentListPage<BankItem, QuestionBank, EvaluationBatch>
        key={refreshKey}
        title={t('题库资源管理')}
        subtitle={t('维护题库及题目资源，支持审批、发布与批次分组管理')}
        entityLabel={t('题库')}
        addHref="/evaluation/question-banks"
        permissionModule="evaluation"
        permissionResource="question-banks"
        itemApi={questionBankApi}
        batchApi={evaluationBatchApi}
        approvalApi={approvalApi}
        importExportApi={importExportApi}
        approvalTargetType="question_bank"
        importEntityName="question_banks"
        exportEntityName="question_banks"
        importExcelEntity="question-banks"
        coBuilderField="collaboratorIds"
        statusFilterOptions={STATUS_FILTER_OPTIONS}
        mapItem={(b) => mapBankItem(b, currentUserId)}
        mapBatch={mapBatch}
        createPayload={() => ({
          name: '',
          description: '',
          coverImage: '',
          collaboratorIds: [],
          collaboratorDeptIds: [],
          batchId: '',
        })}
        createRedirectUrl={(id) => `/evaluation/question-banks/${id}?new=true`}
        onCreate={() => setCreateDialogOpen(true)}
        renderList={(props) => <EvaluationListTable {...props} type="bank" />}
      />
      <BankFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        bank={null}
        onSubmit={handleCreate}
      />
    </>
  )
}
