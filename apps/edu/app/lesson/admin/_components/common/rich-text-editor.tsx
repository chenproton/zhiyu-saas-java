"use client"

import { useState } from "react"
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
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

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

export function RichTextEditor({ value, onChange, placeholder, minHeight = 300 }: RichTextEditorProps) {
  const [mode, setMode] = useState<"rich_text" | "pdf">("rich_text")
  const [pdfName, setPdfName] = useState<string | null>(null)

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
            {/* Toolbar */}
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
                      onClick={() => {
                        // Mock toolbar action - in real app would format text
                      
                      }}
                    >
                      {item.icon}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
            {/* Editor Area */}
            <div className="p-4 flex-1 bg-white">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || defaultPlaceholder}
                className="border-0 min-h-full w-full focus-visible:ring-0 resize-none text-sm leading-relaxed"
                style={{ minHeight: minHeight - 100 }}
              />
            </div>
            {/* Status Bar */}
            <div className="bg-gray-50 border-t px-3 py-1.5 flex items-center justify-between text-xs text-gray-400">
              <span>纯文本模式</span>
              <span>{value.length} 字符</span>
            </div>
          </div>
          {value.includes("<img") || value.includes("<video") ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700 flex items-center gap-2">
              <Image className="h-4 w-4" />
              检测到已插入多媒体内容
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 space-y-4">
          {pdfName ? (
            <div className="text-center space-y-3">
              <div className="w-24 h-32 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center mx-auto">
                <FileText className="h-10 w-10 text-red-500 mb-2" />
                <span className="text-[10px] text-red-600 font-medium">PDF</span>
              </div>
              <p className="text-sm font-medium text-gray-700">{pdfName}</p>
              <Button variant="outline" size="sm" onClick={() => setPdfName(null)}>
                <Trash2 className="h-4 w-4 mr-1" />移除文件
              </Button>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">点击或拖拽上传课程说明书</p>
                <p className="text-xs text-gray-500 mt-1">支持 PDF 格式，最大 20MB</p>
              </div>
              <Button variant="outline" size="sm" disabled>
                <Upload className="h-4 w-4 mr-1" />上传文件
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
