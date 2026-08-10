'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'

interface AiAssistProgressDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  title?: string
  description?: string
  /** 步骤列表；currentStep < 0 表示全部完成，index = steps.length 时全部完成 */
  steps: string[]
  currentStep: number
  progress: number
}

export function AiAssistProgressDialog({
  open,
  onOpenChange,
  title = 'AI 辅助编写中',
  description = '大模型正在处理岗位信息，请稍候...',
  steps,
  currentStep,
  progress,
}: AiAssistProgressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl border-gray-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-800">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">{description}</DialogDescription>
        </DialogHeader>
        <div className="py-6 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-purple-700">
              <span>当前进度</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-2">
            {steps.map((step, idx) => {
              const isDone = currentStep >= steps.length || idx < currentStep
              const isActive = !isDone && idx === currentStep
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm transition-colors ${
                    isActive
                      ? 'bg-purple-50/50 border-purple-200 text-purple-800'
                      : isDone
                        ? 'bg-green-50/50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-100 text-gray-400'
                  }`}
                >
                  <div className="shrink-0">
                    {isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  <span className="font-medium">{step}</span>
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
