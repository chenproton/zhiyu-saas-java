"use client"

import { useState, useRef, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileDown, FileText, Plus, X } from "lucide-react"

interface ImportWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 对话框标题，如「导入教务配置」 */
  title: string
  /** 第一步操作指引列表项 */
  guideItems: ReactNode[]
  /** 下载按钮文案，如「下载教务配置批量导入模板」 */
  downloadLabel: string
  /** 下载模板（或当前数据） */
  onDownload: () => Promise<void>
  /** 上传区提示文案 */
  uploadHint: string
  /** 导入按钮文案（参数为已选文件数） */
  importLabel: (fileCount: number) => string
  /** 执行导入（可包含预览/重复确认流程），返回 true 表示导入成功，向导将关闭并重置 */
  onImport: (files: File[]) => Promise<boolean | undefined>
  /** 外部控制的文件列表；提供时组件不再内部维护 files */
  files?: File[]
  /** 外部控制的文件添加；提供时须同时提供 files */
  onAddFiles?: (files: FileList | null) => void
  /** 外部控制的文件移除；提供时须同时提供 files */
  onRemoveFile?: (index: number) => void
  /** 外部控制的导入中状态 */
  importing?: boolean
  /** 外部控制的下载中状态 */
  downloading?: boolean
}

/** Excel 导入两步向导：下载模板 → 上传文件 → 执行导入。
 *  只收敛 UI 状态机（两步切换、文件列表、去重、重置），导入协议由调用方注入 onImport。
 *  支持受控模式：传入 files/onAddFiles/onRemoveFile/importing/downloading 可与 useImportFlow 组合使用。 */
export function ImportWizardDialog({
  open,
  onOpenChange,
  title,
  guideItems,
  downloadLabel,
  onDownload,
  uploadHint,
  importLabel,
  onImport,
  files: controlledFiles,
  onAddFiles: controlledOnAddFiles,
  onRemoveFile: controlledOnRemoveFile,
  importing: controlledImporting,
  downloading: controlledDownloading,
}: ImportWizardDialogProps) {
  const isControlled = controlledFiles !== undefined
  const [step, setStep] = useState<"download" | "upload">("download")
  const [internalFiles, setInternalFiles] = useState<File[]>([])
  const [internalImporting, setInternalImporting] = useState(false)
  const [internalDownloading, setInternalDownloading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const files = isControlled ? controlledFiles : internalFiles
  const importing = controlledImporting ?? internalImporting
  const downloading = controlledDownloading ?? internalDownloading

  const handleAddFiles = (fl: FileList | null) => {
    if (isControlled) {
      controlledOnAddFiles?.(fl)
      return
    }
    if (!fl) return
    const existing = new Set(internalFiles.map((f) => f.name + "_" + f.size))
    const added = Array.from(fl).filter((f) => !existing.has(f.name + "_" + f.size))
    setInternalFiles((prev) => [...prev, ...added])
  }

  const handleRemoveFile = (i: number) => {
    if (isControlled) {
      controlledOnRemoveFile?.(i)
      return
    }
    setInternalFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  const resetAndClose = () => {
    onOpenChange(false)
    setStep("download")
    if (!isControlled) setInternalFiles([])
  }

  const handleDownload = async () => {
    if (controlledDownloading === undefined) setInternalDownloading(true)
    try { await onDownload() } finally {
      if (controlledDownloading === undefined) setInternalDownloading(false)
    }
  }

  const handleImport = async () => {
    if (files.length === 0) return
    if (controlledImporting === undefined) setInternalImporting(true)
    try {
      const ok = await onImport(files)
      if (ok) resetAndClose()
    } finally {
      if (controlledImporting === undefined) setInternalImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
                  {guideItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              </div>
              <Button className="w-full" size="lg" onClick={handleDownload} disabled={downloading}>
                <FileDown className="mr-2 h-5 w-5" />
                {downloading ? "下载中..." : downloadLabel}
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
                <p className="text-sm text-muted-foreground">{files.length > 0 ? "继续添加文件" : uploadHint}</p>
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
              {importing ? "导入中..." : importLabel(files.length)}
            </Button>
          )}
          {step === "upload" && <Button variant="ghost" size="sm" onClick={() => setStep("download")}>上一步</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
