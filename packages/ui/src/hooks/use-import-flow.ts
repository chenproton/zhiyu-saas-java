'use client'

import { useState, useRef, useCallback } from 'react'
import { importExportApi, downloadBlob, type ImportPreviewResult } from '@zhiyu/api-client'
import { useToast } from './use-toast'

type ImportEntityType = Parameters<typeof importExportApi.downloadTemplate>[0]

export interface UseImportFlowOptions {
  importType: ImportEntityType
  entityLabel: string
  templateFileName: string
  onSuccess: () => Promise<void> | void
}

export function useImportFlow({ importType, templateFileName, onSuccess }: UseImportFlowOptions) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importFiles, setImportFiles] = useState<File[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)

  const handleAddFiles = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      setImportFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name + '_' + f.size))
        const newFiles = Array.from(files).filter((f) => !existingNames.has(f.name + '_' + f.size))
        return [...prev, ...newFiles]
      })
    }
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setImportFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleClearFiles = useCallback(() => {
    setImportFiles([])
  }, [])

  const executeImport = async (mode: 'skip' | 'overwrite' | 'new' = 'skip') => {
    if (importFiles.length === 0) return
    setIsImporting(true)
    try {
      const result = await importExportApi.importExcel(
        importType,
        importFiles,
        mode === 'overwrite',
        mode === 'new',
      )
      const errorHint =
        result.errors && result.errors.length > 0
          ? `，错误：${result.errors.slice(0, 3).join(';')}`
          : ''
      const permissionHint =
        result.permissionSkipped && result.permissionSkipped > 0
          ? `，${result.permissionSkipped} 个资源非本人创建/未参与共建，已跳过覆盖`
          : ''
      toast({
        title: '导入完成',
        description: `成功 ${result.created} 条，失败 ${result.failed || 0} 条，跳过 ${result.skipped || 0} 条${permissionHint}${errorHint}`,
      })
      setImportFiles([])
      setImportPreview(null)
      await onSuccess()
      return true
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: '导入失败',
        description: err instanceof Error ? err.message : '导入失败',
      })
      return false
    } finally {
      setIsImporting(false)
    }
  }

  const handleImport = async () => {
    if (importFiles.length === 0) return
    setIsImporting(true)
    try {
      const preview = await importExportApi.importExcelPreview(importType, importFiles)
      if (preview.duplicates > 0) {
        setImportPreview(preview)
        setIsImporting(false)
        return
      }
      return await executeImport('skip')
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: '导入失败',
        description: err instanceof Error ? err.message : '导入失败',
      })
      setIsImporting(false)
      return false
    }
  }

  const handleDownloadTemplate = async () => {
    setIsDownloading(true)
    try {
      const res = await importExportApi.downloadTemplate(importType)
      downloadBlob(await res.blob(), templateFileName)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: '下载模板失败',
        description: err instanceof Error ? err.message : '下载模板失败',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return {
    fileInputRef,
    importFiles,
    setImportFiles,
    isImporting,
    isDownloading,
    importPreview,
    setImportPreview,
    handleAddFiles,
    handleRemoveFile,
    handleClearFiles,
    handleImport,
    executeImport,
    handleDownloadTemplate,
  }
}
