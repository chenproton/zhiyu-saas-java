'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { toast } from '@zhiyu/ui'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fileApi } from '@zhiyu/api-client'

import { ImageEditorDialog } from './image-editor-dialog'
import { isPassthroughImage, isUndecodableImage } from './image-upload-utils'

export interface UploadFieldProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  multiple?: boolean
  placeholder?: string
}

function uploadFile(file: File): Promise<string> {
  return fileApi.upload(file).then((res) => res.url)
}

/** 图片多选上传：本地文件上传 / URL 直填，返回图片地址数组 */
export function ImageListUpload({
  label,
  value,
  onChange,
  multiple = true,
  placeholder = '上传图片或输入 URL',
}: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const queueRef = useRef<File[]>([])
  const [editTarget, setEditTarget] = useState<{ file: File; src: string } | null>(null)
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const uploadAndAppend = async (f: File) => {
    setUploading(true)
    try {
      let url: string
      try {
        url = await uploadFile(f)
      } catch {
        url = URL.createObjectURL(f)
      }
      const next = multiple ? [...valueRef.current, url] : [url]
      valueRef.current = next
      onChange(next)
    } finally {
      setUploading(false)
    }
  }

  const processNext = () => {
    const next = queueRef.current.shift()
    if (!next) return
    if (isPassthroughImage(next)) {
      void uploadAndAppend(next).then(processNext)
    } else {
      setEditTarget({ file: next, src: URL.createObjectURL(next) })
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    if (inputRef.current) inputRef.current.value = ''
    if (list.some(isUndecodableImage)) {
      toast({ title: '暂不支持 HEIC/HEIF 格式，请先转换后再上传', variant: 'destructive' })
    }
    queueRef.current = list.filter((f) => !isUndecodableImage(f))
    processNext()
  }

  const finishEdit = (file?: File) => {
    const target = editTarget
    setEditTarget(null)
    if (target) URL.revokeObjectURL(target.src)
    if (file) {
      void uploadAndAppend(file).then(processNext)
    } else {
      processNext()
    }
  }

  const addUrl = () => {
    const u = urlInput.trim()
    if (!u) return
    onChange(multiple ? [...value, u] : [u])
    setUrlInput('')
  }

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {value.map((url, idx) => (
          <div
            key={idx}
            className="relative group w-20 h-20 rounded-lg overflow-hidden border bg-muted/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`${label} ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {multiple && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !!editTarget}
            className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span className="text-[10px]">上传</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <ImageEditorDialog
        open={!!editTarget}
        src={editTarget?.src || ''}
        fileName={editTarget?.file.name || 'image'}
        mimeType={editTarget?.file.type || 'image/png'}
        onConfirm={(file) => finishEdit(file)}
        onCancel={() => finishEdit()}
      />
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addUrl} className="h-8 text-xs">
          添加
        </Button>
      </div>
    </div>
  )
}

/** 单图上传（Logo/封面），返回图片地址 */
export function SingleImageUpload({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [editTarget, setEditTarget] = useState<{ file: File; src: string } | null>(null)

  const doUpload = async (f: File) => {
    setUploading(true)
    try {
      try {
        onChange(await uploadFile(f))
      } catch {
        onChange(URL.createObjectURL(f))
      }
    } finally {
      setUploading(false)
    }
  }

  const handleFile = (f: File | undefined) => {
    if (!f) return
    if (inputRef.current) inputRef.current.value = ''
    if (isUndecodableImage(f)) {
      toast({ title: '暂不支持 HEIC/HEIF 格式，请先转换后再上传', variant: 'destructive' })
      return
    }
    if (isPassthroughImage(f)) {
      void doUpload(f)
      return
    }
    setEditTarget({ file: f, src: URL.createObjectURL(f) })
  }

  const finishEdit = (file?: File) => {
    const target = editTarget
    setEditTarget(null)
    if (target) URL.revokeObjectURL(target.src)
    if (file) void doUpload(file)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative group w-28 h-20 rounded-lg overflow-hidden border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !!editTarget}
          className="w-28 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span className="text-[10px]">上传</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <ImageEditorDialog
        open={!!editTarget}
        src={editTarget?.src || ''}
        fileName={editTarget?.file.name || 'image'}
        mimeType={editTarget?.file.type || 'image/png'}
        onConfirm={(file) => finishEdit(file)}
        onCancel={() => finishEdit()}
      />
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="或输入图片 URL"
          className="h-8 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const u = urlInput.trim()
            if (u) {
              onChange(u)
              setUrlInput('')
            }
          }}
          className="h-8 text-xs"
        >
          设置
        </Button>
      </div>
    </div>
  )
}
