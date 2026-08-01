"use client"

import { useToast } from "@zhiyu/ui"
import { importExportApi, downloadBlob } from "@zhiyu/api-client"
import { ImportWizardDialog } from "@/components/shared/import-wizard-dialog"

interface AffairsConfigImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function AffairsConfigImportDialog({ open, onOpenChange, onImported }: AffairsConfigImportDialogProps) {
  const { toast } = useToast()

  const handleDownload = async () => {
    const res = await importExportApi.downloadTemplate("affairs-config" as any)
    downloadBlob(await res.blob(), "教务配置批量导入模板.xlsx")
  }

  const handleImport = async (files: File[]) => {
    if (files.length === 0) return false
    try {
      const data = await importExportApi.importExcel("affairs-config" as any, files[0])
      toast({
        title: "导入完成",
        description: `学期 ${(data as any).termsCreated || 0}${(data as any).termsSkipped ? `（跳过${(data as any).termsSkipped}）` : ""} · 场地 ${(data as any).venuesCreated || 0}${(data as any).venuesSkipped ? `（跳过${(data as any).venuesSkipped}）` : ""} · 节次 ${(data as any).periodSlotsCreated || 0}${(data as any).periodSlotsSkipped ? `（跳过${(data as any).periodSlotsSkipped}）` : ""}`,
      })
      onImported()
      return true
    } catch (err: any) {
      toast({ variant: "destructive", title: "导入失败", description: err.message || "请检查文件格式" })
      return false
    }
  }

  return (
    <ImportWizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title="导入教务配置"
      guideItems={[
        <>Excel 包含三个 Sheet：学期、场地、节次</>,
        <>按各 Sheet 表头填写对应数据</>,
        <>点击下方按钮下载模板</>,
      ]}
      downloadLabel="下载教务配置批量导入模板"
      onDownload={handleDownload}
      uploadHint="点击选择已填写的 Excel 文件"
      importLabel={() => "开始导入"}
      onImport={handleImport}
    />
  )
}
