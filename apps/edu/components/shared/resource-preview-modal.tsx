"use client"

import { useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, X, FileText } from "lucide-react"
import type { TaskResource } from "@/lib/types"

function getFileExt(url: string): string {
  const name = url.split("/").pop() || ""
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot).toLowerCase() : ""
}

function buildKkFileViewUrl(fileUrl: string): string {
  const fullUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}${fileUrl}`
    : fileUrl
  const encoded = btoa(unescape(encodeURIComponent(fullUrl)))
  return `/kkfileview/onlinePreview?url=${encoded}`
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
    case ".doc": case ".docx":
    case ".ppt": case ".pptx":
    case ".xls": case ".xlsx":
      return (
        <iframe
          src={buildKkFileViewUrl(resource.url)}
          title={resource.name}
          className="w-full h-full border-0 rounded"
          allowFullScreen
        />
      )
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex flex-col ${isInline ? "sm:max-w-2xl" : "sm:max-w-4xl h-[85vh]"}`}
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
