"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@zhiyu/ui"
import { FileDown, FileText, Plus, X } from "lucide-react"
import { importExportApi } from "@zhiyu/api-client"

interface AffairsConfigImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function AffairsConfigImportDialog({ open, onOpenChange, onImported }: AffairsConfigImportDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<"download" | "upload">("download")
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

  const handleRemoveFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i))

  const resetAndClose = () => { onOpenChange(false); setStep("download"); setFiles([]) }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await importExportApi.downloadTemplate("affairs-config" as any)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "教务配置批量导入模板.xlsx"; a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(false) }
  }

  const handleImport = async () => {
    if (files.length === 0) return
    setImporting(true)
    try {
      const data = await importExportApi.importExcel("affairs-config" as any, files[0])
      toast({ title: "导入完成", description: `学期 ${(data as any).termsCreated || 0} · 场地 ${(data as any).venuesCreated || 0} · 节次 ${(data as any).periodSlotsCreated || 0}` })
      resetAndClose()
      onImported()
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "请检查文件格式" })
    } finally { setImporting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入教务配置</DialogTitle>
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
                  <li>Excel 包含三个 Sheet：学期、场地、节次</li>
                  <li>按各 Sheet 表头填写对应数据</li>
                  <li>点击下方按钮下载模板</li>
                </ol>
              </div>
              <Button className="w-full" size="lg" onClick={handleDownload} disabled={downloading}>
                <FileDown className="mr-2 h-5 w-5" />
                {downloading ? "下载中..." : "下载教务配置批量导入模板"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{f.name}</span>
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
                <p className="text-sm text-muted-foreground">{files.length > 0 ? "继续添加文件" : "点击选择已填写的 Excel 文件"}</p>
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
            <Button onClick={handleImport} disabled={files.length === 0 || importing}>
              {importing ? "导入中..." : "开始导入"}
            </Button>
          )}
          {step === "upload" && <Button variant="ghost" size="sm" onClick={() => setStep("download")}>上一步</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
