"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@zhiyu/ui"
import { ImportConfirmDialog } from "@/components/shared/import-confirm-dialog"
import { importExportApi, authedFetch, downloadBlob } from "@zhiyu/api-client"
import type { ImportPreviewResult } from "@zhiyu/api-client"
import { FileDown, FileText, Plus, X } from "lucide-react"

interface ProgramCourseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  onImported: () => void
}

export function ProgramCourseImportDialog({ open, onOpenChange, programId, onImported }: ProgramCourseImportDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<"download" | "upload">("download")
  const [files, setFiles] = useState<File[]>([])
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddFiles = (fl: FileList | null) => {
    if (!fl) return
    const existing = new Set(files.map((f) => f.name + "_" + f.size))
    const added = Array.from(fl).filter((f) => !existing.has(f.name + "_" + f.size))
    setFiles((prev) => [...prev, ...added])
  }

  const handleRemoveFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  const resetAndClose = () => {
    onOpenChange(false)
    setStep("download")
    setFiles([])
    setImportPreview(null)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await importExportApi.downloadTemplate("program-courses")
      downloadBlob(await res.blob(), "方案课程批量导入模板.xlsx")
    } finally { setDownloading(false) }
  }

  const doImport = async (overwrite = false) => {
    if (files.length === 0) return
    setImporting(true)
    try {
      const form = new FormData()
      files.forEach((f) => form.append("file", f))
      form.append("programId", programId)
      const res = await authedFetch(`/import/program-courses/excel?programId=${encodeURIComponent(programId)}&overwrite=${overwrite}`, { method: "POST", body: form })
      const data = await res.json()
      if (res.ok) {
        toast({ title: `导入成功`, description: `共导入 ${data.created || 0} 门课程${data.failed ? "，" + data.failed + " 条失败" : ""}` })
        onImported()
        resetAndClose()
      } else {
        toast({ variant: "destructive", title: "导入失败", description: data.error || "请检查文件格式" })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "请稍后重试" })
    } finally { setImporting(false) }
  }

  const handleImportClick = async () => {
    if (files.length === 0) return
    setImporting(true)
    try {
      const form = new FormData()
      files.forEach((f) => form.append("file", f))
      form.append("programId", programId)
      const previewRes = await authedFetch(`/import/program-courses/preview?programId=${encodeURIComponent(programId)}`, { method: "POST", body: form })
      const preview = await previewRes.json()
      if (preview.duplicates > 0) {
        setImportPreview({ created: preview.created || 0, duplicates: preview.duplicates, failed: preview.failed || 0, duplicateItems: preview.duplicateItems || [], errors: preview.errors || [] })
        setIsConfirmOpen(true)
      } else {
        await doImport(false)
      }
    } catch {
      await doImport(false)
    } finally { setImporting(false) }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入方案课程</DialogTitle>
            <DialogDescription>
              第 {step === "download" ? "1" : "2"} 步：{step === "download" ? "下载模板并填写数据" : "上传已填写的 Excel 文件"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {step === "download" ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-2">操作指引</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>点击下方按钮下载最新的导入模板</li>
                    <li>参照模板中 Sheet 的填写说明，填入方案课程数据</li>
                    <li>完成后点击&quot;下一步&quot;上传文件</li>
                  </ol>
                </div>
                <Button className="w-full" size="lg" onClick={handleDownload} disabled={downloading}>
                  <FileDown className="mr-2 h-5 w-5" />
                  {downloading ? "下载中..." : "下载方案课程批量导入模板"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveFile(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  <Plus className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {files.length > 0 ? "继续添加文件" : "点击选择已填写的 Excel (.xlsx) 文件"}
                  </p>
                  <input ref={fileInputRef} type="file" multiple accept=".xlsx" className="hidden"
                    onChange={(e) => handleAddFiles(e.target.files)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>取消</Button>
            {step === "download" ? (
              <Button onClick={() => setStep("upload")}>下一步</Button>
            ) : (
              <Button onClick={handleImportClick} disabled={files.length === 0 || importing}>
                {importing ? "导入中..." : `开始导入（${files.length} 个文件）`}
              </Button>
            )}
            {step === "upload" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("download")}>上一步</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importPreview && (
        <ImportConfirmDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          entityLabel="方案课程"
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => { setIsConfirmOpen(false); doImport(true) }}
          onConfirmSkip={() => { setIsConfirmOpen(false); doImport(false) }}
        />
      )}
    </>
  )
}
