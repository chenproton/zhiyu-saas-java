// @ts-nocheck
"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Upload, ImageIcon } from "lucide-react"
import type { QuestionBank, QuestionBankFormData } from "@/lib/types"
import { evaluationBatchApi, fileApi } from "@/lib/api"
import { UserSelector } from "@/components/shared/user-selector"
import { useAuth } from "@/components/auth-provider"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

interface BankFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bank?: QuestionBank | null
  onSubmit: (data: QuestionBankFormData) => void
}

export function BankFormDialog({
  open,
  onOpenChange,
  bank,
  onSubmit,
}: BankFormDialogProps) {
  const { tenantId } = useAuth()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [coverUrl, setCoverUrl] = useState<string>("")
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [batchId, setBatchId] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldGroupRef = useRef<HTMLDivElement>(null)

  const [batches, setBatches] = useState<{ id: string; name: string }[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingBatches(true)
    evaluationBatchApi.list({ limit: 1000 })
      .then((res) => {
        if (!cancelled) setBatches(res.items.map((b) => ({ id: b.id, name: b.name })))
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load batches', err)
      })
      .finally(() => {
        if (!cancelled) setLoadingBatches(false)
      })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (bank) {
      setName(bank.name)
      setDescription(bank.description)
      setCoverUrl(bank.coverImage || "")
      setCollaboratorIds(bank.collaboratorIds || [])
      setBatchId(bank.batchId || "")
    } else {
      setName("")
      setDescription("")
      setCoverUrl("")
      setCollaboratorIds([])
      setBatchId("")
    }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert("文件大小不能超过 5MB")
      return
    }

    if (!file.type.startsWith("image/")) {
      alert("请上传图片文件")
      return
    }

    try {
      const res = await fileApi.upload(file)
      setCoverUrl(res.url)
    } catch (err: any) {
      alert(err?.message || "封面上传失败")
    }
  }

  const removeCover = () => {
    setCoverUrl("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent annotationContext="bank-form" annotationContainerRef={fieldGroupRef}>
        <DialogHeader>
          <DialogTitle>{bank ? "编辑题库" : "新建题库"}</DialogTitle>
          <DialogDescription>
            {bank ? "修改题库的基本信息" : "创建一个新的题库来管理题目"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup ref={fieldGroupRef} className="max-h-[60vh] overflow-y-auto py-4">
            <Field>
              <FieldLabel htmlFor="name">
                <PrdAnnotation data={getAnnotation("bf-name")}>题库名称</PrdAnnotation>
              </FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入题库名称"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">
                <PrdAnnotation data={getAnnotation("bf-description")}>题库简介</PrdAnnotation>
              </FieldLabel>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请输入题库简介（可选）"
                rows={3}
              />
            </Field>
            <Field>
              <FieldLabel>
                <PrdAnnotation data={getAnnotation("bf-cover")}>封面</PrdAnnotation>
              </FieldLabel>
              <FieldDescription>支持上传 5MB 以内的图片文件</FieldDescription>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {coverUrl ? (
                <div className="relative mt-2 w-full overflow-hidden rounded-lg border">
                  <img
                    src={coverUrl}
                    alt="封面预览"
                    className="h-32 w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 size-6"
                    onClick={removeCover}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-muted-foreground/50"
                >
                  <ImageIcon className="mb-2 size-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">点击上传封面</span>
                </div>
              )}
            </Field>
            <Field>
              <FieldLabel>
                <PrdAnnotation data={getAnnotation("bf-collaborators")}>共建人</PrdAnnotation>
              </FieldLabel>
              <FieldDescription>选择可以共同维护此题库的用户</FieldDescription>
              <div className="mt-2">
                <UserSelector
                  value={collaboratorIds}
                  onChange={setCollaboratorIds}
                  multiple
                  tenantId={tenantId}
                  excludeUserIds={bank?.creatorId ? [bank.creatorId] : undefined}
                  placeholder="点击选择共建人"
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>
                <PrdAnnotation data={getAnnotation("bf-batch")}>所属批次</PrdAnnotation>
              </FieldLabel>
              <Select value={batchId || "none"} onValueChange={(v) => setBatchId(v === "none" ? "" : v)} disabled={loadingBatches}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingBatches ? "加载批次中..." : "选择所属批次"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">不设置批次</SelectItem>
                    {batches.map(batch => (
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
                <FieldLabel>
                  <PrdAnnotation data={getAnnotation("bf-version")}>当前版本号</PrdAnnotation>
                </FieldLabel>
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm">
                  {bank.version}
                </div>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {bank ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

    </Dialog>
  )
}
