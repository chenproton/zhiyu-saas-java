'use client'

import { useState } from 'react'
import { useToast } from '@zhiyu/ui'
import { authedFetch, downloadBlob } from '@zhiyu/api-client'
import type { ImportPreviewResult } from '@zhiyu/api-client'
import { importExportApi } from '@zhiyu/api-client'
import { ImportWizardDialog } from '@/components/shared/import-wizard-dialog'
import { ImportConfirmDialog } from '@/components/shared/import-confirm-dialog'
import { useT } from '@/lib/i18n/locale-provider'

interface ProgramCourseImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  onImported: () => void
}

export function ProgramCourseImportDialog({
  open,
  onOpenChange,
  programId,
  onImported,
}: ProgramCourseImportDialogProps) {
  const { toast } = useToast()
  const t = useT()
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const handleDownload = async () => {
    try {
      const res = await importExportApi.downloadTemplate('program-courses')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: t('模板下载失败'),
          description: data.error || t('下载失败（{status}）', { status: res.status }),
        })
        return
      }
      downloadBlob(await res.blob(), '方案课程批量导入模板.xlsx')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('模板下载失败'),
        description: err.message || t('下载失败（{status}）', { status: '?' }),
      })
    }
  }

  const doImport = async (files: File[], overwrite = false) => {
    const form = new FormData()
    files.forEach((f) => form.append('file', f))
    form.append('programId', programId)
    const res = await authedFetch(
      `/import/program-courses/excel?programId=${encodeURIComponent(programId)}&overwrite=${overwrite}`,
      { method: 'POST', body: form },
    )
    const data = await res.json()
    if (res.ok) {
      toast({
        title: t('导入成功'),
        description: `${t('共导入 {n} 门课程', { n: data.created || 0 })}${data.failed ? t('，{m} 条失败', { m: data.failed }) : ''}`,
      })
      onImported()
      return true
    } else {
      toast({
        variant: 'destructive',
        title: t('导入失败'),
        description: data.error || t('请检查文件格式'),
      })
      return false
    }
  }

  const handleImport = async (files: File[]) => {
    if (files.length === 0) return false
    try {
      const form = new FormData()
      files.forEach((f) => form.append('file', f))
      form.append('programId', programId)
      const previewRes = await authedFetch(
        `/import/program-courses/preview?programId=${encodeURIComponent(programId)}`,
        { method: 'POST', body: form },
      )
      if (!previewRes.ok) {
        // 预览失败时提示真实的服务端错误，不静默降级到直接导入
        const data = await previewRes.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: t('预览失败'),
          description: data.error || t('请检查文件格式'),
        })
        return false
      }
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
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('预览失败'),
        description: err.message || t('请检查文件格式'),
      })
      return false
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
        title={t('导入方案课程')}
        guideItems={[
          <>{t('点击下方按钮下载最新的导入模板')}</>,
          <>{t('参照模板中 Sheet 的填写说明，填入方案课程数据')}</>,
          <>{t('完成后点击"下一步"上传文件')}</>,
        ]}
        downloadLabel={t('下载方案课程批量导入模板')}
        onDownload={handleDownload}
        uploadHint={t('点击选择已填写的 Excel (.xlsx) 文件')}
        importLabel={(count) => t('开始导入（{n} 个文件）', { n: count })}
        onImport={handleImport}
      />
      {importPreview && (
        <ImportConfirmDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          entityLabel={t('方案课程')}
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
