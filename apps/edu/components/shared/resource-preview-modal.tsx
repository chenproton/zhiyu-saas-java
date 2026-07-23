"use client"

import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, X, FileText } from "lucide-react"
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react"
import { cn } from "@/lib/utils"
import type { TaskResource } from "@/lib/types"

const MIN_WIDTH = 320
const MIN_HEIGHT = 200
const OFFSET = 24
const MAX_OPEN_MODALS = 5

let globalZIndexCounter = 100

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

function ResourcePreviewModalInner({ resource, open, onOpenChange, index = 0 }: ResourcePreviewModalProps) {
  const initialPosition = useMemo(() => ({ x: index * OFFSET, y: index * OFFSET }), [index])
  const [position, setPosition] = useState(initialPosition)
  const [size, setSize] = useState<{ width?: number; height?: number }>({})
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [mounted, setMounted] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const positionRef = useRef(initialPosition)
  const sizeRef = useRef<{ width?: number; height?: number }>({})
  const zIndexRef = useRef(0)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT })
  const applyLayoutRef = useRef<() => void>(() => {})
  const bringToFrontRef = useRef<() => void>(() => {})

  applyLayoutRef.current = () => {
    const el = contentRef.current
    if (!el) return
    el.style.transform = `translate3d(calc(-50% + ${positionRef.current.x}px), calc(-50% + ${positionRef.current.y}px), 0)`
    el.style.width = sizeRef.current.width ? `${sizeRef.current.width}px` : ""
    el.style.height = sizeRef.current.height ? `${sizeRef.current.height}px` : ""
    el.style.zIndex = String(zIndexRef.current)
  }

  bringToFrontRef.current = () => {
    zIndexRef.current = ++globalZIndexCounter
    applyLayoutRef.current()
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      positionRef.current = initialPosition
      sizeRef.current = {}
      setPosition(initialPosition)
      setSize({})
      if (zIndexRef.current === 0) {
        zIndexRef.current = ++globalZIndexCounter
      }
      applyLayoutRef.current()
    }
  }, [open, initialPosition])

  useEffect(() => {
    if (!dragging) return
    const iframe = iframeRef.current
    if (iframe) iframe.style.pointerEvents = "none"
    document.body.classList.add("select-none")

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      positionRef.current = {
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      }
      applyLayoutRef.current()
    }
    const handleMouseUp = () => {
      setDragging(false)
      setPosition(positionRef.current)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      if (iframe) iframe.style.pointerEvents = ""
      document.body.classList.remove("select-none")
    }
  }, [dragging])

  useEffect(() => {
    if (!resizing) return
    const iframe = iframeRef.current
    if (iframe) iframe.style.pointerEvents = "none"
    const maxWidth = typeof window !== "undefined" ? window.innerWidth - 32 : Infinity
    const maxHeight = typeof window !== "undefined" ? window.innerHeight - 32 : Infinity

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartRef.current.x
      const dy = e.clientY - resizeStartRef.current.y
      sizeRef.current = {
        width: Math.max(MIN_WIDTH, Math.min(maxWidth, resizeStartRef.current.width + dx)),
        height: Math.max(MIN_HEIGHT, Math.min(maxHeight, resizeStartRef.current.height + dy)),
      }
      applyLayoutRef.current()
    }
    const handleMouseUp = () => {
      setResizing(false)
      setSize(sizeRef.current)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      if (iframe) iframe.style.pointerEvents = ""
    }
  }, [resizing])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    bringToFrontRef.current()
    setDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: positionRef.current.x,
      posY: positionRef.current.y,
    }
  }, [])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    bringToFrontRef.current()
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
        "fixed top-1/2 left-1/2 flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-4xl h-[85vh] bg-background rounded-lg border p-3 shadow-none group",
        "contain-[layout_style_paint]",
        (dragging || resizing) && "will-change-transform"
      )}
      style={{
        transform: `translate3d(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px), 0)`,
        width: size.width,
        height: size.height,
        zIndex: zIndexRef.current,
      }}
      onMouseDown={() => bringToFrontRef.current()}
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
            ref={iframeRef}
            src={buildKkFileViewUrl(resource.url)}
            title={resource.name}
            className="w-full h-full border-0"
            allowFullScreen
            loading="lazy"
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

export const ResourcePreviewModal = memo(ResourcePreviewModalInner)

export function usePreviewResources(max = MAX_OPEN_MODALS) {
  const [previewResources, setPreviewResources] = useState<TaskResource[]>([])

  const addPreviewResource = useCallback(
    (resource: TaskResource) => {
      setPreviewResources((prev) => {
        if (prev.some((r) => r.id === resource.id)) return prev
        const next = [...prev, resource]
        if (next.length > max) next.shift()
        return next
      })
    },
    [max]
  )

  const removePreviewResource = useCallback((id: string) => {
    setPreviewResources((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return [previewResources, addPreviewResource, removePreviewResource] as const
}
