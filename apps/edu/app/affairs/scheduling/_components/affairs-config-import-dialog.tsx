'use client'

import { useToast } from '@zhiyu/ui'
import { importExportApi, downloadBlob } from '@zhiyu/api-client'
import { ImportWizardDialog } from '@/components/shared/import-wizard-dialog'
import { useT } from '@/lib/i18n/locale-provider'

interface AffairsConfigImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function AffairsConfigImportDialog({
  open,
  onOpenChange,
  onImported,
}: AffairsConfigImportDialogProps) {
  const { toast } = useToast()
  const t = useT()

  const handleDownload = async () => {
    const res = await importExportApi.downloadTemplate('affairs-config' as any)
    downloadBlob(await res.blob(), '教务配置批量导入模板.xlsx')
  }

  const handleImport = async (files: File[]) => {
    if (files.length === 0) return false
    try {
      const data = await importExportApi.importExcel('affairs-config' as any, files[0])
      toast({
        title: t('导入完成'),
        description: t('学期 {n}{skip} · 场地 {m}{skip2} · 节次 {k}{skip3}', {
          n: (data as any).termsCreated || 0,
          skip: (data as any).termsSkipped ? t('（跳过{n}）', { n: (data as any).termsSkipped }) : '',
          m: (data as any).venuesCreated || 0,
          skip2: (data as any).venuesSkipped ? t('（跳过{n}）', { n: (data as any).venuesSkipped }) : '',
          k: (data as any).periodSlotsCreated || 0,
          skip3: (data as any).periodSlotsSkipped ? t('（跳过{n}）', { n: (data as any).periodSlotsSkipped }) : '',
        }),
      })
      onImported()
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导入失败'),
        description: err.message || t('请检查文件格式'),
      })
      return false
    }
  }

  return (
    <ImportWizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('导入教务配置')}
      guideItems={[
        <>{t('Excel 包含三个 Sheet：学期、场地、节次')}</>,
        <>{t('按各 Sheet 表头填写对应数据')}</>,
        <>{t('节次 Sheet 可填写时段类型（早自习/上午/下午/晚自习），不填时按排序自动识别（0-3 上午、4-7 下午、8+ 晚自习）')}</>,
        <>{t('点击下方按钮下载模板')}</>,
      ]}
      downloadLabel={t('下载教务配置批量导入模板')}
      onDownload={handleDownload}
      uploadHint={t('点击选择已填写的 Excel 文件')}
      importLabel={() => t('开始导入')}
      onImport={handleImport}
    />
  )
}
