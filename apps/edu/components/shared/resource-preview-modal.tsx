"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, X, FileText } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
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
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 })
    }
  }, [open])

  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      })
    }
    const handleMouseUp = () => setDragging(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [dragging])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-transparent" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-[50%] left-[50%] z-50 flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-4xl h-[85vh] bg-background rounded-lg border p-6 shadow-none duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          style={{
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Description className="sr-only">
            {resource?.name || "资源"} 的在线预览
          </DialogPrimitive.Description>
          <div
            className="shrink-0 flex flex-row items-center justify-between gap-4 cursor-move select-none"
            onMouseDown={handleMouseDown}
          >
            <DialogPrimitive.Title className="flex items-center gap-2 text-base truncate font-semibold">
              {resource?.name || "资源预览"}
            </DialogPrimitive.Title>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} onMouseDown={(e) => e.stopPropagation()}>
                <X className="h-4 w-4 mr-1" />关闭
              </Button>
              {resource?.url && (
                <>
                  <Button variant="outline" size="sm" asChild onMouseDown={(e) => e.stopPropagation()}>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />新窗口打开
                    </a>
                  </Button>
                  <Button size="sm" asChild onMouseDown={(e) => e.stopPropagation()}>
                    <a href={resource.url} download={resource.name} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 mr-1" />下载
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 mt-4 border rounded-lg overflow-hidden bg-gray-100">
            {resource?.url ? (
              <iframe
                src={buildKkFileViewUrl(resource.url)}
                title={resource.name}
                className="w-full h-full border-0"
                allowFullScreen
                style={{ pointerEvents: dragging ? "none" : "auto" }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 h-full text-gray-400">
                <FileText className="h-10 w-10 opacity-40" />
                <span className="text-sm">暂无预览内容</span>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
