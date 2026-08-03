import { useRef } from 'react'
import { Upload, File, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { resourceTypeAccept } from '@/lib/resource-type-constants'

interface ResourceUploadZoneProps {
  resourceType: string
  uploadFile: File | null
  uploading: boolean
  onFileDrop: (e: React.DragEvent) => void
  onFileSelect: (file: File) => void
  onClear: () => void
}

export function ResourceUploadZone({
  resourceType,
  uploadFile,
  uploading,
  onFileDrop,
  onFileSelect,
  onClear,
}: ResourceUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors',
        uploading
          ? 'border-primary/30 bg-gray-50/50'
          : 'border-gray-200 hover:border-primary/30 hover:bg-gray-50/50 cursor-pointer',
      )}
      onClick={() => !uploading && fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
          e.preventDefault()
          fileInputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDrop={onFileDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={resourceTypeAccept[resourceType]}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
          e.target.value = ''
        }}
      />
      {uploadFile ? (
        <div className="text-center space-y-2 pointer-events-none">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <File className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-gray-700">{uploadFile.name}</p>
          <p className="text-xs text-gray-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
            {uploading ? (
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            ) : (
              <Upload className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">点击或拖拽上传文件</p>
            <p className="text-xs text-gray-500 mt-1">
              {resourceTypeAccept[resourceType]
                ? `支持 ${resourceTypeAccept[resourceType]}，最大 100MB`
                : '支持多种格式，最大 100MB'}
            </p>
          </div>
        </>
      )}
      {uploadFile && !uploading && (
        <div
          className="flex items-center justify-center gap-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            重新选择
          </Button>
          <Button variant="outline" size="sm" onClick={onClear}>
            <X className="h-3.5 w-3.5 mr-1" />
            清除
          </Button>
        </div>
      )}
    </div>
  )
}
