'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  Users,
  RotateCcw,
  Upload,
  Package,
  CheckCircle2,
  Eye,
  X,
  FileText,
  Table,
  Image,
  Link2,
  Headphones,
  Video,
  Archive,
  MapPin,
  Building2,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ResourceItem } from './atomic-modules'

// ==================== Types ====================

interface LearningResource {
  id: string
  name: string
  type: ResourceType
  url: string
  size?: string
  description?: string
  knowledgePoints: string[]
  uploadedAt: string
  uploadedBy: string
  thumbnail?: string
}

type ResourceType =
  | 'document'
  | 'spreadsheet'
  | 'image'
  | 'link'
  | 'audio'
  | 'video'
  | 'archive'
  | 'venue'
  | 'facility'
  | 'software'
  | 'other'

// ==================== Constants ====================

const resourceTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4 text-blue-500" />,
  spreadsheet: <Table className="h-4 w-4 text-teal-500" />,
  image: <Image className="h-4 w-4 text-green-500" aria-label="图片" />,
  link: <Link2 className="h-4 w-4 text-cyan-500" />,
  audio: <Headphones className="h-4 w-4 text-violet-500" />,
  video: <Video className="h-4 w-4 text-red-500" />,
  archive: <Archive className="h-4 w-4 text-amber-500" />,
  venue: <MapPin className="h-4 w-4 text-orange-500" />,
  facility: <Building2 className="h-4 w-4 text-rose-500" />,
  software: <Globe className="h-4 w-4 text-purple-500" />,
  other: <Package className="h-4 w-4 text-gray-500" />,
}

const resourceTypeLabels: Record<string, string> = {
  all: '全部',
  document: '文档资源',
  spreadsheet: '表格资源',
  image: '图片资源',
  link: '链接资源',
  audio: '音频资源',
  video: '视频资源',
  archive: '压缩包资源',
  venue: '场地资源',
  facility: '设施设备资源',
  software: '软件资源',
  other: '其他资源',
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

const resourceTypes: ResourceType[] = [
  'document',
  'spreadsheet',
  'image',
  'link',
  'audio',
  'video',
  'archive',
  'venue',
  'facility',
  'software',
  'other',
]

const allFilterTypes = ['all', ...resourceTypes]

const typeToItemType: Partial<Record<ResourceType, ResourceItem['type']>> = {
  document: 'material',
  spreadsheet: 'material',
  image: 'material',
  link: 'system',
  audio: 'granular',
  video: 'granular',
  archive: 'material',
  venue: 'simulation',
  facility: 'simulation',
  software: 'system',
  other: 'custom',
}

const getItemType = (t: ResourceType): ResourceItem['type'] => typeToItemType[t] || 'custom'

// 教学资源数据待接入资源中心，默认空状态
const INITIAL_LEARNING_RESOURCES: LearningResource[] = []

// ==================== Component ====================

interface TeachingResourceSelectorProps {
  items: ResourceItem[]
  onChange: (items: ResourceItem[]) => void
}

export function TeachingResourceSelector({ items, onChange }: TeachingResourceSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resType, setResType] = useState('all')
  const [resSearchName, setResSearchName] = useState('')
  const [resSearchProvider, setResSearchProvider] = useState('')

  const [learningResources, setLearningResources] = useState(
    INITIAL_LEARNING_RESOURCES.map((r) => ({ ...r })),
  )

  const [selectedResIds, setSelectedResIds] = useState<string[]>([])

  const [showUploadTypePicker, setShowUploadTypePicker] = useState(false)
  const [showUploadRes, setShowUploadRes] = useState(false)
  const [newResName, setNewResName] = useState('')
  const [newResType, setNewResType] = useState<ResourceType>('document')
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

  const filteredRes = useMemo(
    () =>
      learningResources.filter((r) => {
        const matchType = resType === 'all' || r.type === resType
        const matchName = !resSearchName || r.name.includes(resSearchName)
        const matchProvider = !resSearchProvider || r.uploadedBy.includes(resSearchProvider)
        return matchType && matchName && matchProvider
      }),
    [learningResources, resType, resSearchName, resSearchProvider],
  )

  const openDialog = () => {
    setSelectedResIds(items.map((i) => i.id))
    setDialogOpen(true)
  }

  const resetFilters = () => {
    setResType('all')
    setResSearchName('')
    setResSearchProvider('')
  }

  const toggleResource = (rid: string) => {
    setSelectedResIds((prev) =>
      prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid],
    )
  }

  const handleSave = () => {
    const result: ResourceItem[] = selectedResIds
      .map((rid) => {
        const r = learningResources.find((x) => x.id === rid)
        if (!r) return null
        return {
          id: r.id,
          name: r.name,
          type: getItemType(r.type),
          source: `${resourceTypeLabels[r.type] || r.type}库`,
        }
      })
      .filter((x): x is ResourceItem => x !== null)
    onChange(result)
    setDialogOpen(false)
  }

  const handleUploadResource = () => {
    if (!newResName.trim()) return
    const newId = `lr-upload-${Date.now()}`
    let extraData: Record<string, unknown> = {}
    switch (newResType) {
      case 'link':
        extraData = { url: newResUrl.trim(), description: newResDescription.trim() }
        break
      case 'venue':
        extraData = {
          address: newResAddress.trim(),
          openTime: newResOpenTime.trim(),
          capacity: newResCapacity.trim(),
          contact: newResContact.trim(),
          description: newResDescription.trim(),
        }
        break
      case 'facility':
        extraData = {
          location: newResLocation.trim(),
          quantity: newResQuantity.trim(),
          description: newResDescription.trim(),
        }
        break
      case 'software':
        extraData = {
          version: newResVersion.trim(),
          url: newResUrl.trim(),
          license: newResLicense.trim(),
          description: newResDescription.trim(),
        }
        break
      default:
        extraData = { description: newResDescription.trim() }
        break
    }
    const newRes: LearningResource = {
      id: newId,
      name: newResName.trim(),
      type: newResType,
      url: newResUrl.trim() || '',
      description: newResDescription.trim(),
      knowledgePoints: [],
      uploadedAt: new Date().toISOString().slice(0, 10),
      uploadedBy: '当前用户',
      thumbnail: '/placeholder.svg',
      ...extraData,
    } as LearningResource
    setLearningResources((prev) => [...prev, newRes])
    setSelectedResIds((prev) => [...prev, newId])
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
    setShowUploadRes(false)
  }

  const openUploadFromAll = () => {
    if (resType === 'all') {
      setShowUploadTypePicker(true)
    } else {
      setNewResType(resType as ResourceType)
      setShowUploadRes(true)
    }
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const lr = learningResources.find((r) => r.id === item.id)
            return (
              <div
                key={item.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0',
                      resourceTypeColors[lr?.type || 'other'] || 'bg-gray-50',
                    )}
                  >
                    {resourceTypeIcons[lr?.type || 'other'] || (
                      <Package className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.source}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(items.filter((_, i) => items.indexOf(item) !== i))}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={openDialog}>
        <Package className="h-4 w-4 mr-1" />
        配置教学资源
      </Button>

      {/* Main Resource Selection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] max-h-[95vh] h-[95vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded">
                <Link2 className="h-4 w-4" />
              </div>
              配置教学资源
            </DialogTitle>
            <DialogDescription>选择或上传教学资源</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col py-4">
            {/* Toolbar */}
            <div className="shrink-0 space-y-3 mb-4">
              <div className="flex gap-1.5 flex-wrap">
                {allFilterTypes.map((t) => (
                  <Button
                    key={t}
                    variant={resType === t ? 'default' : 'outline'}
                    size="sm"
                    className={cn('text-xs h-7', resType === t ? '' : 'bg-white')}
                    onClick={() => setResType(t)}
                  >
                    {t !== 'all' && resourceTypeIcons[t] && (
                      <span className="mr-1.5">{resourceTypeIcons[t]}</span>
                    )}
                    {resourceTypeLabels[t] || t}
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
                <Button size="sm" className="h-9 text-xs" onClick={openUploadFromAll}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  上传资源
                </Button>
              </div>
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
              {/* Left: Resource cards grid */}
              <div className="flex-1 flex flex-col min-h-0 border rounded-xl p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-sm font-medium text-gray-700">
                    资源列表{' '}
                    <span className="text-gray-400 font-normal">({filteredRes.length})</span>
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
                  {filteredRes.length === 0 ? (
                    <div className="text-center text-gray-400 py-16">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">未找到匹配的资源</p>
                      <p className="text-xs mt-1">尝试调整筛选条件</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filteredRes.map((r) => {
                        const selected = selectedResIds.includes(r.id)
                        return (
                          <div
                            key={r.id}
                            className={cn(
                              'relative rounded-lg border overflow-hidden transition-all cursor-pointer group',
                              selected
                                ? 'border-primary shadow-sm ring-1 ring-primary/10'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white',
                            )}
                          >
                            <div className="relative h-20 bg-gray-50 border-b border-gray-100 overflow-hidden">
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
                              {selected && (
                                <div className="absolute top-1.5 right-1.5 bg-primary text-white rounded-full p-0.5 shadow-sm">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <div className="absolute bottom-1.5 left-1.5">
                                <Badge
                                  className={cn(
                                    'text-[9px] border',
                                    resourceTypeColors[r.type] || '',
                                  )}
                                >
                                  {resourceTypeLabels[r.type] || r.type}
                                </Badge>
                              </div>
                            </div>
                            <div className="p-2" onClick={() => toggleResource(r.id)}>
                              <p className="text-xs font-medium text-gray-800 truncate mb-1">
                                {r.name}
                              </p>
                              <div className="flex items-center justify-between text-[11px] text-gray-500">
                                <span className="flex items-center gap-1 truncate max-w-[80px]">
                                  <Users className="h-3 w-3 shrink-0" />
                                  {r.uploadedBy}
                                </span>
                                <span className="shrink-0">{r.uploadedAt}</span>
                              </div>
                            </div>
                            <div className="px-2 pb-2 flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-1.5 flex-1 text-gray-500 hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(r.url || '#', '_blank')
                                }}
                              >
                                <Eye className="h-3 w-3 mr-0.5" />
                                预览
                              </Button>
                              <Button
                                variant={selected ? 'outline' : 'default'}
                                size="sm"
                                className="h-6 text-[10px] px-1.5 flex-1"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleResource(r.id)
                                }}
                              >
                                {selected ? '取消' : '选择'}
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
              <div className="w-72 shrink-0 flex flex-col min-h-0 border rounded-xl p-4 bg-gray-50/50 overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <p className="text-sm font-semibold text-gray-700">已选资源</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedResIds.length}
                  </Badge>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {selectedResIds.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">请从左侧选择资源</p>
                    </div>
                  ) : (
                    selectedResIds.map((rid) => {
                      const r = learningResources.find((res) => res.id === rid)
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
                            {resourceTypeIcons[r.type] || (
                              <Package className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate text-gray-800">{r.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {r.uploadedBy} · {r.uploadedAt}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-red-500 shrink-0"
                            onClick={() => toggleResource(rid)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Upload Type Picker Dialog */}
            <Dialog open={showUploadTypePicker} onOpenChange={setShowUploadTypePicker}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>选择资源类型</DialogTitle>
                  <DialogDescription>请选择要上传的资源类型</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4">
                  {resourceTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setNewResType(t)
                        setShowUploadTypePicker(false)
                        setShowUploadRes(true)
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
                        {resourceTypeLabels[t] || t}
                      </span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Upload Resource Dialog */}
            <Dialog open={showUploadRes} onOpenChange={setShowUploadRes}>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>上传资源到公共库</DialogTitle>
                  <DialogDescription>
                    补充本地资源，上传后将加入资源公共库并自动选中
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
                  <FormFieldRow label="资源名称">
                    <Input
                      value={newResName}
                      onChange={(e) => setNewResName(e.target.value)}
                      placeholder="输入资源名称"
                      className="mt-1.5"
                    />
                  </FormFieldRow>

                  {/* Link type: URL */}
                  {newResType === 'link' && (
                    <FormFieldRow label="URL 地址">
                      <Input
                        value={newResUrl}
                        onChange={(e) => setNewResUrl(e.target.value)}
                        placeholder="https://..."
                        className="mt-1.5"
                      />
                    </FormFieldRow>
                  )}

                  {/* Venue type */}
                  {newResType === 'venue' && (
                    <>
                      <FormFieldRow label="场地地址">
                        <Input
                          value={newResAddress}
                          onChange={(e) => setNewResAddress(e.target.value)}
                          placeholder="输入场地详细地址"
                          className="mt-1.5"
                        />
                      </FormFieldRow>
                      <FormFieldRow label="开放时间">
                        <Input
                          value={newResOpenTime}
                          onChange={(e) => setNewResOpenTime(e.target.value)}
                          placeholder="例如：周一至周五 09:00-18:00"
                          className="mt-1.5"
                        />
                      </FormFieldRow>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormFieldRow label="容纳人数">
                          <Input
                            value={newResCapacity}
                            onChange={(e) => setNewResCapacity(e.target.value)}
                            placeholder="例如：50人"
                            className="mt-1.5"
                          />
                        </FormFieldRow>
                        <FormFieldRow label="联系人/电话">
                          <Input
                            value={newResContact}
                            onChange={(e) => setNewResContact(e.target.value)}
                            placeholder="输入联系人或电话"
                            className="mt-1.5"
                          />
                        </FormFieldRow>
                      </div>
                    </>
                  )}

                  {/* Facility type */}
                  {newResType === 'facility' && (
                    <>
                      <FormFieldRow label="所在位置">
                        <Input
                          value={newResLocation}
                          onChange={(e) => setNewResLocation(e.target.value)}
                          placeholder="输入设施所在位置"
                          className="mt-1.5"
                        />
                      </FormFieldRow>
                      <FormFieldRow label="数量">
                        <Input
                          value={newResQuantity}
                          onChange={(e) => setNewResQuantity(e.target.value)}
                          placeholder="输入设施数量"
                          className="mt-1.5"
                        />
                      </FormFieldRow>
                    </>
                  )}

                  {/* Software type */}
                  {newResType === 'software' && (
                    <>
                      <FormFieldRow label="版本号">
                        <Input
                          value={newResVersion}
                          onChange={(e) => setNewResVersion(e.target.value)}
                          placeholder="例如：v2.1.0"
                          className="mt-1.5"
                        />
                      </FormFieldRow>
                      <FormFieldRow label="下载链接">
                        <Input
                          value={newResUrl}
                          onChange={(e) => setNewResUrl(e.target.value)}
                          placeholder="https://..."
                          className="mt-1.5"
                        />
                      </FormFieldRow>
                      <FormFieldRow label="授权信息">
                        <Input
                          value={newResLicense}
                          onChange={(e) => setNewResLicense(e.target.value)}
                          placeholder="例如：MIT / 商业授权 / 校内授权"
                          className="mt-1.5"
                        />
                      </FormFieldRow>
                    </>
                  )}

                  {/* Description for all types */}
                  <FormFieldRow label="资源描述">
                    <Textarea
                      value={newResDescription}
                      onChange={(e) => setNewResDescription(e.target.value)}
                      placeholder="输入资源简介、用途说明等"
                      className="mt-1.5"
                      rows={2}
                    />
                  </FormFieldRow>

                  {/* File upload */}
                  {[
                    'document',
                    'spreadsheet',
                    'image',
                    'audio',
                    'video',
                    'archive',
                    'other',
                  ].includes(newResType) && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">点击或拖拽上传文件</p>
                        <p className="text-xs text-gray-500 mt-1">支持多种格式，最大 100MB</p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowUploadRes(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={handleUploadResource}
                    disabled={!newResName.trim() || (newResType === 'link' && !newResUrl.trim())}
                  >
                    上传并选中
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
