"use client"

import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, X, FileText } from "lucide-react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  index?: number
}

const MIN_WIDTH = 320
const MIN_HEIGHT = 200
const OFFSET = 24

export function ResourcePreviewModal({ resource, open, onOpenChange, index = 0 }: ResourcePreviewModalProps) {
  const initialPosition = useMemo(() => ({ x: index * OFFSET, y: index * OFFSET }), [index])
  const [position, setPosition] = useState(initialPosition)
  const [dragging, setDragging] = useState(false)
  const [size, setSize] = useState<{ width?: number; height?: number }>({})
  const [resizing, setResizing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      setPosition(initialPosition)
      setSize({})
    }
  }, [open, initialPosition])

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

  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartRef.current.x
      const dy = e.clientY - resizeStartRef.current.y
      const maxWidth = typeof window !== "undefined" ? window.innerWidth - 32 : Infinity
      const maxHeight = typeof window !== "undefined" ? window.innerHeight - 32 : Infinity
      setSize({
        width: Math.max(MIN_WIDTH, Math.min(maxWidth, resizeStartRef.current.width + dx)),
        height: Math.max(MIN_HEIGHT, Math.min(maxHeight, resizeStartRef.current.height + dy)),
      })
    }
    const handleMouseUp = () => setResizing(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [resizing])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setResizing(true)
    const rect = contentRef.current?.getBoundingClientRect()
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: rect?.width || MIN_WIDTH,
      height: rect?.height || MIN_HEIGHT,
    }
  }, [])

  if (!open || !resource || !mounted) return null

  return createPortal(
    <div
      ref={contentRef}
      className={cn(
        "fixed top-[50%] left-[50%] flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-4xl h-[85vh] bg-background rounded-lg border p-3 shadow-none duration-200 group"
      )}
      style={{
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        width: size.width,
        height: size.height,
        zIndex: 50 + index,
      }}
    >
      <div
        className="shrink-0 flex flex-row items-center justify-between gap-4 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 text-base truncate font-semibold">
          {resource?.name || "资源预览"}
        </div>
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

      <div className="flex-1 min-h-0 mt-2 border rounded overflow-hidden bg-gray-100">
        {resource?.url ? (
          <iframe
            src={buildKkFileViewUrl(resource.url)}
            title={resource.name}
            className="w-full h-full border-0"
            allowFullScreen
            style={{ pointerEvents: dragging || resizing ? "none" : "auto" }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 h-full text-gray-400">
            <FileText className="h-10 w-10 opacity-40" />
            <span className="text-sm">暂无预览内容</span>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-1 right-1 z-10 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-muted-foreground" />
      </div>
    </div>,
    document.body
  )
}
