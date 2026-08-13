'use client'

import {
  Package,
  Upload,
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
import { SearchInput } from '@/components/shared/search-input'
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_SHORT_LABELS } from '@/lib/types/library'
import {
  resourceTypeAccept,
  resourceTypeExtensionMap,
  RESOURCE_MAX_FILE_SIZE,
  DOCUMENT_EXTS,
  SPREADSHEET_EXTS,
  IMAGE_EXTS,
  AUDIO_EXTS,
  VIDEO_EXTS,
  ARCHIVE_EXTS,
  SOFTWARE_EXTS,
  TYPE_ICONS,
  TYPE_BADGE,
} from '@/lib/resource-type-constants'
import type { ResourceKind } from '@/lib/types/library'
import { useT } from '@/lib/i18n/locale-provider'
import { formatSize } from '@/lib/format-utils'

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

  const t = useT()

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
      toast({ title: e.message || t('加载资源库失败'), variant: 'destructive' })
    } finally {
      setLoadingPool(false)
    }
  }, [useApi, t])

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
    if (VIDEO_EXTS.includes(ext)) return 'video'
    if (AUDIO_EXTS.includes(ext)) return 'audio'
    if (IMAGE_EXTS.includes(ext)) return 'image'
    if (DOCUMENT_EXTS.includes(ext)) return 'document'
    if (SPREADSHEET_EXTS.includes(ext)) return 'spreadsheet'
    if (ARCHIVE_EXTS.includes(ext)) return 'archive'
    if (SOFTWARE_EXTS.includes(ext)) return 'software'
    return 'other'
  }

  const validateResourceFile = (file: File, type: string): string | null => {
    if (file.size > RESOURCE_MAX_FILE_SIZE) return t('文件大小超过 100MB')
    const allowed = resourceTypeExtensionMap[type] || []
    if (allowed.length === 0) return null
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowed.includes(ext)) {
      return t('不支持的文件格式，请上传 {exts} 文件', {
        exts: allowed.map((e) => `.${e}`).join('、'),
      })
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
        toast({ title: e.message || t('上传失败'), variant: 'destructive' })
        setNewResUploading(false)
        return
      }
    }

    if (newResType === 'link' && !fileUrl) {
      toast({ title: t('请填写链接地址'), variant: 'destructive' })
      return
    }

    const localId = `res-${Date.now()}`
    const newRes: ResourceItem = {
      id: localId,
      name: newResName.trim(),
      type: newResType,
      url: fileUrl,
      description: newResDescription,
      uploadedBy: t('当前用户'),
      uploadedAt: new Date().toISOString().slice(0, 10),
      size: uploadedSize,
    }

    if (useApi && apiAvailable) {
      let createdId: string | undefined
      try {
        // 按资源类型收集表单字段进 metadata，避免创建时丢弃（场地/设施/软件等类型字段）
        const meta: Record<string, any> = {}
        if (newRes.type === 'venue') {
          if (newResAddress) meta.address = newResAddress
          if (newResOpenTime) meta.openTime = newResOpenTime
          if (newResCapacity) meta.capacity = newResCapacity
          if (newResContact) meta.contact = newResContact
        } else if (newRes.type === 'facility') {
          if (newResLocation) meta.location = newResLocation
          if (newResContact) meta.contact = newResContact
          if (newResQuantity) meta.quantity = newResQuantity
        } else if (newRes.type === 'software') {
          if (newResVersion) meta.version = newResVersion
          if (newResContact) meta.contact = newResContact
        }
        const created = await resourceLibraryApi.create({
          name: newRes.name,
          resourceType: newRes.type as ResourceKind,
          url: fileUrl || undefined,
          description: newResDescription || undefined,
          fileSize: uploadedSize,
          metadata: Object.keys(meta).length > 0 ? meta : undefined,
        })
        createdId = created.id
        newRes.id = created.id
        newRes.url = created.url || newRes.url
        setInternalPool((prev) => [newRes, ...prev])

        if (courseScope && courseId) {
          await courseResourceApi.bind({ courseId, resourceId: created.id })
        } else if (effectiveNodeId) {
          await nodeResourceApi.bind({ nodeId: effectiveNodeId, resourceId: created.id })
        }
      } catch (e: any) {
        if (createdId) {
          // 资源已创建但绑定失败：提示可重试绑定，避免用户重试时重复创建孤儿资源
          toast({
            title: t('资源已创建但绑定失败'),
            description: t('资源已保存到资源库，请重试或手动关联'),
            variant: 'destructive',
          })
        } else {
          toast({ title: e.message || t('资源保存失败'), variant: 'destructive' })
        }
        setNewResUploading(false)
        return
      }
    }

    onUpload?.(newRes)
    onChange([...selectedIds, newRes.id])
    resetUploadForm()
    setShowUpload(false)
    setShowUploadTypePicker(false)
    toast({ title: t('资源已上传并选中') })
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
              {TYPE_ICONS[t] && <span className="mr-1.5">{TYPE_ICONS[t]}</span>}
              {RESOURCE_TYPE_SHORT_LABELS[t] || t}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <SearchInput
            wrapperClassName="flex-1"
            iconClassName="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            value={resSearchName}
            onChange={setResSearchName}
            placeholder={t('搜索资源名称...')}
            inputClassName="pl-9 text-sm"
          />
          <SearchInput
            wrapperClassName="flex-1"
            icon={<Users className="h-4 w-4" />}
            iconClassName="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            value={resSearchProvider}
            onChange={setResSearchProvider}
            placeholder={t('搜索资源提供者...')}
            inputClassName="pl-9 text-sm"
          />
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            {t('重置')}
          </Button>
          <Button size="sm" className="h-9 text-xs" onClick={() => setShowUploadTypePicker(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            {t('上传资源')}
          </Button>
        </div>
      </div>

      <div className={cn('flex gap-4', standalone ? 'min-h-[320px]' : 'h-full min-h-0')}>
        {/* Left: Resource cards grid */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 border rounded-xl p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <p className="text-sm font-medium text-gray-700">
              {t('资源列表')}{' '}
              <span className="text-gray-400 font-normal">({filteredRes.length})</span>
            </p>
            {loadingPool && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          <div className="flex-1 overflow-y-auto pr-1 min-w-0">
            {filteredRes.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('未找到匹配的资源')}</p>
                <p className="text-xs mt-1">{t('尝试调整筛选条件或上传新资源')}</p>
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
                                TYPE_BADGE[r.type] || 'bg-gray-50 border-gray-200',
                              )}
                            >
                              {TYPE_ICONS[r.type] || (
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
                            className={cn('text-[9px] border', TYPE_BADGE[r.type] || '')}
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
                          {t('预览')}
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
                          {selected ? t('已选择') : t('选择')}
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
            <p className="text-sm font-semibold text-gray-700">{t('已选资源')}</p>
            <Badge variant="secondary" className="text-[10px]">
              {selectedIds.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {selectedIds.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">{t('请从左侧选择资源')}</p>
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
                        TYPE_BADGE[r.type] || 'bg-gray-50',
                      )}
                    >
                      {TYPE_ICONS[r.type] || <Package className="h-4 w-4 text-gray-400" />}
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
            <DialogTitle>{t('选择资源类型')}</DialogTitle>
            <DialogDescription>{t('请选择要上传的资源类型')}</DialogDescription>
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
                    TYPE_BADGE[t] || 'bg-gray-50 border-gray-200',
                  )}
                >
                  {TYPE_ICONS[t] || <Package className="h-5 w-5 text-gray-400" />}
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
            <DialogTitle>{t('上传资源')}</DialogTitle>
            <DialogDescription>{t('补充本地资源，上传后将自动选中')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>{t('资源名称')}</Label>
              <Input
                value={newResName}
                onChange={(e) => setNewResName(e.target.value)}
                placeholder={t('输入资源名称')}
                className="mt-1.5"
              />
            </div>

            {newResType === 'link' && (
              <div>
                <Label>{t('URL 地址')}</Label>
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
                  <Label>{t('场地地址')}</Label>
                  <Input
                    value={newResAddress}
                    onChange={(e) => setNewResAddress(e.target.value)}
                    placeholder={t('输入场地详细地址')}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>{t('开放时间')}</Label>
                  <Input
                    value={newResOpenTime}
                    onChange={(e) => setNewResOpenTime(e.target.value)}
                    placeholder={t('例如：周一至周五 09:00-18:00')}
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t('容纳人数')}</Label>
                    <Input
                      value={newResCapacity}
                      onChange={(e) => setNewResCapacity(e.target.value)}
                      placeholder={t('例如：50人')}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>{t('联系人/电话')}</Label>
                    <Input
                      value={newResContact}
                      onChange={(e) => setNewResContact(e.target.value)}
                      placeholder={t('输入联系人或电话')}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </>
            )}

            {newResType === 'facility' && (
              <>
                <div>
                  <Label>{t('所在位置')}</Label>
                  <Input
                    value={newResLocation}
                    onChange={(e) => setNewResLocation(e.target.value)}
                    placeholder={t('输入设施所在位置')}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>{t('数量')}</Label>
                  <Input
                    value={newResQuantity}
                    onChange={(e) => setNewResQuantity(e.target.value)}
                    placeholder={t('输入设施数量')}
                    className="mt-1.5"
                  />
                </div>
              </>
            )}

            {newResType === 'software' && (
              <>
                <div>
                  <Label>{t('版本号')}</Label>
                  <Input
                    value={newResVersion}
                    onChange={(e) => setNewResVersion(e.target.value)}
                    placeholder={t('例如：v2.1.0')}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>{t('下载链接')}</Label>
                  <Input
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>{t('授权信息')}</Label>
                  <Input
                    value={newResLicense}
                    onChange={(e) => setNewResLicense(e.target.value)}
                    placeholder={t('例如：MIT / 商业授权 / 校内授权')}
                    className="mt-1.5"
                  />
                </div>
              </>
            )}

            <div>
              <Label>{t('资源描述')}</Label>
              <Textarea
                value={newResDescription}
                onChange={(e) => setNewResDescription(e.target.value)}
                placeholder={t('输入资源简介、用途说明等')}
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
                      {formatSize(newResFile.size)}
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
                      <p className="text-sm font-medium text-gray-700">{t('点击或拖拽上传文件')}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {resourceTypeAccept[newResType]
                          ? t('支持 {exts}，最大 100MB', { exts: resourceTypeAccept[newResType] })
                          : t('支持多种格式，最大 100MB')}
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
              {t('取消')}
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
              {t('上传并选中')}
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
              {TYPE_ICONS[r.type] && (
                <span className="mr-1">{TYPE_ICONS[r.type]}</span>
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
            {t('添加课程资源')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('添加课程资源')}</DialogTitle>
            <DialogDescription>{t('从资源库中选择或上传新资源')}</DialogDescription>
          </DialogHeader>

          {selectionContent}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {subDialogs}
    </div>
  )
}
