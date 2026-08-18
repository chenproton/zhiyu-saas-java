'use client'

import { useState, useRef } from 'react'
import { Upload, Trash2, Eye, File, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fileApi } from '@/lib/api'
import { toast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  pdfUrl?: string | null
  onPdfChange?: (url: string | null) => void
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 300,
  pdfUrl,
  onPdfChange,
}: RichTextEditorProps) {
  const t = useT()
  const [mode, setMode] = useState<'rich_text' | 'pdf'>('rich_text')
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const pdfFileName = pdfUrl ? pdfUrl.split('/').pop() || pdfUrl : ''

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
      onPdfChange?.(res.url)
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

  const defaultPlaceholder = `课程目标

学生通过本课程学习，将能够：

• 掌握 [核心知识点/技能] 的基本概念与原理
• 能够独立完成 [具体任务/操作]
• 理解 [相关理论/方法] 的适用场景与局限性
• 具备 [某种能力/素养]

学习要求

• 课前预习：[预习材料/视频]
• 课堂参与：积极参与讨论与练习
• 课后作业：按时完成并提交
• 考核方式：[测验/项目/考试]

评价标准

• 知识掌握（40%）：理解核心概念，能正确运用
• 实践能力（30%）：能独立完成操作任务
• 团队协作（15%）：积极参与小组活动
• 创新思维（15%）：能提出有见地的问题或方案`

  return (
    <div className="space-y-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'rich_text' | 'pdf')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rich_text">{t('自定义编辑')}</TabsTrigger>
          <TabsTrigger value="pdf">{t('上传自定义文件')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'rich_text' ? (
        <div className="flex flex-col">
          <p className="text-xs text-gray-500 mb-2">{t('可编写详细的学习目标（纯文本）')}</p>
          <div className="border rounded-lg overflow-hidden flex flex-col" style={{ minHeight }}>
            <div className="p-4 flex-1 bg-white">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || t(defaultPlaceholder)}
                className="border-0 min-h-full w-full focus-visible:ring-0 resize-none text-sm leading-relaxed"
                style={{ minHeight: minHeight - 40 }}
              />
            </div>
            <div className="bg-gray-50 border-t px-3 py-1.5 flex items-center justify-between text-xs text-gray-400">
              <span>{t('纯文本模式')}</span>
              <span>{t('{n} 字符', { n: value.length })}</span>
            </div>
          </div>
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
          {pdfUrl ? (
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
                <p className="text-sm font-medium text-gray-700">{t('点击或拖拽上传课程说明书')}</p>
                <p className="text-xs text-gray-500 mt-1">{t('支持 PDF 格式，最大 10MB')}</p>
              </div>
            </>
          )}
          {pdfUrl && (
            <div
              className="flex items-center gap-2 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="outline" size="sm" onClick={() => setPdfPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" />
                {t('预览')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pdfUploading}
                onClick={() => pdfInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                {t('重新上传')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPdfChange?.(null)}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('移除文件')}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <File className="h-5 w-5 text-red-500" />
              <span className="truncate">{pdfFileName || t('文件预览')}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-50">
            {pdfUrl ? (
              <iframe src={pdfUrl} title={pdfFileName || t('PDF 预览')} className="w-full h-full" />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">{t('暂无文件')}</div>
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
