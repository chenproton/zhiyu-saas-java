'use client'

import {
  FileText,
  Link2,
  Package,
  Search,
  Upload,
  Video,
  Image as ImageIcon,
  Table,
  Headphones,
  Archive,
  MapPin,
  Building2,
  Globe,
  X,
  CheckCircle2,
  RotateCcw,
  Plus,
  Eye,
  Loader2,
  File,
  Users,
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { fileApi, nodeResourceApi, courseResourceApi, resourceLibraryApi } from '@/lib/api'
import { toast } from '@zhiyu/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_SHORT_LABELS } from '@/lib/types/library'
import type { ResourceKind } from '@/lib/types/library'

export interface ResourceItem {
  id: string
  name: string
  type: string
  url?: string
  uploadedBy?: string
  uploadedAt?: string
  thumbnail?: string
  description?: string
  size?: string | number
}

interface ResourceSelectorProps {
  pool?: ResourceItem[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  onUpload?: (resource: ResourceItem) => void
  courseId?: string
  nodeId?: string
  standalone?: boolean
  previewResources?: any[]
  onAddPreviewResource?: (r: any) => void
  onRemovePreviewResource?: (id: string) => void
}

// 'all' 为"全部"选项，其余与共享 RESOURCE_TYPE_LABELS 对应
const ALL_TYPES = ['all', ...Object.keys(RESOURCE_TYPE_LABELS)]

const resourceTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4 text-blue-500" />,
  spreadsheet: <Table className="h-4 w-4 text-teal-500" />,
  image: <ImageIcon className="h-4 w-4 text-green-500" />,
  link: <Link2 className="h-4 w-4 text-cyan-500" />,
  audio: <Headphones className="h-4 w-4 text-violet-500" />,
  video: <Video className="h-4 w-4 text-red-500" />,
  archive: <Archive className="h-4 w-4 text-amber-500" />,
  venue: <MapPin className="h-4 w-4 text-orange-500" />,
  facility: <Building2 className="h-4 w-4 text-rose-500" />,
  software: <Globe className="h-4 w-4 text-purple-500" />,
  other: <Package className="h-4 w-4 text-gray-500" />,
}

const resourceTypeColors: Record<string, string> = {
  document: 'bg-blue-50 text-blue-600 border-blue-200',
  spreadsheet: 'bg-teal-50 text-teal-600 border-teal-200',
  image: 'bg-green-50 text-green-600 border-green-200',
  link: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  audio: 'bg-violet-50 text-violet-600 border-violet-200',
  video: 'bg-red-50 text-red-600 border-red-200',
  archive: 'bg-amber-50 text-amber-600 border-amber-200',
  venue: 'bg-orange-50 text-orange-600 border-orange-200',
  facility: 'bg-rose-50 text-rose-600 border-rose-200',
  software: 'bg-purple-50 text-purple-600 border-purple-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
}

const resourceTypeAccept: Record<string, string> = {
  document: '.pdf,.doc,.docx,.txt,.ppt,.pptx,.md',
  spreadsheet: '.xls,.xlsx,.csv',
  image: '.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp',
  audio: '.mp3,.wav,.ogg,.m4a,.flac,.aac',
  video: '.mp4,.webm,.mov,.avi,.mkv,.flv',
  archive: '.zip,.rar,.7z,.tar,.gz,.bz2',
  other: '',
  software: '.exe,.dmg,.pkg,.deb,.rpm,.zip,.msi,.apk',
}

const resourceTypeExtensionMap: Record<string, string[]> = {
  document: ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'md'],
  spreadsheet: ['xls', 'xlsx', 'csv'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
  video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  other: [],
  software: ['exe', 'dmg', 'pkg', 'deb', 'rpm', 'zip', 'msi', 'apk'],
}

const RESOURCE_MAX_FILE_SIZE = 100 * 1024 * 1024

export function ResourceSelector({
  pool: externalPool,
  selectedIds,
  onChange,
  onUpload,
  courseId,
  nodeId,
  standalone = true,
  previewResources: externalPreviews,
  onAddPreviewResource,
  onRemovePreviewResource,
}: ResourceSelectorProps) {
  const [resType, setResType] = useState('all')
  const [resSearchName, setResSearchName] = useState('')
  const [resSearchProvider, setResSearchProvider] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const [internalPool, setInternalPool] = useState<ResourceItem[]>([])
  const [loadingPool, setLoadingPool] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)

  const [internalPreviews, addInternalPreview, removeInternalPreview] = usePreviewResources()
  const previewResources = externalPreviews !== undefined ? externalPreviews : internalPreviews
  const addPreviewResource = onAddPreviewResource || addInternalPreview
  const removePreviewResource = onRemovePreviewResource || removeInternalPreview

  const [showUpload, setShowUpload] = useState(false)
  const [showUploadTypePicker, setShowUploadTypePicker] = useState(false)
  const [newResName, setNewResName] = useState('')
  const [newResType, setNewResType] = useState('document')
  const [newResUrl, setNewResUrl] = useState('')
  const [newResDescription, setNewResDescription] = useState('')
  const [newResAddress, setNewResAddress] = useState('')
  const [newResOpenTime, setNewResOpenTime] = useState('')
  const [newResCapacity, setNewResCapacity] = useState('')
  const [newResContact, setNewResContact] = useState('')
  const [newResLocation, setNewResLocation] = useState('')
  const [newResQuantity, setNewResQuantity] = useState('')
  const [newResVersion, setNewResVersion] = useState('')
  const [newResLicense, setNewResLicense] = useState('')
  const [newResFile, setNewResFile] = useState<File | null>(null)
  const [newResUploading, setNewResUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const effectiveNodeId = nodeId && !nodeId.startsWith('node-') ? nodeId : undefined
  const courseScope = !!courseId && !effectiveNodeId
  const useApi = !!courseId || !!effectiveNodeId

  const loadResources = useCallback(async () => {
    if (!useApi) return
    setLoadingPool(true)
    try {
      const res = await resourceLibraryApi.list({ limit: 1000 })
      setInternalPool(
        (res.items || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.resourceType || r.type,
          url: r.url,
          description: r.description,
          size: r.fileSize ?? r.size,
          uploadedBy: r.uploadedBy,
          uploadedAt: r.createdAt,
          thumbnail: r.thumbnail,
        })),
      )
      setApiAvailable(true)
    } catch (e: any) {
      setApiAvailable(false)
      toast({ title: e.message || '加载资源库失败', variant: 'destructive' })
    } finally {
      setLoadingPool(false)
    }
  }, [useApi])

  useEffect(() => {
    if (isDialogOpen && useApi) {
      ;(async () => {
        await loadResources()
      })()
    }
  }, [isDialogOpen, useApi, loadResources])

  useEffect(() => {
    if (!standalone && useApi) {
      ;(async () => {
        await loadResources()
      })()
    }
  }, [standalone, useApi, loadResources])

  const mergedPool = useMemo(() => {
    const map = new Map<string, ResourceItem>()
    internalPool.forEach((r) => map.set(r.id, r))
    ;(externalPool || []).forEach((r) => {
      if (!map.has(r.id)) map.set(r.id, r)
    })
    return Array.from(map.values())
  }, [internalPool, externalPool])

  const filteredRes = mergedPool.filter((r) => {
    const matchType = resType === 'all' || r.type === resType
    const matchName = !resSearchName || r.name.includes(resSearchName)
    const matchProvider =
      !resSearchProvider || (r.uploadedBy && r.uploadedBy.includes(resSearchProvider))
    return matchType && matchName && matchProvider
  })

  const toggleResource = (rid: string) => {
    const selected = selectedIds.includes(rid)
    onChange(selected ? selectedIds.filter((id) => id !== rid) : [...selectedIds, rid])
  }

  const resetFilters = () => {
    setResType('all')
    setResSearchName('')
    setResSearchProvider('')
  }

  const inferTypeFromName = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
    if (['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'md'].includes(ext)) return 'document'
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet'
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive'
    return 'other'
  }

  const validateResourceFile = (file: File, type: string): string | null => {
    if (file.size > RESOURCE_MAX_FILE_SIZE) return '文件大小超过 100MB'
    const allowed = resourceTypeExtensionMap[type] || []
    if (allowed.length === 0) return null
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowed.includes(ext)) {
      return `不支持的文件格式，请上传 ${allowed.map((e) => `.${e}`).join('、')} 文件`
    }
    return null
  }

  const handleFileSelect = async (file: File) => {
    const err = validateResourceFile(file, newResType)
    if (err) {
      toast({ title: err, variant: 'destructive' })
      return
    }
    setNewResFile(file)
    setNewResName(file.name)
    setNewResType(inferTypeFromName(file.name))
  }

  const resetUploadForm = () => {
    setNewResName('')
    setNewResType('document')
    setNewResUrl('')
    setNewResDescription('')
    setNewResAddress('')
    setNewResOpenTime('')
    setNewResCapacity('')
    setNewResContact('')
    setNewResLocation('')
    setNewResQuantity('')
    setNewResVersion('')
    setNewResLicense('')
    setNewResFile(null)
    setNewResUploading(false)
  }

  const handleUpload = async () => {
    if (!newResName.trim()) return

    const fileTypes = [
      'document',
      'spreadsheet',
      'image',
      'audio',
      'video',
      'archive',
      'other',
      'software',
    ]
    const isFileType = fileTypes.includes(newResType)
    let fileUrl = newResUrl.trim()
    let uploadedSize: number | undefined

    if (isFileType && newResFile) {
      setNewResUploading(true)
      try {
        const res = await fileApi.upload(newResFile)
        fileUrl = res.url
        uploadedSize = res.size
      } catch (e: any) {
        toast({ title: e.message || '上传失败', variant: 'destructive' })
        setNewResUploading(false)
        return
      }
    }

    if (newResType === 'link' && !fileUrl) {
      toast({ title: '请填写链接地址', variant: 'destructive' })
      return
    }

    const localId = `res-${Date.now()}`
    const newRes: ResourceItem = {
      id: localId,
      name: newResName.trim(),
      type: newResType,
      url: fileUrl,
      description: newResDescription,
      uploadedBy: '当前用户',
      uploadedAt: new Date().toISOString().slice(0, 10),
      size: uploadedSize,
    }

    if (useApi && apiAvailable) {
      try {
        const created = await resourceLibraryApi.create({
          name: newRes.name,
          resourceType: newRes.type as ResourceKind,
          url: fileUrl || undefined,
          description: newResDescription || undefined,
          fileSize: uploadedSize,
        })
        newRes.id = created.id
        newRes.url = created.url || newRes.url
        setInternalPool((prev) => [newRes, ...prev])

        if (courseScope && courseId) {
          await courseResourceApi.bind({ courseId, resourceId: created.id })
        } else if (effectiveNodeId) {
          await nodeResourceApi.bind({ nodeId: effectiveNodeId, resourceId: created.id })
        }
      } catch (e: any) {
        toast({ title: e.message || '资源保存失败', variant: 'destructive' })
        setNewResUploading(false)
        return
      }
    }

    onUpload?.(newRes)
    onChange([...selectedIds, newRes.id])
    resetUploadForm()
    setShowUpload(false)
    setShowUploadTypePicker(false)
    toast({ title: '资源已上传并选中' })
  }

  const selectedResources = selectedIds
    .map((id) => mergedPool.find((r) => r.id === id))
    .filter(Boolean) as ResourceItem[]

  const fileTypesWithUpload = [
    'document',
    'spreadsheet',
    'image',
    'audio',
    'video',
    'archive',
    'other',
    'software',
  ]

  const selectionContent = (
    <div className={cn('space-y-4', !standalone && 'flex flex-col h-full min-h-0')}>
      {/* Toolbar */}
      <div className="shrink-0 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {ALL_TYPES.map((t) => (
            <Button
              key={t}
              variant={resType === t ? 'default' : 'outline'}
              size="sm"
              className={cn('text-xs h-7', resType === t ? '' : 'bg-white')}
              onClick={() => setResType(t)}
            >
              {resourceTypeIcons[t] && <span className="mr-1.5">{resourceTypeIcons[t]}</span>}
              {RESOURCE_TYPE_SHORT_LABELS[t] || t}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={resSearchName}
              onChange={(e) => setResSearchName(e.target.value)}
              placeholder="搜索资源名称..."
              className="pl-9 text-sm"
            />
          </div>
          <div className="relative flex-1">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={resSearchProvider}
              onChange={(e) => setResSearchProvider(e.target.value)}
              placeholder="搜索资源提供者..."
              className="pl-9 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            重置
          </Button>
          <Button size="sm" className="h-9 text-xs" onClick={() => setShowUploadTypePicker(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            上传资源
          </Button>
        </div>
      </div>

      <div className={cn('flex gap-4', standalone ? 'min-h-[320px]' : 'h-full min-h-0')}>
        {/* Left: Resource cards grid */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 border rounded-xl p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <p className="text-sm font-medium text-gray-700">
              资源列表 <span className="text-gray-400 font-normal">({filteredRes.length})</span>
            </p>
            {loadingPool && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          <div className="flex-1 overflow-y-auto pr-1 min-w-0">
            {filteredRes.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">未找到匹配的资源</p>
                <p className="text-xs mt-1">尝试调整筛选条件或上传新资源</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredRes.map((r) => {
                  const selected = selectedIds.includes(r.id)
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        'relative rounded-lg border overflow-hidden transition-all cursor-pointer group',
                        selected
                          ? 'border-primary shadow-sm ring-1 ring-primary/10'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white',
                      )}
                      onClick={() => toggleResource(r.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleResource(r.id)
                        }
                      }}
                    >
                      <div className="relative h-20 bg-gray-50 border-b border-gray-100 overflow-hidden">
                        {r.thumbnail && r.type === 'image' ? (
                          <Image src={r.thumbnail} alt={r.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div
                              className={cn(
                                'p-2 rounded-lg border',
                                resourceTypeColors[r.type] || 'bg-gray-50 border-gray-200',
                              )}
                            >
                              {resourceTypeIcons[r.type] || (
                                <Package className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                          </div>
                        )}
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 bg-primary text-white rounded-full p-0.5 shadow-sm">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="absolute bottom-1.5 left-1.5">
                          <Badge
                            className={cn('text-[9px] border', resourceTypeColors[r.type] || '')}
                          >
                            {RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2">
                        <p
                          className="text-xs font-medium text-gray-800 truncate mb-1"
                          title={r.name}
                        >
                          {r.name}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{r.uploadedBy || '-'}</p>
                      </div>
                      <div className="px-2 pb-2 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1 flex-1 text-gray-500 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (r.url) addPreviewResource(r as any)
                          }}
                        >
                          <Eye className="h-3 w-3 mr-0.5" />
                          预览
                        </Button>
                        <Button
                          variant={selected ? 'outline' : 'default'}
                          size="sm"
                          className="h-6 text-[10px] px-2 flex-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleResource(r.id)
                          }}
                        >
                          {selected ? '已选择' : '选择'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected resources sidebar */}
        <div className="w-64 shrink-0 flex flex-col min-h-0 border rounded-xl p-4 bg-gray-50/50 overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <p className="text-sm font-semibold text-gray-700">已选资源</p>
            <Badge variant="secondary" className="text-[10px]">
              {selectedIds.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {selectedIds.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">请从左侧选择资源</p>
              </div>
            ) : (
              selectedIds.map((rid) => {
                const r = mergedPool.find((res) => res.id === rid)
                if (!r) return null
                return (
                  <div
                    key={rid}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-primary/20 bg-white shadow-sm"
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0',
                        resourceTypeColors[r.type] || 'bg-gray-50',
                      )}
                    >
                      {resourceTypeIcons[r.type] || <Package className="h-4 w-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-gray-800" title={r.name}>
                        {r.name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">{r.uploadedBy || '-'}</p>
                    </div>
                    <button
                      className="text-gray-400 hover:text-red-500 shrink-0 p-0.5 rounded hover:bg-red-50 transition-colors"
                      onClick={() => toggleResource(rid)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const subDialogs = (
    <>
      {/* Upload Type Picker Dialog */}
      <Dialog open={showUploadTypePicker} onOpenChange={setShowUploadTypePicker}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>选择资源类型</DialogTitle>
            <DialogDescription>请选择要上传的资源类型</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {ALL_TYPES.filter((t) => t !== 'all').map((t) => (
              <button
                key={t}
                onClick={() => {
                  setNewResType(t)
                  setShowUploadTypePicker(false)
                  setShowUpload(true)
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <div
                  className={cn(
                    'p-2 rounded-lg border',
                    resourceTypeColors[t] || 'bg-gray-50 border-gray-200',
                  )}
                >
                  {resourceTypeIcons[t] || <Package className="h-5 w-5 text-gray-400" />}
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {RESOURCE_TYPE_SHORT_LABELS[t] || t}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Resource Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上传资源</DialogTitle>
            <DialogDescription>补充本地资源，上传后将自动选中</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>资源名称</Label>
              <Input
                value={newResName}
                onChange={(e) => setNewResName(e.target.value)}
                placeholder="输入资源名称"
                className="mt-1.5"
              />
            </div>

            {newResType === 'link' && (
              <div>
                <Label>URL 地址</Label>
                <Input
                  value={newResUrl}
                  onChange={(e) => setNewResUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1.5"
                />
              </div>
            )}

            {newResType === 'venue' && (
              <>
                <div>
                  <Label>场地地址</Label>
                  <Input
                    value={newResAddress}
                    onChange={(e) => setNewResAddress(e.target.value)}
                    placeholder="输入场地详细地址"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>开放时间</Label>
                  <Input
                    value={newResOpenTime}
                    onChange={(e) => setNewResOpenTime(e.target.value)}
                    placeholder="例如：周一至周五 09:00-18:00"
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>容纳人数</Label>
                    <Input
                      value={newResCapacity}
                      onChange={(e) => setNewResCapacity(e.target.value)}
                      placeholder="例如：50人"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>联系人/电话</Label>
                    <Input
                      value={newResContact}
                      onChange={(e) => setNewResContact(e.target.value)}
                      placeholder="输入联系人或电话"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </>
            )}

            {newResType === 'facility' && (
              <>
                <div>
                  <Label>所在位置</Label>
                  <Input
                    value={newResLocation}
                    onChange={(e) => setNewResLocation(e.target.value)}
                    placeholder="输入设施所在位置"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>数量</Label>
                  <Input
                    value={newResQuantity}
                    onChange={(e) => setNewResQuantity(e.target.value)}
                    placeholder="输入设施数量"
                    className="mt-1.5"
                  />
                </div>
              </>
            )}

            {newResType === 'software' && (
              <>
                <div>
                  <Label>版本号</Label>
                  <Input
                    value={newResVersion}
                    onChange={(e) => setNewResVersion(e.target.value)}
                    placeholder="例如：v2.1.0"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>下载链接</Label>
                  <Input
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>授权信息</Label>
                  <Input
                    value={newResLicense}
                    onChange={(e) => setNewResLicense(e.target.value)}
                    placeholder="例如：MIT / 商业授权 / 校内授权"
                    className="mt-1.5"
                  />
                </div>
              </>
            )}

            <div>
              <Label>资源描述</Label>
              <Textarea
                value={newResDescription}
                onChange={(e) => setNewResDescription(e.target.value)}
                placeholder="输入资源简介、用途说明等"
                className="mt-1.5"
                rows={2}
              />
            </div>

            {fileTypesWithUpload.includes(newResType) && (
              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors',
                  newResUploading
                    ? 'border-primary/30 bg-gray-50/50'
                    : 'border-gray-200 hover:border-primary/30 hover:bg-gray-50/50 cursor-pointer',
                )}
                onClick={() => !newResUploading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !newResUploading) {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={resourceTypeAccept[newResType]}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                    e.target.value = ''
                  }}
                />
                {newResFile ? (
                  <div className="text-center space-y-2 pointer-events-none">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <File className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">{newResFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(newResFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                      {newResUploading ? (
                        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                      ) : (
                        <Upload className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">点击或拖拽上传文件</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {resourceTypeAccept[newResType]
                          ? `支持 ${resourceTypeAccept[newResType]}，最大 100MB`
                          : '支持多种格式，最大 100MB'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUpload(false)
                resetUploadForm()
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                !newResName.trim() ||
                newResUploading ||
                (newResType === 'link' && !newResUrl.trim()) ||
                (fileTypesWithUpload.includes(newResType) && !newResFile && !newResUrl.trim())
              }
            >
              {newResUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              上传并选中
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Preview Modals */}
      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}
    </>
  )

  if (!standalone) {
    return (
      <>
        {selectionContent}
        {subDialogs}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selected tags */}
      {selectedResources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedResources.map((r) => (
            <Badge
              key={r.id}
              variant="secondary"
              className="px-2.5 py-1 text-xs font-normal bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
            >
              {resourceTypeIcons[r.type] && (
                <span className="mr-1">{resourceTypeIcons[r.type]}</span>
              )}
              {r.name}
              <button
                className="ml-1 text-blue-400 hover:text-blue-700"
                onClick={() => toggleResource(r.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add button + dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" />
            添加课程资源
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加课程资源</DialogTitle>
            <DialogDescription>从资源库中选择或上传新资源</DialogDescription>
          </DialogHeader>

          {selectionContent}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {subDialogs}
    </div>
  )
}
