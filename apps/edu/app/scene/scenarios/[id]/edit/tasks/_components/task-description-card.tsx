'use client'

import { useState, useRef } from 'react'
import {
  Eye,
  File,
  Image,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { fileApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'


interface TaskDescriptionCardProps {
  description: string
  onDescriptionChange: (v: string) => void
  descriptionPdf: string | null
  onDescriptionPdfChange: (v: string | null) => void
  toast: (opts: {
    title?: string
    description?: string
    variant?: 'default' | 'destructive'
  }) => void
}

export function TaskDescriptionCard({
  description,
  onDescriptionChange,
  descriptionPdf,
  onDescriptionPdfChange,
  toast,
}: TaskDescriptionCardProps) {
  const t = useT()
  const [descMode, setDescMode] = useState<'rich_text' | 'pdf'>('rich_text')
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const pdfFileName = descriptionPdf ? descriptionPdf.split('/').pop() || descriptionPdf : ''

  const handlePdfUpload = async (file: File) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast({ variant: 'destructive', title: t('请上传 PDF 文件') })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: t('文件大小超过 10MB') })
      return
    }
    setPdfUploading(true)
    try {
      const res = await fileApi.upload(file)
      onDescriptionPdfChange(res.url)
      toast({ title: t('上传成功') })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('上传失败'), description: err.message })
    } finally {
      setPdfUploading(false)
    }
  }

  const onPdfDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) handlePdfUpload(file)
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <Tabs value={descMode} onValueChange={(v) => setDescMode(v as 'rich_text' | 'pdf')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rich_text">{t('富文本编辑')}</TabsTrigger>
          <TabsTrigger value="pdf">{t('上传任务说明书')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {descMode === 'rich_text' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-xs text-gray-500 mb-2">{t('可编写详细的操作手册（当前为纯文本模式，支持 Markdown 语法）')}</p>
          <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-[450px]">
            <div className="p-4 flex-1 bg-white">
              <Textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder={t('任务描述\n\n你需要完成 [具体任务]。该任务基于 [背景/前提]，要求你 [核心动作]。执行时请注意 [关键约束]，确保理解需求后再开始。\n\n任务目标\n\n• 核心目标：[一句话概括最终成果]\n• 目标一：[具体子目标]\n• 目标二：[具体子目标]\n• 目标三：[具体子目标]\n• 成功标准：[任务完成的具体标志]\n\n任务结果\n\n请提交以下内容：\n\n• 主交付物：[如报告/代码/方案]\n• 格式要求：[如 Markdown/JSON/纯文本]\n• 附属说明：[假设、来源、取舍等]\n• 篇幅要求：[如不少于 500 字/代码 100 行内]\n\n测评要求\n\n• 准确性（30%）：内容正确，逻辑清晰，来源可靠\n• 完整性（25%）：覆盖所有子目标，无遗漏\n• 清晰度（20%）：结构分明，表达简洁\n• 实用性（15%）：结论可操作，建议可落地\n• 规范性（10%）：符合格式，术语统一，无明显错误\n\n一票否决项：若出现 [如抄袭/泄密/核心事实错误]，视为未通过。')}
                className="border-0 min-h-full w-full focus-visible:ring-0 resize-none text-sm leading-relaxed"
              />
            </div>
            <div className="bg-gray-50 border-t px-3 py-1.5 flex items-center justify-between text-xs text-gray-400">
              <span>{t('纯文本模式')}</span>
              <span>{t('{n} 字符', { n: description.length })}</span>
            </div>
          </div>
          {description.includes('<img') || description.includes('<video') ? (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-sm text-primary flex items-center gap-2 mt-2">
              <Image className="h-4 w-4" aria-label="image" />
              {t('检测到已插入多媒体内容')}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 space-y-4 cursor-pointer hover:border-primary/30 hover:bg-gray-50/50 transition-colors"
          onClick={() => !pdfUploading && pdfInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={onPdfDrop}
        >
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handlePdfUpload(file)
              e.target.value = ''
            }}
          />
          {descriptionPdf ? (
            <div className="text-center space-y-3 pointer-events-none">
              <div className="w-24 h-32 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center mx-auto">
                <File className="h-10 w-10 text-red-500 mb-2" />
                <span className="text-[10px] text-red-600 font-medium">PDF</span>
              </div>
              <p className="text-sm font-medium text-gray-700 max-w-xs truncate">{pdfFileName}</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                {pdfUploading ? (
                  <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  {t('点击或拖拽上传任务说明书')}
                </p>
                <p className="text-xs text-gray-500 mt-1">{t('支持 PDF 格式，最大 10MB')}</p>
              </div>
            </>
          )}
          {descriptionPdf && (
            <div
              className="flex items-center gap-2 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="outline" size="sm" type="button" onClick={() => setPdfPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" />
                {t('预览')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={pdfUploading}
                onClick={() => pdfInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                {t('重新上传')}
              </Button>
              <Button variant="outline" size="sm" type="button" onClick={() => onDescriptionPdfChange(null)}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('移除文件')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <File className="h-5 w-5 text-red-500" />
              <span className="truncate">{pdfFileName || t('任务说明书预览')}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-50">
            {descriptionPdf ? (
              <iframe
                src={descriptionPdf}
                title={pdfFileName || t('PDF 预览')}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {t('暂无文件')}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2">
            <Button variant="outline" onClick={() => setPdfPreviewOpen(false)}>
              {t('关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
