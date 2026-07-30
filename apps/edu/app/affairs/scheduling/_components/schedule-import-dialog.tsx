"use client"

import { useEffect, useState } from "react"
import { Download, Upload, FileSpreadsheet } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ImportConfirmDialog } from "@/components/shared/import-confirm-dialog"
import { useImportFlow } from "@/hooks/use-import-flow"

interface ScheduleImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

/** 排课 Excel 导入：下载模板 → 上传 → 预览 → 确认导入（复用 useImportFlow 模式） */
export function ScheduleImportDialog({ open, onOpenChange, onImported }: ScheduleImportDialogProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const {
    fileInputRef,
    importFile,
    setImportFile,
    isImporting,
    isDownloading,
    importPreview,
    setImportPreview,
    handleFileSelect,
    handleImport,
    executeImport,
    handleDownloadTemplate,
  } = useImportFlow({
    importType: "schedules",
    entityLabel: "排课",
    templateFileName: "排课批量导入模板.xlsx",
    onSuccess: async () => {
      onOpenChange(false)
      onImported()
    },
  })

  useEffect(() => {
    if (importPreview) {
      (async () => { setConfirmOpen(true) })()
    }
  }, [importPreview])

  // 弹窗重新打开时在渲染期间重置已选文件（adjust-state-during-render 模式）
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setImportFile(null)
      setImportPreview(null)
    }
  }

  const doImport = async (overwrite: boolean) => {
    const ok = await executeImport(overwrite)
    if (ok) setConfirmOpen(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excel 导入排课</DialogTitle>
            <DialogDescription>
              下载模板填写后上传，系统将先预览校验（含冲突检测），确认后正式导入（草稿状态）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-md border border-dashed p-3">
              <div className="text-sm">
                <div className="font-medium">第一步：下载导入模板</div>
                <div className="text-xs text-muted-foreground">模板含填写说明，学期/班级/场地/场景需已存在</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={isDownloading}>
                <Download className="mr-1 size-4" />
                {isDownloading ? "下载中..." : "下载模板"}
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-md border border-dashed p-3">
              <div className="text-sm">
                <div className="font-medium">第二步：上传填写好的文件</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {importFile ? (
                    <>
                      <FileSpreadsheet className="size-3.5 text-green-600" />
                      <span className="text-foreground">{importFile.name}</span>
                    </>
                  ) : (
                    "支持 .xlsx 文件"
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                <Upload className="mr-1 size-4" />
                选择文件
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting}>
              {isImporting ? "导入中..." : "预览并导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importPreview && (
        <ImportConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          entityLabel="排课"
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => doImport(true)}
          onConfirmSkip={() => doImport(false)}
        />
      )}
    </>
  )
}
