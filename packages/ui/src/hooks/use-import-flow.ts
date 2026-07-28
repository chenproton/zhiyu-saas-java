"use client"

import { useState, useRef } from "react"
import { importExportApi } from "@zhiyu/api-client"
import { useToast } from "./use-toast"

type ImportEntityType = Parameters<typeof importExportApi.downloadTemplate>[0]

export interface UseImportFlowOptions {
  importType: ImportEntityType
  entityLabel: string
  templateFileName: string
  onSuccess: () => Promise<void> | void
}

export function useImportFlow({ importType, entityLabel, templateFileName, onSuccess }: UseImportFlowOptions) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [importPreview, setImportPreview] = useState<any>(null)

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0]
    if (file) setImportFile(file)
  }

  const executeImport = async (overwrite = false) => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const result = await importExportApi.importExcel(importType, importFile, overwrite)
      const errorHint = result.errors && result.errors.length > 0
        ? `，错误：${result.errors.slice(0, 3).join(";")}`
        : ""
      toast({
        title: "导入完成",
        description: `成功 ${result.created} 条，失败 ${result.failed || 0} 条，跳过 ${result.skipped || 0} 条${errorHint}`,
      })
      setImportFile(null)
      setImportPreview(null)
      await onSuccess()
      return true
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "导入失败" })
      return false
    } finally {
      setIsImporting(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const preview = await importExportApi.importExcelPreview(importType, importFile)
      if (preview.duplicates > 0) {
        setImportPreview(preview)
        setIsImporting(false)
        return
      }
      return await executeImport(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "导入失败" })
      setIsImporting(false)
      return false
    }
  }

  const handleDownloadTemplate = async () => {
    setIsDownloading(true)
    try {
      const res = await importExportApi.downloadTemplate(importType)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = templateFileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ variant: "destructive", title: "下载模板失败", description: err.message || "下载模板失败" })
    } finally {
      setIsDownloading(false)
    }
  }

  return {
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
  }
}
