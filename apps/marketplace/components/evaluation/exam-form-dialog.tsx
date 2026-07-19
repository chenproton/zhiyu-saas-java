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
import { X, Upload, ImageIcon, UserPlus } from "lucide-react"
import type { Exam, ExamFormData, User } from "@/lib/types"
import { evaluationBatchApi, userManagementApi, fileApi } from "@/lib/api"
import { CoBuilderDialog } from "@/components/shared/co-builder-dialog"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

interface ExamFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exam?: Exam | null
  onSubmit: (data: ExamFormData) => void
}

export function ExamFormDialog({
  open,
  onOpenChange,
  exam,
  onSubmit,
}: ExamFormDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [batchId, setBatchId] = useState<string>("")
  const [coverUrl, setCoverUrl] = useState<string>("")
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldGroupRef = useRef<HTMLDivElement>(null)

  const [users, setUsers] = useState<User[]>([])
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingBatches, setLoadingBatches] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingUsers(true)
    setLoadingBatches(true)
    userManagementApi.list({ limit: 1000 })
      .then((res) => {
        if (!cancelled) setUsers(res.items)
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load users', err)
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false)
      })
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
    if (exam) {
      setName(exam.name)
      setDescription(exam.description)
      setCollaboratorIds(exam.collaboratorIds || [])
      setBatchId(exam.batchId || "")
      setCoverUrl(exam.coverImage || "")
    } else {
      setName("")
      setDescription("")
      setCollaboratorIds([])
      setBatchId("")
      setCoverUrl("")
    }
  }, [exam, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      duration: 60,
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

  const removeCollaborator = (userId: string) => {
    setCollaboratorIds(collaboratorIds.filter(id => id !== userId))
  }

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent annotationContext="exam-form" annotationContainerRef={fieldGroupRef}>
        <DialogHeader>
          <DialogTitle>{exam ? "编辑试卷" : "新建试卷"}</DialogTitle>
          <DialogDescription>
            {exam ? "修改试卷的基本信息" : "创建一个新的试卷"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup ref={fieldGroupRef} className="max-h-[60vh] overflow-y-auto py-4">
            <Field>
              <PrdAnnotation {...getAnnotation("ef-name")}>
                <FieldLabel htmlFor="name">试卷名称</FieldLabel>
              </PrdAnnotation>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入试卷名称"
                required
              />
            </Field>
            <Field>
              <PrdAnnotation {...getAnnotation("ef-description")}>
                <FieldLabel htmlFor="description">试卷简介</FieldLabel>
              </PrdAnnotation>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请输入试卷简介"
                rows={3}
              />
            </Field>
            <Field>
              <PrdAnnotation {...getAnnotation("ef-cover")}>
                <FieldLabel>封面</FieldLabel>
              </PrdAnnotation>
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
              <PrdAnnotation {...getAnnotation("ef-collaborators")}>
                <FieldLabel>共建人</FieldLabel>
              </PrdAnnotation>
              <FieldDescription>选择可以共同维护此试卷的用户</FieldDescription>
              {collaboratorIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {collaboratorIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {getUserName(id)}
                      <button
                        type="button"
                        onClick={() => removeCollaborator(id)}
                        className="ml-1 rounded-full hover:bg-muted"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setCollaboratorDialogOpen(true)}
              >
                <UserPlus className="mr-1 size-3.5" />
                选择共建人
              </Button>
            </Field>
            <Field>
              <PrdAnnotation {...getAnnotation("ef-batch")}>
                <FieldLabel>所属批次</FieldLabel>
              </PrdAnnotation>
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
            {exam && (
              <Field>
                <PrdAnnotation {...getAnnotation("ef-version")}>
                  <FieldLabel>当前版本号</FieldLabel>
                </PrdAnnotation>
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm">
                  {exam.version}
                </div>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {exam ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <CoBuilderDialog
        open={collaboratorDialogOpen}
        onOpenChange={setCollaboratorDialogOpen}
        annotationContext="exam-co-builder"
        title="选择共建人"
        description="选择可以共同维护此试卷的用户"
        selectedIds={collaboratorIds}
        onChange={setCollaboratorIds}
      />
    </Dialog>
  )
}
