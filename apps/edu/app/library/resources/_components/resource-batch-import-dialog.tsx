'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, File, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@zhiyu/ui'
import { fileApi, resourceLibraryApi } from '@/lib/api'
import { RESOURCE_TYPE_LABELS, type ResourceLibraryItem } from '@/lib/types/library'
import { ImportConfirmDialog } from '@/components/shared/import-confirm-dialog'
import {
  fileTypesWithUpload,
  resourceTypeAccept,
  validateResourceFile,
} from '@/lib/resource-type-constants'

interface ResourceBatchImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 单类型视图传入固定类型；总览视图不传，由用户在选择文件中自行选择 */
  resourceType?: string
  onImported: () => void
}

export function ResourceBatchImportDialog({
  open,
  onOpenChange,
  resourceType,
  onImported,
}: ResourceBatchImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [selectType, setSelectType] = useState('document')
  const [uploading, setUploading] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [duplicateItems, setDuplicateItems] = useState<ResourceLibraryItem[] | null>(null)

  const submitType = resourceType || selectType

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!fileTypesWithUpload.includes(submitType)) return
      const accepted: File[] = []
      let skipped = 0
      for (const file of incoming) {
        const err = validateResourceFile(file, submitType)
        if (err) {
          skipped += 1
        } else {
          accepted.push(file)
        }
      }
      if (accepted.length > 0) {
        setFiles((prev) => [...prev, ...accepted])
      }
      if (skipped > 0) {
        toast({
          variant: 'destructive',
          title: '部分文件被跳过',
          description: `${skipped} 个文件格式不支持或超过 100MB，已跳过`,
        })
      }
    },
    [submitType, toast],
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addFiles(Array.from(e.dataTransfer.files || []))
  }

  const reset = () => {
    setFiles([])
    setUploadedCount(0)
    setDuplicateItems(null)
  }

  const handleClose = (v: boolean) => {
    if (uploading) return
    onOpenChange(v)
    if (!v) reset()
  }

  const runImport = async (overwrite: boolean, existing: ResourceLibraryItem[]) => {
    const existingByName = new Map(existing.map((item) => [item.name, item.id]))
    setDuplicateItems(null)
    setUploading(true)
    setUploadedCount(0)
    let success = 0
    let failed = 0
    let skipped = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const existingId = existingByName.get(file.name)
      if (existingId && !overwrite) {
        skipped += 1
        setUploadedCount(i + 1)
        continue
      }
      try {
        const res = await fileApi.upload(file)
        const payload = {
          name: file.name,
          resourceType: submitType as any,
          url: res.url,
          thumbnail: submitType === 'image' ? res.url : undefined,
          fileSize: res.size,
          description: undefined,
        }
        if (existingId) {
          await resourceLibraryApi.update(existingId, payload as any)
        } else {
          await resourceLibraryApi.create(payload as any)
        }
        success += 1
      } catch {
        failed += 1
      }
      setUploadedCount(i + 1)
    }
    setUploading(false)
    const skippedMsg = skipped > 0 ? `，跳过 ${skipped} 个同名资源` : ''
    if (failed > 0) {
      toast({
        variant: 'destructive',
        title: '批量导入完成',
        description: `成功 ${success} 个，失败 ${failed} 个${skippedMsg}`,
      })
    } else {
      toast({ title: '批量导入成功', description: `成功导入 ${success} 个资源${skippedMsg}` })
    }
    onImported()
    onOpenChange(false)
    reset()
  }

  const handleImport = async () => {
    if (files.length === 0) return
    if (!fileTypesWithUpload.includes(submitType)) return
    let existing: ResourceLibraryItem[] = []
    try {
      const res = await resourceLibraryApi.previewImport(
        files.map((f) => f.name),
        submitType,
      )
      existing = res.items || []
    } catch {
      // 重名校验失败时按普通导入执行，容忍小概率异常
    }
    if (existing.length > 0) {
      setDuplicateItems(existing)
      return
    }
    await runImport(false, [])
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量导入资源</DialogTitle>
          <DialogDescription>支持同时选择多个文件，自动以文件名作为资源名称</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!resourceType && (
            <div>
              <Label>资源类型</Label>
              <Select value={selectType} onValueChange={setSelectType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} disabled={!fileTypesWithUpload.includes(key)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div
            className="border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors cursor-pointer hover:border-primary/30 hover:bg-gray-50/50"
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={resourceTypeAccept[submitType]}
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files || []))
                e.target.value = ''
              }}
            />
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
              <Upload className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">点击或拖拽批量选择文件</p>
              <p className="text-xs text-gray-500 mt-1">
                {resourceTypeAccept[submitType]
                  ? `支持 ${resourceTypeAccept[submitType]}，单文件最大 100MB`
                  : '支持多种格式，单文件最大 100MB'}
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                >
                  <File className="size-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1">{f.name}</span>
                  {!uploading && (
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 w-full justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在上传 {uploadedCount}/{files.length}...
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button onClick={handleImport} disabled={files.length === 0}>
                开始导入（{files.length}）
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      <ImportConfirmDialog
        open={duplicateItems !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateItems(null)
        }}
        entityLabel="资源"
        created={files.length - (duplicateItems?.length || 0)}
        duplicates={duplicateItems?.length || 0}
        failed={0}
        duplicateItems={(duplicateItems || []).map((item) => ({ key: item.id, name: item.name }))}
        onConfirmOverwrite={() => duplicateItems && runImport(true, duplicateItems)}
        onConfirmSkip={() => duplicateItems && runImport(false, duplicateItems)}
      />
    </Dialog>
  )
}
