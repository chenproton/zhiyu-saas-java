"use client"

import { useState, useRef } from "react"
import {
  Eye,
  File,
  Image,
  Loader2,
  Trash2,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Code,
  Minus,
  Link as LinkIcon,
  Table,
  Strikethrough,
  Palette,
  Sparkles,
  Type,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { fileApi } from "@/lib/api"

const toolbarItems = [
  [{ icon: <Heading1 className="h-4 w-4" />, label: "H1" }, { icon: <Heading2 className="h-4 w-4" />, label: "H2" }],
  [{ icon: <Type className="h-4 w-4" />, label: "正文" }],
  [{ icon: <b className="text-xs">B</b>, label: "加粗" }, { icon: <i className="text-xs">I</i>, label: "斜体" }, { icon: <u className="text-xs">U</u>, label: "下划线" }, { icon: <Strikethrough className="h-4 w-4" />, label: "删除线" }],
  [{ icon: <AlignLeft className="h-4 w-4" />, label: "左对齐" }, { icon: <AlignCenter className="h-4 w-4" />, label: "居中" }, { icon: <AlignRight className="h-4 w-4" />, label: "右对齐" }],
  [{ icon: <List className="h-4 w-4" />, label: "无序列表" }, { icon: <ListOrdered className="h-4 w-4" />, label: "有序列表" }],
  [{ icon: <Quote className="h-4 w-4" />, label: "引用" }, { icon: <Code className="h-4 w-4" />, label: "代码" }],
  [{ icon: <LinkIcon className="h-4 w-4" />, label: "链接" }, { icon: <Image className="h-4 w-4" />, label: "图片" }, { icon: <Video className="h-4 w-4" />, label: "视频" }],
  [{ icon: <Table className="h-4 w-4" />, label: "表格" }, { icon: <Minus className="h-4 w-4" />, label: "分割线" }],
  [{ icon: <Palette className="h-4 w-4" />, label: "字体颜色" }, { icon: <Sparkles className="h-4 w-4" />, label: "背景色" }],
]

interface TaskDescriptionCardProps {
  description: string
  onDescriptionChange: (v: string) => void
  descriptionPdf: string | null
  onDescriptionPdfChange: (v: string | null) => void
  toast: (opts: { title?: string; description?: string; variant?: "default" | "destructive" }) => void
}

export function TaskDescriptionCard({ description, onDescriptionChange, descriptionPdf, onDescriptionPdfChange, toast }: TaskDescriptionCardProps) {
  const [descMode, setDescMode] = useState<"rich_text" | "pdf">("rich_text")
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const pdfFileName = descriptionPdf ? descriptionPdf.split("/").pop() || descriptionPdf : ""

  const handlePdfUpload = async (file: File) => {
    if (!file) return
    if (file.type !== "application/pdf") {
      toast({ variant: "destructive", title: "请上传 PDF 文件" })
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ variant: "destructive", title: "文件大小超过 20MB" })
      return
    }
    setPdfUploading(true)
    try {
      const res = await fileApi.upload(file)
      onDescriptionPdfChange(res.url)
      toast({ title: "上传成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "上传失败", description: err.message })
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
      <Tabs value={descMode} onValueChange={v => setDescMode(v as "rich_text" | "pdf")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rich_text">富文本编辑</TabsTrigger>
          <TabsTrigger value="pdf">上传任务说明书</TabsTrigger>
        </TabsList>
      </Tabs>
      {descMode === "rich_text" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-xs text-gray-500 mb-2">可编写详细的操作手册，支持图文混排</p>
          <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-[450px]">
            <div className="bg-gray-50 border-b px-3 py-2 flex flex-wrap gap-1">
              {toolbarItems.map((group, gi) => (
                <div key={gi} className="flex items-center gap-0.5 mr-2">
                  {group.map((item, ii) => (
                    <Button key={ii} variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-600 hover:text-primary hover:bg-primary/5" title={item.label}>
                      {item.icon}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 flex-1 bg-white">
              <Textarea
                value={description}
                onChange={e => onDescriptionChange(e.target.value)}
                placeholder={`任务描述

你需要完成 [具体任务]。该任务基于 [背景/前提]，要求你 [核心动作]。执行时请注意 [关键约束]，确保理解需求后再开始。

任务目标

• 核心目标：[一句话概括最终成果]
• 目标一：[具体子目标]
• 目标二：[具体子目标]
• 目标三：[具体子目标]
• 成功标准：[任务完成的具体标志]

任务结果

请提交以下内容：

• 主交付物：[如报告/代码/方案]
• 格式要求：[如 Markdown/JSON/纯文本]
• 附属说明：[假设、来源、取舍等]
• 篇幅要求：[如不少于 500 字/代码 100 行内]

测评要求

• 准确性（30%）：内容正确，逻辑清晰，来源可靠
• 完整性（25%）：覆盖所有子目标，无遗漏
• 清晰度（20%）：结构分明，表达简洁
• 实用性（15%）：结论可操作，建议可落地
• 规范性（10%）：符合格式，术语统一，无明显错误

一票否决项：若出现 [如抄袭/泄密/核心事实错误]，视为未通过。`}
                className="border-0 min-h-full w-full focus-visible:ring-0 resize-none text-sm leading-relaxed"
              />
            </div>
            <div className="bg-gray-50 border-t px-3 py-1.5 flex items-center justify-between text-xs text-gray-400">
              <span>纯文本模式</span>
              <span>{description.length} 字符</span>
            </div>
          </div>
          {description.includes("<img") || description.includes("<video") ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700 flex items-center gap-2 mt-2">
              <Image className="h-4 w-4" />
              检测到已插入多媒体内容
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 space-y-4 cursor-pointer hover:border-primary/30 hover:bg-gray-50/50 transition-colors"
          onClick={() => !pdfUploading && pdfInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={onPdfDrop}
        >
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handlePdfUpload(file)
              e.target.value = ""
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
                {pdfUploading ? <Loader2 className="h-8 w-8 text-gray-400 animate-spin" /> : <Upload className="h-8 w-8 text-gray-400" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">点击或拖拽上传任务说明书</p>
                <p className="text-xs text-gray-500 mt-1">支持 PDF 格式，最大 20MB</p>
              </div>
            </>
          )}
          {descriptionPdf && (
            <div className="flex items-center gap-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
              <Button variant="outline" size="sm" onClick={() => setPdfPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" />预览
              </Button>
              <Button variant="outline" size="sm" disabled={pdfUploading} onClick={() => pdfInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />重新上传
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDescriptionPdfChange(null)}>
                <Trash2 className="h-4 w-4 mr-1" />移除文件
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
              <span className="truncate">{pdfFileName || "任务说明书预览"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-50">
            {descriptionPdf ? (
              <iframe
                src={descriptionPdf}
                title={pdfFileName || "PDF 预览"}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">暂无文件</div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2">
            <Button variant="outline" onClick={() => setPdfPreviewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
