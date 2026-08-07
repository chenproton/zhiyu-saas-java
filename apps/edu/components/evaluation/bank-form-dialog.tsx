'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import type { QuestionBank, QuestionBankFormData } from '@/lib/types'
import { evaluationBatchApi, fileApi } from '@/lib/api'
import { UserSelector } from '@/components/shared/user-selector'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { useAuth } from '@/components/auth-provider'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
interface BankFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bank?: QuestionBank | null
  onSubmit: (data: QuestionBankFormData) => void
}

export function BankFormDialog({ open, onOpenChange, bank, onSubmit }: BankFormDialogProps) {
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
      } catch (_err) {
        // ignore
      } finally {
        if (!cancelled) setLoadingBatches(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    queueMicrotask(() => {
      if (bank) {
        setName(bank.name)
        setDescription(bank.description)
        setCoverUrl(bank.coverImage || '')
        setCollaboratorIds(bank.collaboratorIds || [])
        setBatchId(bank.batchId || '')
      } else {
        setName('')
        setDescription('')
        setCoverUrl('')
        setCollaboratorIds([])
        setBatchId('')
      }
    })
  }, [bank, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
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
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('上传失败'),
        description: err?.message || t('封面上传失败'),
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
          <DialogTitle>{bank ? t('编辑题库') : t('新建题库')}</DialogTitle>
          <DialogDescription>
            {bank ? t('修改题库的基本信息') : t('创建一个新的题库来管理题目')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="max-h-[60vh] overflow-y-auto py-4">
            <Field>
              <FieldLabel htmlFor="name">{t('题库名称')}</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('请输入题库名称')}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">{t('题库简介')}</FieldLabel>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('请输入题库简介（可选）')}
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
                  alt={t('题库封面')}
                  onUpload={handleCoverUpload}
                  onRemove={removeCover}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>{t('共建人')}</FieldLabel>
              <FieldDescription>{t('选择可以共同维护此题库的用户')}</FieldDescription>
              <div className="mt-2">
                <UserSelector
                  value={collaboratorIds}
                  onChange={setCollaboratorIds}
                  multiple
                  tenantId={tenantId}
                  excludeUserIds={bank?.creatorId ? [bank.creatorId] : undefined}
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
            {bank && (
              <Field>
                <FieldLabel>{t('当前版本号')}</FieldLabel>
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm">
                  {bank.version}
                </div>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('取消')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {bank ? t('保存') : t('创建')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
