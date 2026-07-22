"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, X, FileText, Loader2 } from "lucide-react"
import type { TaskResource } from "@/lib/types"

function OfficePreview({ resource }: { resource: TaskResource }) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!resource?.url) return
    setLoading(true)
    setError(null)
    setHtml(null)

    fetch(resource.url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then(async (buffer) => {
        if (resource.type === "document") {
          const mammoth = (await import("mammoth")).default
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          setHtml(result.value)
        } else if (resource.type === "spreadsheet") {
          const XLSX = await import("xlsx")
          const workbook = XLSX.read(buffer, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          if (!sheetName) throw new Error("无法读取表格数据")
          setHtml(XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { id: "", editable: false }))
        } else {
          throw new Error("不支持的类型")
        }
      })
      .catch((err) => {
        setError(err.message || "加载失败")
      })
      .finally(() => setLoading(false))
  }, [resource?.url, resource?.type])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="h-10 w-10 animate-spin" />
        <span className="text-sm">正在加载预览...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <FileText className="h-10 w-10 opacity-40" />
        <span className="text-sm">无法加载预览</span>
        <span className="text-xs text-gray-400">{error}</span>
      </div>
    )
  }

  if (!html) return null

  return (
    <div className="w-full h-full overflow-auto bg-white p-6">
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function renderPreviewContent(resource: TaskResource) {
  if (!resource?.url) return null

  switch (resource.type) {
    case "image":
      return <img src={resource.url} alt={resource.name} className="max-w-full max-h-full object-contain rounded" />
    case "video":
      return <video controls src={resource.url} className="max-w-full max-h-full rounded" />
    case "audio":
      return <audio controls src={resource.url} className="w-full" />
    case "document":
    case "spreadsheet":
      return <OfficePreview resource={resource} />
    default:
      return <iframe src={resource.url} title={resource.name} className="w-full h-full border-0 rounded" />
  }
}

interface ResourcePreviewModalProps {
  resource: TaskResource | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResourcePreviewModal({ resource, open, onOpenChange }: ResourcePreviewModalProps) {
  const isInline = resource ? ["image", "audio", "video"].includes(resource.type) : false
  const needsWide = resource ? ["document", "spreadsheet"].includes(resource.type) : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex flex-col ${isInline ? "sm:max-w-2xl" : needsWide ? "sm:max-w-4xl h-[85vh]" : "sm:max-w-4xl h-[85vh]"}`}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base truncate">
            {resource?.name || "资源预览"}
          </DialogTitle>
        </DialogHeader>

        <div className={`flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center ${isInline ? "p-4" : ""}`}>
          {resource?.url ? (
            renderPreviewContent(resource)
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <FileText className="h-10 w-10 opacity-40" />
              <span className="text-sm">暂无预览内容</span>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />关闭
          </Button>
          {resource?.url && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={resource.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />新窗口打开
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={resource.url} download={resource.name} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-1" />下载
                </a>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
