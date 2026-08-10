'use client'

import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { DialogBranch } from '@/components/ui/dialog'
import { ExternalLink, X, FileText } from 'lucide-react'
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { cn } from '@/lib/utils'
import { fileApi } from '@zhiyu/api-client'
import type { TaskResource } from '@/lib/types'
import { isSafeExternalUrl } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import ZipPreview, { isZipUrl } from '@/components/shared/zip-preview'

const MIN_WIDTH = 320
const MIN_HEIGHT = 200
const OFFSET = 24
const MAX_OPEN_MODALS = 5
const BASE_Z_INDEX = 100

// 从 DOM 中取当前打开弹窗的最大 z-index 并 +1。
// 弹窗关闭即从 DOM 移除，计数器随之自然回落，无需模块级可变状态。
function nextZIndex(): number {
  if (typeof document === 'undefined') return BASE_Z_INDEX
  let max = BASE_Z_INDEX
  document.querySelectorAll<HTMLElement>('[data-resource-preview]').forEach((el) => {
    const z = parseInt(el.style.zIndex || '0', 10)
    if (z > max) max = z
  })
  return max + 1
}

function buildKkFileViewUrl(fileUrl: string): string {
  const origin =
    typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : ''
  return `/kkfileview/onlinePreview?url=${btoa(`${origin}${fileUrl}`)}`
}

// 仅在文件路径位于本系统上传区时生成签名 URL（kkFileView 服务端抓取无登录态，
// 需短时签名放行）；外链/第三方 URL 保持原样直通
function mayNeedSignUrl(fileUrl: string): boolean {
  return fileUrl.startsWith('/uploads/')
}

interface ResourcePreviewModalProps {
  resource: TaskResource | null
  open: boolean
  onOpenChange: (open: boolean) => void
  index?: number
  /** 是否渲染全屏点击关闭遮罩；设为 false 时可与页面及其他弹窗同时交互 */
  backdrop?: boolean
}

function ResourcePreviewModalInner({
  resource,
  open,
  onOpenChange,
  index = 0,
  backdrop = true,
}: ResourcePreviewModalProps) {
  const t = useT()
  const initialPosition = useMemo(() => ({ x: index * OFFSET, y: index * OFFSET }), [index])
  const [position, setPosition] = useState(initialPosition)
  const [size, setSize] = useState<{ width?: number; height?: number }>({})
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [zIndex, setZIndex] = useState(0)
  // kkFileView 预览地址：本系统上传文件先换取短时签名 URL，否则直接用原 URL；
  // previewFor 记录签名结果对应的资源，避免新资源打开瞬间渲染旧资源
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewFor, setPreviewFor] = useState<string>('')

  const contentRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const positionRef = useRef(initialPosition)
  const sizeRef = useRef<{ width?: number; height?: number }>({})
  const zIndexRef = useRef(0)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT })
  const applyLayoutRef = useRef<() => void>(() => {})
  const bringToFrontRef = useRef<() => void>(() => {})

  useEffect(() => {
    applyLayoutRef.current = () => {
      const el = contentRef.current
      if (!el) return
      el.style.transform = `translate3d(calc(-50% + ${positionRef.current.x}px), calc(-50% + ${positionRef.current.y}px), 0)`
      el.style.width = sizeRef.current.width ? `${sizeRef.current.width}px` : ''
      el.style.height = sizeRef.current.height ? `${sizeRef.current.height}px` : ''
      el.style.zIndex = String(zIndexRef.current)
    }

    bringToFrontRef.current = () => {
      const nextZ = nextZIndex()
      zIndexRef.current = nextZ
      setZIndex(nextZ)
      applyLayoutRef.current()
    }
  }, [])

  useEffect(() => {
    if (!open || !resource?.url || isZipUrl(resource.url)) return
    const url = resource.url
    let cancelled = false
    const apply = (u: string) => {
      if (!cancelled) {
        setPreviewSrc(u)
        setPreviewFor(url)
      }
    }
    if (mayNeedSignUrl(url)) {
      fileApi
        .signUrl(url)
        .then(apply)
        .catch(() => apply(url))
    } else {
      Promise.resolve(url).then(apply)
    }
    return () => {
      cancelled = true
    }
  }, [open, resource])

  const iframeSrc =
    previewFor === resource?.url && previewSrc ? buildKkFileViewUrl(previewSrc) : null

  useEffect(() => {
    ;(async () => {
      setMounted(true)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (open) {
        positionRef.current = initialPosition
        sizeRef.current = {}
        setPosition(initialPosition)
        setSize({})
        if (zIndexRef.current === 0) {
          const nextZ = nextZIndex()
          zIndexRef.current = nextZ
          setZIndex(nextZ)
        }
        applyLayoutRef.current()
      }
    })()
  }, [open, initialPosition])

  useEffect(() => {
    if (!dragging) return
    const iframe = iframeRef.current
    if (iframe) iframe.style.pointerEvents = 'none'
    document.body.classList.add('select-none')

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
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (iframe) iframe.style.pointerEvents = ''
      document.body.classList.remove('select-none')
    }
  }, [dragging])

  useEffect(() => {
    if (!resizing) return
    const iframe = iframeRef.current
    if (iframe) iframe.style.pointerEvents = 'none'
    document.body.classList.add('select-none')
    const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 32 : Infinity
    const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : Infinity

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
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (iframe) iframe.style.pointerEvents = ''
      document.body.classList.remove('select-none')
    }
  }, [resizing])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
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
    e.preventDefault()
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
    <DialogBranch>
      {backdrop && (
        <div
          className="fixed inset-0 bg-black/40 z-[90] pointer-events-auto"
          onClick={() => onOpenChange(false)}
        />
      )}
      <div
        ref={contentRef}
        data-resource-preview
        className={cn(
          'fixed top-1/2 left-1/2 flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-4xl h-[85vh] bg-background rounded-lg border p-3 shadow-none group',
          'contain-[layout_style_paint] pointer-events-auto',
          (dragging || resizing) && 'will-change-transform',
        )}
        style={{
          transform: `translate3d(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px), 0)`,
          width: size.width,
          height: size.height,
          zIndex,
        }}
        onMouseDown={() => bringToFrontRef.current()}
      >
        <div
          className="shrink-0 flex flex-row items-center justify-between gap-4 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2 text-base truncate font-semibold">
            {resource?.name || t('资源预览')}
          </div>
          <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="h-4 w-4 mr-1" />
              {t('关闭')}
            </Button>
            {isSafeExternalUrl(resource?.url) && (
              <Button variant="outline" size="sm" asChild onMouseDown={(e) => e.stopPropagation()}>
                <a href={resource.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {t('新窗口打开')}
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 mt-2 border rounded overflow-hidden bg-gray-100">
          {resource?.url ? (
            isZipUrl(resource.url) ? (
              <ZipPreview key={resource.url} url={resource.url} name={resource.name} />
            ) : iframeSrc ? (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title={resource.name}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                style={{ pointerEvents: dragging || resizing ? 'none' : 'auto' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                {t('加载中…')}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 h-full text-gray-400">
              <FileText className="h-10 w-10 opacity-40" />
              <span className="text-sm">{t('暂无预览内容')}</span>
            </div>
          )}
        </div>

        <div
          className="absolute bottom-1 right-1 z-10 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-muted-foreground" />
        </div>
      </div>
    </DialogBranch>,
    document.body,
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
    [max],
  )

  const removePreviewResource = useCallback((id: string) => {
    setPreviewResources((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return [previewResources, addPreviewResource, removePreviewResource] as const
}
