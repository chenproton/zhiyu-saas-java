"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { ApprovalStepInfo } from "@/hooks/use-approvals"

interface ApprovalDialogsProps {
  entityLabel?: string
  mode?: "single" | "batch"
  selectedCount?: number
  stepInfo?: ApprovalStepInfo
  onApprove: (comment: string) => Promise<void>
  onReject: (comment: string) => Promise<void>
}

function formatStepInfo(info?: ApprovalStepInfo): string {
  if (!info) return ""
  const stepLabel = info.currentStepName || `第 ${info.currentStepIndex + 1} 步`
  const progress = info.totalSteps > 1 ? `（第 ${info.currentStepIndex + 1} / ${info.totalSteps} 步）` : ""
  if (info.isFinalStep) {
    return `当前审批步骤：${stepLabel}${progress}，通过后该资源将最终生效。`
  }
  return `当前审批步骤：${stepLabel}${progress}，通过后将继续流转至下一步审批。`
}

export function useApprovalDialogs({
  entityLabel = "项目",
  mode = "single",
  selectedCount = 0,
  stepInfo,
  onApprove,
  onReject,
}: ApprovalDialogsProps) {
  const isBatch = mode === "batch"
  const countLabel = selectedCount > 0 ? `${selectedCount} 条` : ""
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState("")

  const openApprove = () => {
    setComment("")
    setApproveOpen(true)
  }

  const openReject = () => {
    setComment("")
    setRejectOpen(true)
  }

  const confirmApprove = async () => {
    await onApprove(comment)
    setApproveOpen(false)
    setComment("")
  }

  const confirmReject = async () => {
    if (!comment.trim()) return
    await onReject(comment.trim())
    setRejectOpen(false)
    setComment("")
  }

  const dialogs = (
    <>
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBatch ? `批量通过 ${countLabel}${entityLabel}` : "通过审批"}</DialogTitle>
            <DialogDescription>
              {isBatch
                ? `请填写审批备注（可选），确认批量通过 ${countLabel}${entityLabel}。`
                : `请填写审批备注（可选），确认通过该${entityLabel}审批。`}
              {!isBatch && stepInfo && (
                <span className="block mt-1.5 text-amber-600">{formatStepInfo(stepInfo)}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入审批备注..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmApprove}>确认通过</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBatch ? `批量驳回 ${countLabel}${entityLabel}` : `驳回${entityLabel}`}</DialogTitle>
            <DialogDescription>
              {isBatch
                ? `请填写驳回原因，将批量驳回 ${countLabel}${entityLabel}。`
                : "请填写驳回原因，建设者将收到修改通知。"}
              {!isBatch && (
                <span className="block mt-1.5 text-amber-600">驳回后该审批将直接结束。</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请详细说明需要修改的内容..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!comment.trim()}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  const actionButtons = (status: string) => {
    if (status !== "pending") return null
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={openReject}
        >
          <X className="mr-1 h-3 w-3" />
          驳回
        </Button>
        <Button size="sm" onClick={openApprove}>
          <Check className="mr-1 h-3 w-3" />
          通过
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
        批量驳回
      </Button>
      <Button size="sm" onClick={openApprove}>
        <Check className="mr-1 h-3 w-3" />
        批量通过
      </Button>
    </>
  )

  return { dialogs, approveAction: actionButtons, batchActionButtons }
}
