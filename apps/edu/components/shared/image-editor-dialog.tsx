'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ImageEditorDialogProps {
  open: boolean
  src: string
  fileName: string
  mimeType: string
  onConfirm: (file: File) => void
  onCancel: () => void
}

interface SavedImageData {
  name?: string
  extension?: string
  mimeType?: string
  imageBase64?: string
  imageCanvas?: HTMLCanvasElement
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
}

/** dataURL → File（imageBase64 为同步路径，避免 canvas 卸载后 toBlob 失效） */
function dataURLToFile(dataUrl: string, fileName: string, type: string): File {
  const arr = dataUrl.split(',')
  const mime = arr[0]?.match(/:(.*?);/)?.[1] || type
  const bstr = atob(arr[1])
  const u8arr = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i += 1) u8arr[i] = bstr.charCodeAt(i)
  return new File([u8arr], fileName, { type: mime })
}

/**
 * 通用图片编辑弹窗：裁切/旋转/滤镜/文字/图形/画笔/贴纸/水印，
 * 基于 react-filerobot-image-editor（原生 React 19 组件，完全离线可用）。
 */
export function ImageEditorDialog({
  open,
  src,
  fileName,
  mimeType,
  onConfirm,
  onCancel,
}: ImageEditorDialogProps) {
  const handleSave = (data: SavedImageData) => {
    const type =
      data.mimeType && data.mimeType.startsWith('image/') ? data.mimeType : mimeType || 'image/png'
    const ext = EXT_BY_MIME[type] || 'png'
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'image'
    const fullName = `${baseName}.${ext}`
    if (data.imageBase64) {
      onConfirm(dataURLToFile(data.imageBase64, fullName, type))
      return
    }
    if (data.imageCanvas) {
      data.imageCanvas.toBlob(
        (blob) => {
          if (blob) onConfirm(new File([blob], fullName, { type }))
        },
        type,
        0.92,
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-[1100px] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">图片编辑</DialogTitle>
        <div className="h-[92vh] w-full">
          {open && (
            <FilerobotImageEditor
              source={src}
              onSave={handleSave}
              onClose={onCancel}
              useBackendTranslations={false}
              closeAfterSave={false}
              avoidChangesNotSavedAlertOnLeave
              showBackButton={false}
              defaultSavedImageType="png"
              savingPixelRatio={4}
              previewPixelRatio={typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const FilerobotImageEditor = dynamic(
  () => import('react-filerobot-image-editor').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        编辑器加载中...
      </div>
    ),
  },
)
