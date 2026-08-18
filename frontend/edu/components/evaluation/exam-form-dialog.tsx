'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Exam, ExamFormData } from '@/lib/types'
import { evaluationBatchApi, fileApi } from '@/lib/api'
import { UserSelector } from '@/components/shared/user-selector'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { useAuth } from '@/components/auth-provider'
import { useToast, FormDialogFooter } from '@zhiyu/ui'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
interface ExamFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exam?: Exam | null
  onSubmit: (data: ExamFormData) => void
}

export function ExamFormDialog({ open, onOpenChange, exam, onSubmit }: ExamFormDialogProps) {
  const t = useT()
  const { tenantId } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState<string>('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [batchId, setBatchId] = useState<string>('')
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setLoadingBatches(true)
      try {
        const res = await evaluationBatchApi.list({ limit: 1000 })
        if (!cancelled) setBatches(res.items.map((b) => ({ id: b.id, name: b.name })))
      } catch (err) {
        reportError(err, '加载考试批次')
      } finally {
        if (!cancelled) setLoadingBatches(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    ;(async () => {
      if (exam) {
        setName(exam.name)
        setDescription(exam.description || '')
        setCollaboratorIds(exam.collaboratorIds || [])
        setBatchId(exam.batchId || '')
        setCoverUrl(exam.coverImage || '')
      } else {
        setName('')
        setDescription('')
        setCollaboratorIds([])
        setBatchId('')
        setCoverUrl('')
      }
    })()
  }, [exam, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      // 编辑时沿用已有时长，防止把非 60 分钟的试卷静默重置
      duration: exam?.duration ?? 60,
      coverImage: coverUrl || undefined,
      collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : undefined,
      batchId: batchId || undefined,
    })
    onOpenChange(false)
  }

  const handleCoverUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: t('提示'), description: t('文件大小不能超过 5MB') })
      return
    }

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: t('提示'), description: t('请上传图片文件') })
      return
    }

    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      setCoverUrl(res.url)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: t('上传失败'),
        description: err instanceof Error ? err.message : t('封面上传失败'),
      })
    } finally {
      setCoverUploading(false)
    }
  }

  const removeCover = () => {
    setCoverUrl('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{exam ? t('编辑试卷') : t('新建试卷')}</DialogTitle>
          <DialogDescription>{exam ? t('修改试卷的基本信息') : t('创建一个新的试卷')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="max-h-[60vh] overflow-y-auto py-4">
            <Field>
              <FieldLabel htmlFor="name">{t('试卷名称')}</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('请输入试卷名称')}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">{t('试卷简介')}</FieldLabel>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('请输入试卷简介（可选）')}
                rows={3}
              />
            </Field>
            <Field>
              <FieldLabel>{t('封面')}</FieldLabel>
              <FieldDescription>{t('支持上传 5MB 以内的图片文件')}</FieldDescription>
              <div className="mt-2 max-w-[400px]">
                <CoverImageUpload
                  imageUrl={coverUrl}
                  uploading={coverUploading}
                  label={t('封面')}
                  alt={t('试卷封面')}
                  onUpload={handleCoverUpload}
                  onRemove={removeCover}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>{t('共建人')}</FieldLabel>
              <FieldDescription>{t('选择可以共同维护此试卷的用户')}</FieldDescription>
              <div className="mt-2">
                <UserSelector
                  value={collaboratorIds}
                  onChange={setCollaboratorIds}
                  multiple
                  tenantId={tenantId}
                  excludeUserIds={exam?.creatorId ? [exam.creatorId] : undefined}
                  placeholder={t('点击选择共建人')}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>{t('所属批次')}</FieldLabel>
              <Select
                value={batchId || 'none'}
                onValueChange={(v) => setBatchId(v === 'none' ? '' : v)}
                disabled={loadingBatches}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingBatches ? t('加载批次中...') : t('选择所属批次')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">{t('不设置批次')}</SelectItem>
                    {batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {exam && (
              <Field>
                <FieldLabel>{t('当前版本号')}</FieldLabel>
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm">
                  {exam.version}
                </div>
              </Field>
            )}
          </FieldGroup>
          <FormDialogFooter
            onCancel={() => onOpenChange(false)}
            confirmText={exam ? t('保存') : t('创建')}
            cancelText={t('取消')}
            confirmDisabled={!name.trim()}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
