'use client'

import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, FileUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportConfirmDialog } from '@/components/shared/import-confirm-dialog'
import { useImportFlow } from '@/hooks/use-import-flow'

interface ScheduleImportBarProps {
  termId: string
  onImported: () => void
}

/**
 * 排课 Excel 导入（内联工具栏版）：
 * 「下载导入模板」直接导出当前学期数据（含参考表）作模板；
 * 「导入排课表」选择文件后内联展示文件名与「预览并导入」，有重复数据时弹确认框。
 */
export function ScheduleImportBar({ termId, onImported }: ScheduleImportBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const {
    fileInputRef,
    importFiles,
    setImportFiles,
    isImporting,
    isDownloading,
    importPreview,
    handleAddFiles,
    handleRemoveFile,
    handleImport,
    executeImport,
  } = useImportFlow({
    importType: 'schedules',
    entityLabel: '排课',
    templateFileName: '排课批量导入模板.xlsx',
    onSuccess: async () => {
      onImported()
    },
  })

  useEffect(() => {
    if (importPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmOpen(true)
    }
  }, [importPreview])

  // 下载当前学期教学计划数据（含参考表），编辑后回传导入
  const handleDownloadTemplate = async () => {
    const { authedFetch, downloadBlob } = await import('@zhiyu/api-client')
    const res = await authedFetch(`/affairs/schedules/export?termId=${encodeURIComponent(termId)}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    downloadBlob(await res.blob(), '排课导入模板.xlsx')
  }

  const doImport = async (mode: 'skip' | 'overwrite') => {
    const ok = await executeImport(mode)
    if (ok) setConfirmOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          disabled={isDownloading}
        >
          <Download className="mr-1 size-4" />
          {isDownloading ? '下载中...' : '下载导入模板'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          <FileUp className="mr-1 size-4" />
          导入排课表
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          multiple
          className="hidden"
          onChange={(e) => handleAddFiles(e.target.files)}
        />
      </div>

      {importFiles.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-white px-4 py-2">
          <FileSpreadsheet className="size-4 shrink-0 text-green-600" />
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
            {importFiles.map((f, idx) => (
              <span
                key={`${f.name}_${f.size}`}
                className="inline-flex max-w-[220px] items-center gap-1 truncate rounded bg-muted px-2 py-0.5 text-xs"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => handleRemoveFile(idx)}
                  aria-label="移除文件"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setImportFiles([])}
            disabled={isImporting}
          >
            取消
          </Button>
          <Button size="sm" className="h-7 px-3 text-xs" onClick={handleImport} disabled={isImporting}>
            {isImporting ? '导入中...' : '预览并导入'}
          </Button>
        </div>
      )}

      {importPreview && (
        <ImportConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          entityLabel="排课"
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => doImport('overwrite')}
          onConfirmSkip={() => doImport('skip')}
        />
      )}
    </>
  )
}
