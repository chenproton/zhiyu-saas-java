'use client'

import { useState } from 'react'
import ImageEditor from '@unlayer/react-image-editor'
import { Loader2 } from 'lucide-react'
import { toast } from '@zhiyu/ui'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ImageEditorDialogProps {
  open: boolean
  src: string
  fileName: string
  mimeType: string
  onConfirm: (file: File) => void
  onCancel: () => void
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

/**
 * 通用图片编辑弹窗：裁切/旋转/滤镜/文字/贴纸/相框等，
 * 基于 @unlayer/react-image-editor，编辑器核心由 unlayer CDN 加载（标准引用方式）。
 */
export function ImageEditorDialog({
  open,
  src,
  fileName,
  mimeType,
  onConfirm,
  onCancel,
}: ImageEditorDialogProps) {
  const [loaded, setLoaded] = useState(false)

  const handleSave = ({ blob }: { blob: Blob }) => {
    const type =
      blob.type && blob.type.startsWith('image/') ? blob.type : mimeType || 'image/png'
    const ext = EXT_BY_MIME[type] || 'png'
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'image'
    onConfirm(new File([blob], `${baseName}.${ext}`, { type }))
  }

  const handleFail = (msg: string) => () => {
    toast({ title: msg, variant: 'destructive' })
    onCancel()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-[960px] max-h-[92vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle>图片编辑</DialogTitle>
        </DialogHeader>
        <div className="relative px-6 py-4 min-h-0 overflow-hidden">
          {!loaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">编辑器加载中...</span>
            </div>
          )}
          {open && (
            <ImageEditor
              image={src}
              minHeight={540}
              options={{
                theme: 'light',
                locale: 'zh',
              }}
              onLoad={() => setLoaded(true)}
              onSave={handleSave}
              onCancel={onCancel}
              onLoadError={handleFail('图片加载失败，请更换图片后重试')}
              onError={handleFail('图片编辑器加载失败，请刷新页面后重试')}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
