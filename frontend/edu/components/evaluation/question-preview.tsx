'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Question } from '@/lib/types'
import { QUESTION_TYPE_LABELS } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface QuestionPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: Question | null
}

export function QuestionPreview({ open, onOpenChange, question }: QuestionPreviewProps) {
  const t = useT()
  if (!question) return null

  const renderAnswer = () => {
    switch (question.type) {
      case 'single':
      case 'essay': {
        // 答案统一按 string[] 处理（后端以 JSON 数组存储，单元素数组时也按数组取值）
        const ans = Array.isArray(question.answer)
          ? (question.answer as string[]).join(', ')
          : String(question.answer ?? '')
        return <span>{ans}</span>
      }
      case 'multiple':
        return <span>{(question.answer as string[]).join(', ')}</span>
      case 'judge': {
        // 判断题答案以 JSON 数组存储（如 ['true']），按数组取值否则恒判「错误」
        const ans = Array.isArray(question.answer) ? question.answer[0] : question.answer
        return <span>{ans === 'true' ? t('正确') : t('错误')}</span>
      }
      case 'fill':
        return <span>{(question.answer as string[]).join(', ')}</span>
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('题目预览')}
            <Badge variant="secondary">{t(QUESTION_TYPE_LABELS[question.type])}</Badge>
            <Badge variant="outline">{t('{n} 分', { n: question.score })}</Badge>
          </DialogTitle>
          <DialogDescription>{t('预览题目的详细内容和答案')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-2 font-medium">{t('题目内容')}</h4>
            <p className="whitespace-pre-wrap text-sm">{question.content}</p>
          </div>

          {question.options && question.options.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">{t('选项')}</h4>
              <div className="flex flex-col gap-1">
                {question.options.map((option, index) => (
                  <div key={index} className="text-sm">
                    <span className="mr-2 text-muted-foreground">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {option}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <h4 className="mb-2 font-medium text-emerald-600">{t('正确答案')}</h4>
            <p className="text-sm">{renderAnswer()}</p>
          </div>

          {question.analysis && (
            <div>
              <h4 className="mb-2 font-medium text-primary">{t('答案解析')}</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {question.analysis}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
