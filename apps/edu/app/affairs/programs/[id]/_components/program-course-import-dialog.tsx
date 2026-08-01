"use client"

import { useState } from "react"
import { useToast } from "@zhiyu/ui"
import { authedFetch, downloadBlob } from "@zhiyu/api-client"
import type { ImportPreviewResult } from "@zhiyu/api-client"
import { importExportApi } from "@zhiyu/api-client"
import { ImportWizardDialog } from "@/components/shared/import-wizard-dialog"
import { ImportConfirmDialog } from "@/components/shared/import-confirm-dialog"

interface ProgramCourseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  onImported: () => void
}

export function ProgramCourseImportDialog({ open, onOpenChange, programId, onImported }: ProgramCourseImportDialogProps) {
  const { toast } = useToast()
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const handleDownload = async () => {
    const res = await importExportApi.downloadTemplate("program-courses")
    downloadBlob(await res.blob(), "方案课程批量导入模板.xlsx")
  }

  const doImport = async (files: File[], overwrite = false) => {
    const form = new FormData()
    files.forEach((f) => form.append("file", f))
    form.append("programId", programId)
    const res = await authedFetch(`/import/program-courses/excel?programId=${encodeURIComponent(programId)}&overwrite=${overwrite}`, { method: "POST", body: form })
    const data = await res.json()
    if (res.ok) {
      toast({ title: "导入成功", description: `共导入 ${data.created || 0} 门课程${data.failed ? "，" + data.failed + " 条失败" : ""}` })
      onImported()
      return true
    } else {
      toast({ variant: "destructive", title: "导入失败", description: data.error || "请检查文件格式" })
      return false
    }
  }

  const handleImport = async (files: File[]) => {
    if (files.length === 0) return false
    try {
      const form = new FormData()
      files.forEach((f) => form.append("file", f))
      form.append("programId", programId)
      const previewRes = await authedFetch(`/import/program-courses/preview?programId=${encodeURIComponent(programId)}`, { method: "POST", body: form })
      const preview = await previewRes.json()
      if (preview.duplicates > 0) {
        setPendingFiles(files)
        setImportPreview({
          created: preview.created || 0,
          duplicates: preview.duplicates,
          failed: preview.failed || 0,
          duplicateItems: preview.duplicateItems || [],
          errors: preview.errors || [],
        })
        setIsConfirmOpen(true)
        return false
      }
      return await doImport(files, false)
    } catch {
      return await doImport(files, false)
    }
  }

  const handleConfirm = async (overwrite: boolean) => {
    setIsConfirmOpen(false)
    const ok = await doImport(pendingFiles, overwrite)
    if (ok) {
      setPendingFiles([])
      onOpenChange(false)
    }
  }

  return (
    <>
      <ImportWizardDialog
        open={open}
        onOpenChange={onOpenChange}
        title="导入方案课程"
        guideItems={[
          <>点击下方按钮下载最新的导入模板</>,
          <>参照模板中 Sheet 的填写说明，填入方案课程数据</>,
          <>完成后点击&quot;下一步&quot;上传文件</>,
        ]}
        downloadLabel="下载方案课程批量导入模板"
        onDownload={handleDownload}
        uploadHint="点击选择已填写的 Excel (.xlsx) 文件"
        importLabel={(count) => `开始导入（${count} 个文件）`}
        onImport={handleImport}
      />
      {importPreview && (
        <ImportConfirmDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          entityLabel="方案课程"
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => handleConfirm(true)}
          onConfirmSkip={() => handleConfirm(false)}
        />
      )}
    </>
  )
}
