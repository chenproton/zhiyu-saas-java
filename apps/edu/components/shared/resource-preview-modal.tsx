"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, X, FileText } from "lucide-react"
import type { TaskResource } from "@/lib/types"

function buildKkFileViewUrl(fileUrl: string): string {
  const origin = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : ""
  return `/kkfileview/onlinePreview?url=${btoa(`${origin}${fileUrl}`)}`
}

interface ResourcePreviewModalProps {
  resource: TaskResource | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResourcePreviewModal({ resource, open, onOpenChange }: ResourcePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col sm:max-w-4xl h-[85vh]">
        <DialogDescription className="sr-only">
          {resource?.name || "资源"} 的在线预览
        </DialogDescription>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base truncate">
            {resource?.name || "资源预览"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-100">
          {resource?.url ? (
            <iframe
              src={buildKkFileViewUrl(resource.url)}
              title={resource.name}
              className="w-full h-full border-0"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 h-full text-gray-400">
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
