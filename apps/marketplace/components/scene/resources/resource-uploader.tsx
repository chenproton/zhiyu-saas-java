"use client"

import { FileText, Link2, Plus, Trash2, Upload, Video } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Resource } from "@/lib/types/scene-mock"
import { formatFileSize } from "@/lib/resource-constants"

interface ResourceUploaderProps {
  resources: Resource[]
  onResourceAdd?: (resource: Resource) => void
  onResourceDelete?: (resourceId: string) => void
}

const resourceTypeConfig = {
  document: { icon: FileText, label: "文档", color: "text-blue-500 bg-blue-50" },
  video: { icon: Video, label: "视频", color: "text-purple-500 bg-purple-50" },
  link: { icon: Link2, label: "链接", color: "text-green-500 bg-green-50" },
  file: { icon: Upload, label: "文件", color: "text-orange-500 bg-orange-50" },
}

export function ResourceUploader({ resources, onResourceAdd, onResourceDelete }: ResourceUploaderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    type: "document",
    name: "",
    url: "",
  })

  const handleAdd = () => {
    if (newResource.name && newResource.url && newResource.type) {
      onResourceAdd?.({
        id: `res-${Date.now()}`,
        name: newResource.name,
        type: newResource.type as Resource["type"],
        url: newResource.url,
      })
      setNewResource({ type: "document", name: "", url: "" })
      setIsDialogOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Resource list */}
      {resources.length > 0 ? (
        <div className="space-y-2">
          {resources.map((resource) => {
            const config = resourceTypeConfig[resource.type]
            const Icon = config.icon

            return (
              <div
                key={resource.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50 group hover:bg-white hover:border-gray-200 transition-colors"
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{resource.name}</p>
                  <p className="text-xs text-gray-400 truncate">{resource.url}</p>
                </div>
                {resource.size && (
                  <span className="text-xs text-gray-400">{formatFileSize(resource.size)}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                  onClick={() => onResourceDelete?.(resource.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 bg-gray-50/50 rounded-lg border-2 border-dashed border-gray-200">
          <Upload className="h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">暂无支撑资源</p>
        </div>
      )}

      {/* Add resource dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" />
            添加资源
          </Button>
        </DialogTrigger>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>添加支撑资源</DialogTitle>
            <DialogDescription>
              添加学习资料、参考文档或外部链接
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>资源类型</Label>
              <Select
                value={newResource.type}
                onValueChange={(value) => setNewResource({ ...newResource, type: value as Resource["type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">文档</SelectItem>
                  <SelectItem value="video">视频</SelectItem>
                  <SelectItem value="link">链接</SelectItem>
                  <SelectItem value="file">文件</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>资源名称</Label>
              <Input
                value={newResource.name}
                onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                placeholder="例如：React 官方文档"
              />
            </div>
            <div className="grid gap-2">
              <Label>资源地址</Label>
              <Input
                value={newResource.url}
                onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!newResource.name || !newResource.url}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
