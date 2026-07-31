"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@zhiyu/ui"
import { Loader2, Download, FileUp } from "lucide-react"
import { importExportApi } from "@zhiyu/api-client"

interface ProgramCourseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  onImported: () => void
}

export function ProgramCourseImportDialog({ open, onOpenChange, programId, onImported }: ProgramCourseImportDialogProps) {
  const { toast } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddFiles = (fl: FileList | null) => {
    if (!fl) return
    const existing = new Set(files.map((f) => f.name + "_" + f.size))
    const added = Array.from(fl).filter((f) => !existing.has(f.name + "_" + f.size))
    setFiles((prev) => [...prev, ...added])
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await importExportApi.downloadTemplate("program-courses")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "方案课程批量导入模板.xlsx"; a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(false) }
  }

  const handleImport = async () => {
    if (files.length === 0) return
    setImporting(true)
    try {
      const form = new FormData()
      files.forEach((f) => form.append("file", f))
      const res = await fetch(`/api/v1/import/program-courses/excel?programId=${encodeURIComponent(programId)}`, {
        method: "POST", body: form,
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "导入完成", description: `成功导入 ${data.created || 0} 门课程${data.errors?.length ? "，" + data.errors.length + " 条错误" : ""}` })
        onOpenChange(false)
        setFiles([])
        onImported()
      } else {
        toast({ variant: "destructive", title: "导入失败", description: data.error || "请检查文件格式" })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "请稍后重试" })
    } finally { setImporting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量导入课程</DialogTitle>
          <DialogDescription>下载模板填写后上传，将替换当前方案的全部课程</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button variant="outline" onClick={handleDownload} disabled={downloading} className="w-full">
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            下载导入模板
          </Button>
          <div className="rounded-lg border border-dashed p-6 text-center">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => handleAddFiles(e.target.files)} />
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()} className="mx-auto">
              <FileUp className="mr-2 h-4 w-4" />
              {files.length > 0 ? `已选 ${files.length} 个文件（${files.map((f) => f.name).join("、")}）` : "选择 Excel 文件"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setFiles([]) }} disabled={importing}>取消</Button>
          <Button onClick={handleImport} disabled={files.length === 0 || importing}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {importing ? "导入中..." : "开始导入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
