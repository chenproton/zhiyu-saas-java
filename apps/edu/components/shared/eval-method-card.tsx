'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  Clock,
  Lightbulb,
  FolderOpen,
  ClipboardList,
  ListChecks,
  Sparkles,
  Eye,
  Layers,
  Play,
  Upload,
  CheckCircle2,
  Send,
  X,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'
import { useToast } from '@zhiyu/ui'
import { EVAL_METHOD_LABELS, EVAL_METHOD_COLORS } from '@/lib/types'

export interface EvalMethodViewModel {
  methodKey: string
  weight: number
  label?: string
  description?: string
  resourceConfig?: Record<string, any>
  reviewSteps?: Array<{
    id?: string
    label: string
    description?: string
    enabled: boolean
    [key: string]: any
  }>
  evalPoints?: Array<{
    id?: string
    name: string
    [key: string]: any
  }>
}

export interface EvalMethodResultModel {
  status: 'evaluated' | 'pending' | string
  totalScore?: number
  maxScore?: number
}

export interface EvalMethodSubmitPayload {
  methodKey: string
  subjectiveContent?: Record<string, any>
  maxScore?: number
}

export interface UploadedFile {
  name: string
  url: string
  size: number
}

const methodIconMap: Record<string, React.ElementType> = {
  paper: FileText,
  question_bank: Layers,
  quiz: ListChecks,
  random_draw: Sparkles,
  review: Eye,
  outcome: FolderOpen,
  homework: Lightbulb,
}

const methodActionText: Record<string, string> = {
  paper: '开始答题',
  question_bank: '开始答题',
  quiz: '开始答题',
  random_draw: '开始答题',
  review: '上传材料',
  outcome: '上传成果',
  homework: '上传作业',
}

const methodDescMap: Record<string, string> = {
  paper: '在线试卷答题',
  question_bank: '题库抽题作答',
  quiz: '随堂测验',
  random_draw: '随机抽题测评',
  review: '提交材料进行评审',
  outcome: '上传成果材料',
  homework: '上传作业材料',
}

const methodBgMap: Record<string, string> = {
  paper: '#f0f9ff',
  question_bank: '#faf5ff',
  quiz: '#f0fdfa',
  random_draw: '#eef2ff',
  review: '#fff1f2',
  outcome: '#f0fdf4',
  homework: '#fffbeb',
}

const methodBorderMap: Record<string, string> = {
  paper: '#bae6fd',
  question_bank: '#ddd6fe',
  quiz: '#99f6e4',
  random_draw: '#c7d2fe',
  review: '#fecdd3',
  outcome: '#bbf7d0',
  homework: '#fde68a',
}

export const EXAM_METHODS = ['paper', 'question_bank', 'quiz']
export const TEACHER_LED_METHODS = ['random_draw', 'review']
export const MANUAL_SUBMIT_METHODS = ['outcome', 'homework']

export function getEvalMethodLabel(methodKey: string) {
  return EVAL_METHOD_LABELS[methodKey] || methodKey
}

export function getEvalMethodDescription(methodKey: string) {
  return methodDescMap[methodKey] || '进入测评'
}

export function toEvalMethodViewModel(
  methodKey: string,
  weight: number,
  resourceConfig?: Record<string, any>,
  reviewSteps?: Array<any>,
  evalPoints?: Array<any>,
): EvalMethodViewModel {
  return {
    methodKey,
    weight,
    resourceConfig: resourceConfig || {},
    reviewSteps: reviewSteps || [],
    evalPoints: evalPoints || [],
  }
}

interface EvalMethodCardProps {
  method: EvalMethodViewModel
  result?: EvalMethodResultModel
  examHref?: string
  onAction?: () => void
}

export function EvalMethodCard({ method, result, examHref, onAction }: EvalMethodCardProps) {
  const t = useT()
  const color = EVAL_METHOD_COLORS[method.methodKey] || '#94a3b8'
  const bg = methodBgMap[method.methodKey] || '#f8fafc'
  const border = methodBorderMap[method.methodKey] || '#e2e8f0'
  const label = method.label || t(getEvalMethodLabel(method.methodKey))
  const Icon = methodIconMap[method.methodKey] || ClipboardList
  const weight = method.weight || 0
  const description = method.description || t(getEvalMethodDescription(method.methodKey))
  const isExamMethod = EXAM_METHODS.includes(method.methodKey)
  const isManualSubmit = MANUAL_SUBMIT_METHODS.includes(method.methodKey)

  return (
    <Card
      className="rounded-2xl overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 py-0 gap-0 flex flex-col relative"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <CardContent className="p-5 flex-1 flex flex-col relative z-10">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"
            style={{ color, border: `1px solid ${border}` }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/80 border text-gray-600"
                style={{ borderColor: border }}
              >
                {t('权重 {weight}%', { weight: Math.round(weight) })}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{description}</p>
          </div>
        </div>
        <div className="mt-auto pt-5 flex items-center justify-end">
          {result ? (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full border',
                result.status === 'evaluated'
                  ? 'text-green-600 bg-green-50 border-green-200'
                  : 'text-amber-600 bg-amber-50 border-amber-200',
              )}
            >
              {result.status === 'evaluated'
                ? t('得分 {totalScore}/{maxScore}', {
                    totalScore: result.totalScore ?? 0,
                    maxScore: result.maxScore ?? 0,
                  })
                : t('待评分')}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 bg-white/80 hover:bg-white border-gray-300 text-gray-700 hover:text-gray-900"
              asChild={isExamMethod}
              disabled={isExamMethod ? !examHref || examHref === '#' : !onAction}
              onClick={isExamMethod ? undefined : onAction}
            >
              {isExamMethod ? (
                <Link href={examHref || '#'}>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {examHref && examHref !== '#'
                    ? t(methodActionText[method.methodKey] || '开始测评')
                    : t('未配置')}
                </Link>
              ) : (
                <>
                  {isManualSubmit ? (
                    <Upload className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  {t(methodActionText[method.methodKey] || '开始测评')}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface EvalMethodSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  method: EvalMethodViewModel
  uploading?: boolean
  onFileUpload?: (file: File) => Promise<{ name: string; url: string; size: number } | null>
  onSubmit?: (payload: EvalMethodSubmitPayload) => Promise<void>
  onSubmitted?: () => void
}

export function EvalMethodSubmitDialog({
  open,
  onOpenChange,
  method,
  uploading: uploadingProp,
  onFileUpload,
  onSubmit,
  onSubmitted,
}: EvalMethodSubmitDialogProps) {
  const t = useT()
  const { toast } = useToast()
  const color = EVAL_METHOD_COLORS[method.methodKey] || '#94a3b8'
  const label = method.label || t(getEvalMethodLabel(method.methodKey))
  const Icon = methodIconMap[method.methodKey] || ClipboardList
  const resourceConfig = method.resourceConfig || {}
  const reviewSteps = method.reviewSteps || []
  const isTeacherLed = TEACHER_LED_METHODS.includes(method.methodKey)
  const isManualSubmit = MANUAL_SUBMIT_METHODS.includes(method.methodKey)
  const requiresMaterial = resourceConfig.requiresMaterial !== false

  const [text, setText] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveUploading = uploadingProp ?? uploading

  const reset = () => {
    setText('')
    setFiles([])
    setSubmitted(false)
    setError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onFileUpload) return
    setUploading(true)
    try {
      const uploaded = await onFileUpload(file)
      if (uploaded) {
        setFiles((prev: UploadedFile[]) => [...prev, uploaded])
      }
    } catch (err) {
      toast({ variant: 'destructive', title: t('上传失败'), description: err instanceof Error ? err.message : t('请重试') })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev: UploadedFile[]) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!onSubmit) {
      setError(t('未配置提交回调'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload: EvalMethodSubmitPayload = {
        methodKey: method.methodKey,
        maxScore: 100,
      }
      if (isManualSubmit) {
        payload.subjectiveContent = { text, files, attempts: 1 }
      } else if (isTeacherLed) {
        payload.subjectiveContent = { attended: true, attempts: 1 }
      } else {
        payload.subjectiveContent = {}
      }
      await onSubmit(payload)
      setSubmitted(true)
      onSubmitted?.()
    } catch (err: any) {
      setError(err?.message || t('提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const headerGradient = isManualSubmit
    ? 'from-amber-50 via-orange-50 to-white'
    : isTeacherLed
      ? 'from-primary/5 via-primary/5 to-white'
      : 'from-primary/5 via-primary/10 to-white'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg w-[92vw] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        <div className={cn('relative px-6 py-5 border-b', headerGradient)}>
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
          />
          <DialogHeader className="space-y-0">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm"
                style={{ color, border: `1px solid ${color}30` }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900">{label}</DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  {isTeacherLed
                    ? t('确认参加本次测评，后续由教师进行现场评价')
                    : t('按测评要求提交材料后等待教师评分')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-base font-semibold text-gray-900">{t('提交成功')}</h4>
              <p className="text-sm text-gray-500 mt-1">{t('等待教师评分后可在学习页查看成绩')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-2.5">
                <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {t('测评要求')}
                </h5>
                {!requiresMaterial ? (
                  <p className="text-sm text-gray-600">{t('本测评无需在线提交材料。')}</p>
                ) : (
                  <>
                    {resourceConfig.submitFormatDesc ? (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {resourceConfig.submitFormatDesc}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">{t('请按照教师要求准备材料')}</p>
                    )}
                  </>
                )}
                {resourceConfig.venueResources && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                    <span className="font-medium text-gray-700">{t('场地/环境：')}</span>
                    {resourceConfig.venueResources}
                  </p>
                )}
                {resourceConfig.deadlineDays != null && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">{t('预计提交天数：')}</span>
                    {t('{days} 天', { days: resourceConfig.deadlineDays })}
                  </p>
                )}
                {resourceConfig.allowResubmit !== undefined && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">{t('允许重新提交：')}</span>
                    {resourceConfig.allowResubmit ? t('是') : t('否')}
                  </p>
                )}
              </div>

              {method.methodKey === 'review' && reviewSteps.filter((s) => s.enabled).length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-2.5">
                  <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {t('评审流程')}
                  </h5>
                  <div className="space-y-2">
                    {reviewSteps
                      .filter((s) => s.enabled)
                      .map((s, idx) => (
                        <div key={s.id || idx} className="flex items-start gap-3 text-sm">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0 mt-0.5"
                            style={{ backgroundColor: color }}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{s.label}</p>
                            {s.description && (
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                {s.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {isManualSubmit && requiresMaterial && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">{t('文字说明')}</Label>
                    <Textarea
                      placeholder={t('描述你的成果/作业内容...')}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={4}
                      className="text-sm resize-none border-gray-200 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">{t('上传文件')}</Label>
                    {files.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {files.map((f: UploadedFile, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg"
                          >
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="flex-1 truncate">{f.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
                              onClick={() => removeFile(i)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {t('选择文件')}
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          disabled={effectiveUploading || !onFileUpload}
                          className="hidden"
                        />
                      </label>
                      {effectiveUploading && (
                        <span className="text-xs text-gray-400">{t('上传中...')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isTeacherLed && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <p className="text-sm text-primary leading-relaxed">
                    {method.methodKey === 'random_draw'
                      ? t('请确认参加本次现场问答，具体题目由教师在评分时抽取。')
                      : t('请确认参加本次现场评审，具体评价步骤由教师选择执行。')}
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          )}
        </div>

        {!submitted && (
          <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4"
              onClick={() => handleOpenChange(false)}
            >
              {t('取消')}
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 gap-1"
              style={{ backgroundColor: color }}
              onClick={handleSubmit}
              disabled={
                submitting ||
                !onSubmit ||
                (isManualSubmit && requiresMaterial && !text && files.length === 0)
              }
            >
              {submitting ? (
                <Clock className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {submitting ? t('提交中...') : isTeacherLed ? t('确认参加') : t('提交测评')}
            </Button>
          </div>
        )}
        {submitted && (
          <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-end">
            <Button
              size="sm"
              className="h-9 px-4"
              style={{ backgroundColor: color }}
              onClick={() => handleOpenChange(false)}
            >
              {t('知道了')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
