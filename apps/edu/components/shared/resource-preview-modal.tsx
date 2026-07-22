"use client"

import { useEffect, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, X, FileText, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { getToken } from "@/lib/api"
import type { TaskResource } from "@/lib/types"

function getFileExt(url: string): string {
  const name = url.split("/").pop() || ""
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot).toLowerCase() : ""
}

type ConvertResult = { html?: string; images?: string[] }
type OverlayFn = (msg: string) => void

async function convertViaServer(fileUrl: string, format: string): Promise<ConvertResult> {
  const filename = fileUrl.split("/").pop() || ""
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`/api/v1/files/preview?name=${encodeURIComponent(filename)}&format=${format}`, { headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).error || `转换失败 (${res.status})`)
  }
  const data = await res.json()
  return data as ConvertResult
}

function SlideViewer({ images, resource }: { images: string[]; resource: TaskResource }) {
  const [idx, setIdx] = useState(0)
  const prev = useCallback(() => setIdx((i) => (i > 0 ? i - 1 : images.length - 1)), [images.length])
  const next = useCallback(() => setIdx((i) => (i < images.length - 1 ? i + 1 : 0)), [images.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev()
      else if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [prev, next])

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <img
          src={`data:image/png;base64,${images[idx]}`}
          alt={`slide ${idx + 1}`}
          className="max-w-full max-h-full object-contain rounded shadow-2xl"
        />
      </div>
      <div className="shrink-0 flex items-center justify-center gap-3 py-3 bg-gray-900/90 border-t border-white/10">
        <Button variant="ghost" size="sm" onClick={prev} className="text-gray-400 hover:text-white">
          <ChevronLeft className="h-4 w-4 mr-1" />上一页
        </Button>
        <span className="text-xs text-gray-400 select-none">
          {idx + 1} / {images.length}
        </span>
        <Button variant="ghost" size="sm" onClick={next} className="text-gray-400 hover:text-white">
          下一页<ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function OfficePreview({ resource }: { resource: TaskResource }) {
  const [html, setHtml] = useState<string | null>(null)
  const [slideImages, setSlideImages] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState("正在加载预览...")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = resource?.url
    if (!url) return
    const ext = getFileExt(url)
    setLoading(true)
    setError(null)
    setHtml(null)
    setSlideImages(null)

    if (ext === ".ppt") {
      setLoadingMsg("正在转换幻灯片...")
      convertViaServer(url, "png")
        .then((r) => {
          if (!r.images?.length) throw new Error("转换后无内容")
          setSlideImages(r.images)
        })
        .catch((e) => setError(e.message || "转换失败"))
        .finally(() => setLoading(false))
      return
    }

    const load = async () => {
      try {
        const fileRes = await fetch(url, { credentials: "include" })
        if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`)
        const buffer = await fileRes.arrayBuffer()
        if (buffer.byteLength === 0) throw new Error("文件为空")

        if (ext === ".pptx") {
          setLoadingMsg("正在解析幻灯片...")
          const { init } = await import("pptx-preview")
          const container = document.createElement("div")
          container.style.cssText = "width:100%;height:100%;overflow:auto;background:#fff"
          const previewer = init(container, { mode: "slide" })
          await (previewer as any).preview(buffer)
          const slides = container.querySelectorAll(".slide")
          slides.forEach((s: any) => { s.style.width = "100%"; s.style.maxWidth = "100%" })
          setHtml(container.innerHTML)
          return
        }

        if (ext === ".docx") {
          setLoadingMsg("正在解析文档...")
          const mammoth = (await import("mammoth")).default
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          setHtml(result.value)
          return
        }

        if (ext === ".xlsx" || ext === ".xls") {
          setLoadingMsg("正在解析表格...")
          const XLSX = await import("xlsx")
          const workbook = XLSX.read(buffer, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          if (!sheetName) throw new Error("表格中没有找到工作表")
          setHtml(XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { id: "", editable: false }))
          return
        }

        if (ext === ".doc") {
          setLoadingMsg("正在转换文档...")
          const r = await convertViaServer(url, "html")
          if (r.html) setHtml(r.html)
          return
        }

        throw new Error("不支持的文件格式")
      } catch (err: any) {
        if (ext === ".xlsx" || ext === ".xls") {
          try {
            setLoadingMsg("客户端解析失败，尝试服务端转换...")
            const r = await convertViaServer(url, "html")
            if (r.html) { setHtml(r.html); return }
          } catch {}
        }
        setError(err.message || "加载失败")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [resource?.url])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="h-10 w-10 animate-spin" />
        <span className="text-sm">{loadingMsg}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <span className="text-sm text-gray-500 font-medium">预览失败</span>
        <span className="text-xs text-gray-400 max-w-md">{error}</span>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" asChild>
            <a href={resource.url!} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />新窗口打开
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href={resource.url!} download={resource.name}>
              <Download className="h-3.5 w-3.5 mr-1" />下载文件
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (slideImages) {
    return <SlideViewer images={slideImages} resource={resource} />
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
  const ext = getFileExt(resource.url)

  switch (ext) {
    case ".jpg": case ".jpeg": case ".png": case ".gif": case ".webp": case ".svg": case ".bmp":
      return <img src={resource.url} alt={resource.name} className="max-w-full max-h-full object-contain rounded" />
    case ".mp4": case ".webm": case ".mov": case ".avi": case ".mkv":
      return <video controls src={resource.url} className="max-w-full max-h-full rounded" />
    case ".mp3": case ".wav": case ".ogg":
      return <audio controls src={resource.url} className="w-full" />
    case ".pdf":
      return <iframe src={resource.url} title={resource.name} className="w-full h-full border-0 rounded" />
    case ".doc": case ".docx": case ".ppt": case ".pptx": case ".xls": case ".xlsx":
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
  const isInline = resource ? [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp3", ".wav"].includes(getFileExt(resource.url || "")) : false
  const isOffice = resource ? [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"].includes(getFileExt(resource.url || "")) : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex flex-col ${isInline ? "sm:max-w-2xl" : isOffice ? "sm:max-w-4xl h-[85vh]" : "sm:max-w-4xl h-[85vh]"}`}
      >
        <DialogDescription className="sr-only">
          {resource?.name || "资源"} 的在线预览
        </DialogDescription>
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
