"use client"

import { useState } from "react"
import { Upload, FileText, Video, Image, X, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatFileSize } from "@/lib/resource-constants"

interface ResourceItem {
  id: string
  name: string
  type: "pdf" | "video" | "image" | "audio" | "doc"
  size: string
}

const TYPE_ICONS: Record<ResourceItem["type"], React.ReactNode> = {
  pdf: <FileText className="w-4 h-4 text-red-500" />,
  video: <Video className="w-4 h-4 text-blue-500" />,
  image: <Image className="w-4 h-4 text-green-500" />,
  audio: <Music className="w-4 h-4 text-purple-500" />,
  doc: <FileText className="w-4 h-4 text-orange-500" />,
}

export default function ResourceUploader() {
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  const handleUpload = () => {
    // 文件上传功能待后端存储接口接入，当前不生成模拟文件
  }

  const removeResource = (id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver ? "border-blue-400 bg-blue-50/50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload() }}
        onClick={handleUpload}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-500">点击或拖拽文件到此处上传</p>
        <p className="text-xs text-gray-400 mt-1">支持 PDF、PPT、视频、图片等格式</p>
      </div>

      {resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 p-2.5 rounded-md border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
            >
              <div className="w-8 h-8 rounded bg-gray-50 flex items-center justify-center">
                {TYPE_ICONS[r.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{r.name}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(r.size)}</p>
              </div>
              <button
                onClick={() => removeResource(r.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
