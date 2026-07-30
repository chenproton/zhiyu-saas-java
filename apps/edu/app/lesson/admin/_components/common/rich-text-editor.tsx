"use client"

import { useState, useRef } from "react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image,
  Video,
  Table,
  Minus,
  Palette,
  Sparkles,
  Type,
  Heading1,
  Heading2,
  Upload,
  Trash2,
  Eye,
  File,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fileApi } from "@/lib/api"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  pdfUrl?: string | null
  onPdfChange?: (url: string | null) => void
  toast: any
}

const toolbarItems = [
  [{ icon: <Heading1 className="h-4 w-4" />, label: "H1" }, { icon: <Heading2 className="h-4 w-4" />, label: "H2" }],
  [{ icon: <Type className="h-4 w-4" />, label: "正文" }],
  [{ icon: <b className="text-xs">B</b>, label: "加粗" }, { icon: <i className="text-xs">I</i>, label: "斜体" }, { icon: <u className="text-xs">U</u>, label: "下划线" }, { icon: <Strikethrough className="h-4 w-4" />, label: "删除线" }],
  [{ icon: <AlignLeft className="h-4 w-4" />, label: "左对齐" }, { icon: <AlignCenter className="h-4 w-4" />, label: "居中" }, { icon: <AlignRight className="h-4 w-4" />, label: "右对齐" }],
  [{ icon: <List className="h-4 w-4" />, label: "无序列表" }, { icon: <ListOrdered className="h-4 w-4" />, label: "有序列表" }],
  [{ icon: <Quote className="h-4 w-4" />, label: "引用" }, { icon: <Code className="h-4 w-4" />, label: "代码" }],
  [{ icon: <LinkIcon className="h-4 w-4" />, label: "链接" }, { icon: <Image className="h-4 w-4" aria-label="图片" />, label: "图片" }, { icon: <Video className="h-4 w-4" />, label: "视频" }],
  [{ icon: <Table className="h-4 w-4" />, label: "表格" }, { icon: <Minus className="h-4 w-4" />, label: "分割线" }],
  [{ icon: <Palette className="h-4 w-4" />, label: "字体颜色" }, { icon: <Sparkles className="h-4 w-4" />, label: "背景色" }],
]

export function RichTextEditor({ value, onChange, placeholder, minHeight = 300, pdfUrl, onPdfChange, toast }: RichTextEditorProps) {
  const [mode, setMode] = useState<"rich_text" | "pdf">("rich_text")
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const pdfFileName = pdfUrl ? pdfUrl.split("/").pop() || pdfUrl : ""

  const handlePdfUpload = async (file: File) => {
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.error("请上传 PDF 文件")
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("文件大小超过 20MB")
      return
    }
    setPdfUploading(true)
    try {
      const res = await fileApi.upload(file)
      onPdfChange?.(res.url)
      toast.success("上传成功")
    } catch (err: any) {
      toast.error("上传失败", { description: err.message })
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
      <Tabs value={mode} onValueChange={(v) => setMode(v as "rich_text" | "pdf")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rich_text">自定义编辑</TabsTrigger>
          <TabsTrigger value="pdf">上传自定义文件</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "rich_text" ? (
        <div className="flex flex-col">
          <p className="text-xs text-gray-500 mb-2">可编写详细的学习目标，支持图文混排</p>
          <div
            className="border rounded-lg overflow-hidden flex flex-col"
            style={{ minHeight }}
          >
            <div className="bg-gray-50 border-b px-3 py-2 flex flex-wrap gap-1">
              {toolbarItems.map((group, gi) => (
                <div key={gi} className="flex items-center gap-0.5 mr-2">
                  {group.map((item, ii) => (
                    <Button
                      key={ii}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-600 hover:text-primary hover:bg-primary/5"
                      title={item.label}
                      onClick={() => {}}
                    >
                      {item.icon}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 flex-1 bg-white">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || defaultPlaceholder}
                className="border-0 min-h-full w-full focus-visible:ring-0 resize-none text-sm leading-relaxed"
                style={{ minHeight: minHeight - 100 }}
              />
            </div>
            <div className="bg-gray-50 border-t px-3 py-1.5 flex items-center justify-between text-xs text-gray-400">
              <span>纯文本模式</span>
              <span>{value.length} 字符</span>
            </div>
          </div>
          {value.includes("<img") || value.includes("<video") ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700 flex items-center gap-2">
              <Image className="h-4 w-4" aria-label="图片" />
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
                {pdfUploading ? <Loader2 className="h-8 w-8 text-gray-400 animate-spin" /> : <Upload className="h-8 w-8 text-gray-400" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">点击或拖拽上传课程说明书</p>
                <p className="text-xs text-gray-500 mt-1">支持 PDF 格式，最大 20MB</p>
              </div>
            </>
          )}
          {pdfUrl && (
            <div className="flex items-center gap-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
              <Button variant="outline" size="sm" onClick={() => setPdfPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" />预览
              </Button>
              <Button variant="outline" size="sm" disabled={pdfUploading} onClick={() => pdfInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />重新上传
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPdfChange?.(null)}>
                <Trash2 className="h-4 w-4 mr-1" />移除文件
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
              <span className="truncate">{pdfFileName || "文件预览"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-50">
            {pdfUrl ? (
              <iframe src={pdfUrl} title={pdfFileName || "PDF 预览"} className="w-full h-full" />
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
