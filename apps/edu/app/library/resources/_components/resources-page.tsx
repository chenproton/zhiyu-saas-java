'use client'

import { useMemo, useState } from 'react'
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  X,
  Eye,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  RESOURCE_TYPE_LABELS,
  type ResourceKind,
  type ResourceLibraryItem,
} from '@/lib/types/library'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  TYPE_ICONS,
  TYPE_COLORS,
  TYPE_BG,
  formatSize,
  fileTypesWithUpload,
} from '@/lib/resource-type-constants'
import { useResourceCrud } from './use-resource-crud'
import { ResourceUploadZone } from './resource-upload-zone'

const TYPE_LABEL_MAP: Record<string, string> = RESOURCE_TYPE_LABELS
const ALL_TYPES = [
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

/**
 * 教学资源库列表页（通用总览 / 单类型视图共用）。
 * 传入 resourceType 时呈现单类型视图（固定类型、无筛选芯片、弹窗类型徽标），
 * 否则呈现总览视图（统计卡片 + 类型筛选 + 弹窗内选择类型）。
 */
export function ResourcesPage({ resourceType }: { resourceType?: ResourceKind }) {
  const isTypeView = !!resourceType
  const typeLabel = resourceType ? RESOURCE_TYPE_LABELS[resourceType] || resourceType : '资源'
  const typeColor = resourceType ? TYPE_COLORS[resourceType] || '#78716c' : undefined
  const typeBg = resourceType ? TYPE_BG[resourceType] || 'bg-slate-50' : undefined
  const typeIcon = resourceType ? TYPE_ICONS[resourceType] || TYPE_ICONS.other : undefined

  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const [dialogType, setDialogType] = useState('document')

  const {
    items: allItems,
    loading,
    searchQuery,
    setSearchQuery,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    name,
    setName,
    url,
    setUrl,
    description,
    setDescription,
    uploadFile,
    setUploadFile,
    uploading,
    deleteTarget,
    setDeleteTarget,
    handleOpenAdd,
    handleOpenEdit,
    confirmDelete,
    handleResFileDrop,
    handleFileSelect,
    handleSubmit,
  } = useResourceCrud(resourceType)

  // 单类型视图提交类型固定；总览视图跟随弹窗内选择
  const submitType = resourceType || dialogType

  const searched = useMemo(() => {
    if (!searchQuery) return allItems
    const q = searchQuery.toLowerCase()
    return allItems.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q),
    )
  }, [allItems, searchQuery])

  const items = useMemo(() => {
    if (typeFilters.length === 0) return searched
    return searched.filter((r) => typeFilters.includes(r.resourceType))
  }, [searched, typeFilters])

  // 总览视图统计卡片基于筛选后数据；单类型视图统计该类型全部数据
  const statCount = isTypeView ? allItems.length : items.length

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      counts[item.resourceType] = (counts[item.resourceType] || 0) + 1
    }
    return counts
  }, [items])

  const toggleTypeFilter = (t: string) => {
    setTypeFilters((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const handleOpenAddWithType = () => {
    handleOpenAdd()
    setDialogType('document')
  }

  const handleOpenEditWithType = (item: ResourceLibraryItem) => {
    handleOpenEdit(item)
    setDialogType(item.resourceType)
  }

  const tableColSpan = isTypeView ? 5 : 6

  return (
    <div className="p-6 space-y-5">
      {isTypeView ? (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${typeBg} flex items-center justify-center`}>
              <span style={{ color: typeColor }}>{typeIcon}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">{statCount}</div>
              <div className="text-xs text-blue-500">{typeLabel}总数</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <HelpCircle className="size-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">{statCount}</div>
                <div className="text-xs text-blue-500">资源总数</div>
              </div>
            </CardContent>
          </Card>
          {Object.entries(typeCounts)
            .slice(0, 5)
            .map(([type, count]) => (
              <Card key={type} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg ${TYPE_BG[type] || 'bg-slate-50'} flex items-center justify-center`}
                  >
                    <span style={{ color: TYPE_COLORS[type] || '#78716c' }}>
                      {TYPE_ICONS[type] || TYPE_ICONS.other}
                    </span>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-700">{count}</div>
                    <div className="text-xs text-slate-400">{TYPE_LABEL_MAP[type] || type}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {!isTypeView && (
        <div className="bg-white rounded-xl p-3 flex gap-2 flex-wrap items-center border border-slate-100 shadow-sm">
          <span className="text-sm text-slate-400 mr-1 shrink-0">类型筛选：</span>
          {ALL_TYPES.map((type) => {
            const active = typeFilters.includes(type)
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border-none"
                style={{
                  background: active ? TYPE_COLORS[type] : '#f8fafc',
                  color: active ? '#fff' : '#64748b',
                  border: `1px solid ${active ? TYPE_COLORS[type] : '#e2e8f0'}`,
                  boxShadow: active ? `0 2px 8px ${TYPE_COLORS[type]}30` : 'none',
                }}
              >
                <span style={{ color: active ? '#fff' : TYPE_COLORS[type] }}>
                  {TYPE_ICONS[type] || TYPE_ICONS.other}
                </span>
                {TYPE_LABEL_MAP[type] || '其他'}
                <span className="tabular-nums opacity-60">{typeCounts[type] || 0}</span>
                {active && <X className="size-3 ml-0.5" />}
              </button>
            )
          })}
          {(typeFilters.length > 0 || searchQuery) && (
            <button
              onClick={() => {
                setTypeFilters([])
                setSearchQuery('')
              }}
              className="ml-auto px-3 py-1.5 text-xs text-red-400 hover:text-red-600 font-medium border border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
            >
              清除筛选
            </button>
          )}
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">
            {isTypeView ? typeLabel : '教学资源库'}
          </CardTitle>
          <Button onClick={handleOpenAddWithType} size="sm">
            <Plus className="size-4 mr-1" />
            新增资源
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={isTypeView ? `搜索${typeLabel}...` : '搜索资源名称...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    资源
                  </TableHead>
                  {!isTypeView && (
                    <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      类型
                    </TableHead>
                  )}
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    链接
                  </TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    大小
                  </TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    描述
                  </TableHead>
                  <TableHead className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={tableColSpan}
                      className="p-12 text-center text-muted-foreground"
                    >
                      加载中...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={tableColSpan} className="p-12 text-center">
                      <div className="text-muted-foreground">暂无数据</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleOpenAddWithType}
                      >
                        <Plus className="size-3 mr-1" />
                        新增第一条资源
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => {
                  const color = TYPE_COLORS[item.resourceType] || '#78716c'
                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg ${TYPE_BG[item.resourceType] || 'bg-slate-50'} flex items-center justify-center shrink-0`}
                          >
                            <span style={{ color }}>
                              {TYPE_ICONS[item.resourceType] || TYPE_ICONS.other}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      {!isTypeView && (
                        <TableCell className="p-3">
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ color, borderColor: color }}
                          >
                            {TYPE_LABEL_MAP[item.resourceType] || item.resourceType}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="p-3 hidden md:table-cell">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="size-3" />
                            访问
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="p-3 text-xs text-slate-400 hidden md:table-cell">
                        {formatSize(item.fileSize)}
                      </TableCell>
                      <TableCell className="p-3 text-xs text-slate-400 hidden lg:table-cell max-w-[200px] truncate">
                        {item.description || '-'}
                      </TableCell>
                      <TableCell className="p-3 text-right whitespace-nowrap">
                        {item.url && fileTypesWithUpload.includes(item.resourceType) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addPreviewResource(item as any)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditWithType(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="确认删除"
        description="确定要删除该资源吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '编辑资源' : isTypeView ? '新增资源' : '上传资源到公共库'}
            </DialogTitle>
            <DialogDescription>
              {isTypeView ? `上传本地资源到${typeLabel}` : '补充本地资源，上传后将加入资源公共库'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {isTypeView && (
              <div>
                <Label>资源类型</Label>
                <Badge
                  variant="outline"
                  className="ml-2 text-xs"
                  style={{ color: typeColor, borderColor: typeColor }}
                >
                  {typeLabel}
                </Badge>
              </div>
            )}
            <div>
              <Label>资源名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入资源名称"
                className="mt-1.5"
              />
            </div>
            {!isTypeView && !editingItem && (
              <div>
                <Label>资源类型</Label>
                <Select
                  value={dialogType}
                  onValueChange={(v) => {
                    setDialogType(v)
                    setUploadFile(null)
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {submitType === 'link' && (
              <div>
                <Label>URL 地址</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1.5"
                />
              </div>
            )}

            <div>
              <Label>资源描述</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入资源简介、用途说明等"
                className="mt-1.5"
                rows={2}
              />
            </div>

            {fileTypesWithUpload.includes(submitType) && (
              <ResourceUploadZone
                resourceType={submitType}
                uploadFile={uploadFile}
                uploading={uploading}
                onFileDrop={(e) => handleResFileDrop(e, submitType)}
                onFileSelect={(file) => handleFileSelect(file, submitType)}
                onClear={() => setUploadFile(null)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => handleSubmit(submitType)} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingItem ? '保存' : '上传到资源库'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewResources.length > 0 && (
        <div
          className="fixed inset-0 bg-black/40 z-[90]"
          onClick={() => previewResources.forEach((r) => removePreviewResource(r.id))}
        />
      )}
      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}
    </div>
  )
}
