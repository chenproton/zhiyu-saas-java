"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@zhiyu/ui"
import { Download, Upload, Loader2 } from "lucide-react"
import { request } from "@zhiyu/api-client"

interface ProgramCourseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  onImported: () => void
}

export function ProgramCourseImportDialog({ open, onOpenChange, programId, onImported }: ProgramCourseImportDialogProps) {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    try {
      const a = document.createElement("a")
      a.href = "/api/v1/templates/program-courses"
      a.download = "方案课程批量导入模板.xlsx"
      a.click()
    } finally { setDownloading(false) }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await request<{ created: number; errors: string[] }>(
        `/import/program-courses/${programId}`,
        { method: "POST", body: formData }
      )
      toast({ title: `导入完成`, description: `成功导入 ${res.created} 门课程${res.errors?.length ? "，" + res.errors.length + " 条错误" : ""}` })
      onOpenChange(false)
      setFile(null)
      onImported()
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "请检查文件格式" })
    } finally { setImporting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量导入课程</DialogTitle>
          <DialogDescription>下载模板，填写后上传，将替换当前方案的全部课程</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button variant="outline" onClick={handleDownloadTemplate} disabled={downloading} className="w-full">
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            下载导入模板
          </Button>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="flex-1">
              {file ? file.name : "选择 Excel 文件"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>取消</Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {importing ? "导入中..." : "开始导入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
