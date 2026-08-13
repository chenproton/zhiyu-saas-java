'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ApprovalStepInfo } from '@/hooks/use-approvals'
import { useT } from '@/lib/i18n/locale-provider'
import { formatDateTime } from '@/lib/format-utils'
import { FormDialogFooter } from '@zhiyu/ui'

interface ApprovalHistoryItem {
  action?: string
  status?: string
  remark?: string
  comment?: string
  stepIdx?: number
  reviewerId?: string
  reviewerName?: string
  createdAt?: string
}

interface ApprovalDialogsProps {
  entityLabel?: string
  mode?: 'single' | 'batch'
  selectedCount?: number
  stepInfo?: ApprovalStepInfo
  history?: ApprovalHistoryItem[]
  onApprove: (comment: string) => Promise<void>
  onReject: (comment: string) => Promise<void>
}

function ApprovalHistoryWaterfall({
  stepInfo,
  history,
}: {
  stepInfo?: ApprovalStepInfo
  history?: ApprovalHistoryItem[]
}) {
  const t = useT()
  if (!stepInfo || !history || history.length === 0) return null

  const previousItems = history.filter((h) => (h.stepIdx ?? 0) < stepInfo.currentStepIndex)
  if (previousItems.length === 0) return null

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-medium text-slate-700 mb-3">{t('前面步骤的审批意见')}</h4>
      <div className="space-y-0">
        {previousItems.map((h, idx) => {
          const stepIndex = h.stepIdx ?? 0
          const stepName =
            stepInfo.steps[stepIndex]?.name || t('第 {step} 步', { step: stepIndex + 1 })
          const isApproved = (h.action || h.status) === 'approved'
          const isLast = idx === previousItems.length - 1
          return (
            <div key={idx} className="relative pl-5 pb-4">
              {!isLast && <div className="absolute left-[7px] top-3 bottom-0 w-px bg-slate-200" />}
              <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-300 shadow-sm" />
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-600">{stepName}</span>
                  <Badge
                    variant={isApproved ? 'default' : 'destructive'}
                    className="text-[10px] h-5 px-1.5"
                  >
                    {isApproved ? t('通过') : t('驳回')}
                  </Badge>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {h.remark || h.comment || t('无审批意见')}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{h.reviewerName || h.reviewerId || t('未知审批人')}</span>
                  <span>{formatDateTime(h.createdAt)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function useApprovalDialogs({
  entityLabel = '项目',
  mode = 'single',
  selectedCount = 0,
  stepInfo,
  history,
  onApprove,
  onReject,
}: ApprovalDialogsProps) {
  const t = useT()
  const isBatch = mode === 'batch'
  const countLabel = selectedCount > 0 ? t('{count} 条', { count: selectedCount }) : ''

  const formatStepInfo = (info?: ApprovalStepInfo): string => {
    if (!info) return ''
    const stepLabel = info.currentStepName || t('第 {step} 步', { step: info.currentStepIndex + 1 })
    const progress =
      info.totalSteps > 1
        ? t('（第 {current} / {total} 步）', {
            current: info.currentStepIndex + 1,
            total: info.totalSteps,
          })
        : ''
    if (info.isFinalStep) {
      return t('当前审批步骤：{stepLabel}{progress}，通过后该资源将最终生效。', {
        stepLabel,
        progress,
      })
    }
    return t('当前审批步骤：{stepLabel}{progress}，通过后将继续流转至下一步审批。', {
      stepLabel,
      progress,
    })
  }
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState('')

  const openApprove = () => {
    setComment('')
    setApproveOpen(true)
  }

  const [submitting, setSubmitting] = useState(false)

  const openReject = () => {
    setComment('')
    setRejectOpen(true)
  }

  const confirmApprove = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onApprove(comment)
      setApproveOpen(false)
      setComment('')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmReject = async () => {
    if (submitting) return
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await onReject(comment.trim())
      setRejectOpen(false)
      setComment('')
    } finally {
      setSubmitting(false)
    }
  }

  const dialogs = (
    <>
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isBatch
                ? t('批量通过 {countLabel}{entityLabel}', {
                    countLabel,
                    entityLabel: t(entityLabel),
                  })
                : t('通过审批')}
            </DialogTitle>
            <DialogDescription>
              {isBatch
                ? t('请填写审批备注（可选），确认批量通过 {countLabel}{entityLabel}。', {
                    countLabel,
                    entityLabel: t(entityLabel),
                  })
                : t('请填写审批备注（可选），确认通过该{entityLabel}审批。', {
                    entityLabel: t(entityLabel),
                  })}
              {!isBatch && stepInfo && (
                <span className="block mt-1.5 text-amber-600">{formatStepInfo(stepInfo)}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              confirmApprove()
            }}
            className="grid gap-4"
          >
            {!isBatch && <ApprovalHistoryWaterfall stepInfo={stepInfo} history={history} />}
            <div className="py-4">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('请输入审批备注...')}
                rows={4}
              />
            </div>
            <FormDialogFooter
              onCancel={() => !submitting && setApproveOpen(false)}
              confirmText={t('确认通过')}
              cancelText={t('取消')}
              loading={submitting}
            />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isBatch
                ? t('批量驳回 {countLabel}{entityLabel}', {
                    countLabel,
                    entityLabel: t(entityLabel),
                  })
                : t('驳回{entityLabel}', { entityLabel: t(entityLabel) })}
            </DialogTitle>
            <DialogDescription>
              {isBatch
                ? t('请填写驳回原因，将批量驳回 {countLabel}{entityLabel}。', {
                    countLabel,
                    entityLabel: t(entityLabel),
                  })
                : t('请填写驳回原因，建设者将收到修改通知。')}
              {!isBatch && (
                <span className="block mt-1.5 text-amber-600">{t('驳回后该审批将直接结束。')}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              confirmReject()
            }}
            className="grid gap-4"
          >
            {!isBatch && <ApprovalHistoryWaterfall stepInfo={stepInfo} history={history} />}
            <div className="py-4">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('请详细说明需要修改的内容...')}
                rows={4}
              />
            </div>
            <FormDialogFooter
              onCancel={() => !submitting && setRejectOpen(false)}
              confirmText={t('确认驳回')}
              cancelText={t('取消')}
              variant="destructive"
              confirmDisabled={!comment.trim()}
              loading={submitting}
            />
          </form>
        </DialogContent>
      </Dialog>
    </>
  )

  const actionButtons = (status: string) => {
    if (status !== 'pending') return null
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={openReject}
        >
          <X className="mr-1 h-3 w-3" />
          {t('驳回')}
        </Button>
        <Button size="sm" onClick={openApprove}>
          <Check className="mr-1 h-3 w-3" />
          {t('通过')}
        </Button>
      </div>
    )
  }

  const batchActionButtons = () => (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-red-500 hover:text-red-600 hover:bg-red-50"
        onClick={openReject}
      >
        <X className="mr-1 h-3 w-3" />
        {t('批量驳回')}
      </Button>
      <Button size="sm" onClick={openApprove}>
        <Check className="mr-1 h-3 w-3" />
        {t('批量通过')}
      </Button>
    </>
  )

  return { dialogs, approveAction: actionButtons, batchActionButtons }
}
