"use client"

import { useRef } from "react"
import { ImageIcon, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

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
  const inputRef = useRef<HTMLInputElement>(null)

  const triggerUpload = () => {
    if (!uploading) inputRef.current?.click()
  }

  return (
    <>
      <Label className="block mb-3">{label}</Label>
      <div
        className="aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative group"
        onClick={triggerUpload}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ""
          }}
        />
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={alt}
              className="object-cover w-full h-full absolute inset-0"
            />
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
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "更换封面"}
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
                移除封面
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
              {uploading ? "上传中..." : `点击上传${label.replace("封面", "")}封面`}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
