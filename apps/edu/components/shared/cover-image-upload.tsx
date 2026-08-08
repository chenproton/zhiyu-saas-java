'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from '@zhiyu/ui'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n/locale-provider'

import { ImageEditorDialog } from './image-editor-dialog'
import { isPassthroughImage, isUndecodableImage } from './image-upload-utils'

interface CoverImageUploadProps {
  imageUrl: string
  uploading: boolean
  label: string
  alt: string
  onUpload: (file: File) => void
  onRemove: () => void
}

export function CoverImageUpload({
  imageUrl,
  uploading,
  label,
  alt,
  onUpload,
  onRemove,
}: CoverImageUploadProps) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [editTarget, setEditTarget] = useState<{ src: string; file: File } | null>(null)

  const triggerUpload = () => {
    if (!uploading) inputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (isUndecodableImage(file)) {
      toast({ title: t('暂不支持 HEIC/HEIF 格式，请先转换后再上传'), variant: 'destructive' })
      return
    }
    if (isPassthroughImage(file)) {
      onUpload(file)
      return
    }
    setEditTarget({ src: URL.createObjectURL(file), file })
  }

  const finishEdit = (file?: File) => {
    const target = editTarget
    setEditTarget(null)
    if (target) URL.revokeObjectURL(target.src)
    if (file) onUpload(file)
  }

  return (
    <>
      <Label className="block mb-3">{label}</Label>
      <div
        className="aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative group"
        onClick={triggerUpload}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            triggerUpload()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={alt} className="object-cover w-full h-full absolute inset-0" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/90 text-gray-800 border-white hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation()
                  triggerUpload()
                }}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('更换封面')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/90 text-gray-800 border-white hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                disabled={uploading}
              >
                {t('移除封面')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            {uploading ? (
              <Loader2 className="h-8 w-8 text-gray-400 mb-2 animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
            )}
            <span className="text-sm text-gray-500">
              {uploading
                ? t('上传中...')
                : t('点击上传{name}', { name: label })}
            </span>
          </div>
        )}
      </div>
      <ImageEditorDialog
        open={!!editTarget}
        src={editTarget?.src || ''}
        fileName={editTarget?.file.name || 'image'}
        mimeType={editTarget?.file.type || 'image/png'}
        onConfirm={(file) => finishEdit(file)}
        onCancel={() => finishEdit()}
      />
    </>
  )
}
