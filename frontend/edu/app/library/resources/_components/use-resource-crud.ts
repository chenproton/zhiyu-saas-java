import { useCallback, useEffect, useState, useRef } from 'react'
import { resourceLibraryApi, fileApi, tagApi } from '@/lib/api'
import { type ResourceLibraryItem } from '@/lib/types/library'
import { TAG_RESOURCE_TYPES } from '@/lib/types/library'
import { useToast } from '@zhiyu/ui'
import { fileTypesWithUpload, validateResourceFile } from '@/lib/resource-type-constants'
import { useT } from '@/lib/i18n/locale-provider'

const PAGE_SIZE = 200

export function useResourceCrud(resourceType?: string) {
  const { toast } = useToast()
  const t = useT()

  const [items, setItems] = useState<ResourceLibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ResourceLibraryItem | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const isFileType =
    fileTypesWithUpload.includes(resourceType || '') ||
    (editingItem ? fileTypesWithUpload.includes(editingItem.resourceType) : false)

  // 请求序号：过滤条件快速变化时丢弃过期响应，避免旧结果覆盖新筛选
  const loadSeqRef = useRef(0)

  const loadItems = useCallback(async () => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const res = await resourceLibraryApi.list({
        ...(resourceType ? { resourceType: resourceType as any } : {}),
        ...(filterType && !resourceType ? { resourceType: filterType } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedTagIds.length ? { tagIds: selectedTagIds.join(',') } : {}),
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      if (seq !== loadSeqRef.current) return
      const totalPages = Math.max(1, Math.ceil((res.total ?? 0) / PAGE_SIZE))
      if (page > totalPages) {
        setPage(totalPages)
        return
      }
      setItems(res.items)
      setTotal(res.total ?? 0)
    } catch (err: any) {
      if (seq !== loadSeqRef.current) return
      toast({
        variant: 'destructive',
        title: t('加载失败'),
        description: err.message || t('无法获取资源列表'),
      })
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }, [resourceType, filterType, searchQuery, selectedTagIds, page, toast, t])

  useEffect(() => {
    ;(async () => {
      await loadItems()
    })()
  }, [loadItems])

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    setPage(1)
  }

  const handleTypeFilterChange = (t: string | null) => {
    setFilterType(t)
    setPage(1)
  }

  const handleTagFilterChange = (ids: string[]) => {
    setSelectedTagIds(ids)
    setPage(1)
  }

  const resetDialog = () => {
    setName('')
    setUrl('')
    setDescription('')
    setTagIds([])
    setUploadFile(null)
    setUploading(false)
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    resetDialog()
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: ResourceLibraryItem, tags: string[] = []) => {
    setEditingItem(item)
    setName(item.name)
    setUrl(item.url || '')
    setDescription(item.description || '')
    setTagIds(tags)
    setUploadFile(null)
    setUploading(false)
    setIsDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await resourceLibraryApi.delete(deleteTarget)
      toast({ title: t('删除成功') })
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('删除失败'), description: err.message })
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleResFileDrop = (e: React.DragEvent, fileType: string) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file && fileTypesWithUpload.includes(fileType)) {
      const err = validateResourceFile(file, fileType)
      if (err) {
        toast({ variant: 'destructive', title: t('文件校验失败'), description: t(err) })
        return
      }
      setUploadFile(file)
    }
  }

  const handleFileSelect = (file: File, fileType: string) => {
    const err = validateResourceFile(file, fileType)
    if (err) {
      toast({ variant: 'destructive', title: t('文件校验失败'), description: t(err) })
      return
    }
    setUploadFile(file)
  }

  const handleSubmit = async (submitType: string) => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: t('名称不能为空') })
      return
    }

    let finalUrl = url.trim()
    let finalSize: number | undefined = editingItem?.fileSize ?? undefined

    // 通用资源页未传 resourceType 时，按提交的类型（submitType）推断是否为文件类型
    const willUploadFile = isFileType || fileTypesWithUpload.includes(submitType)

    if (willUploadFile && uploadFile) {
      setUploading(true)
      try {
        const res = await fileApi.upload(uploadFile)
        finalUrl = res.url
        finalSize = res.size
      } catch (err: any) {
        toast({ variant: 'destructive', title: t('文件上传失败'), description: err.message })
        setUploading(false)
        return
      } finally {
        setUploading(false)
      }
    }

    const payload = {
      name: name.trim(),
      resourceType: submitType as any,
      url: finalUrl || undefined,
      description: description.trim() || undefined,
      thumbnail: submitType === 'image' ? finalUrl || undefined : undefined,
      fileSize: finalSize,
    }

    try {
      let targetId = editingItem?.id
      if (editingItem) {
        await resourceLibraryApi.update(editingItem.id, payload as any)
        toast({ title: t('更新成功') })
      } else {
        const created = await resourceLibraryApi.create(payload as any)
        targetId = created?.id
        toast({ title: t('创建成功') })
      }
      try {
        // 实体已保存成功，标签失败单独提示（重试仅补标签，不会重复创建实体）
        if (targetId) {
          await tagApi.setBindings({
            resourceType: TAG_RESOURCE_TYPES.resource_library,
            resourceId: targetId,
            tagIds,
          })
        }
      } catch {
        toast({ variant: 'destructive', title: t('标签保存失败'), description: t('实体已保存，标签未关联，可再次保存重试') })
      }
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('保存失败'), description: err.message })
    }
  }

  return {
    items,
    loading,
    searchQuery,
    setSearchQuery: handleSearchChange,
    filterType,
    setFilterType: handleTypeFilterChange,
    selectedTagIds,
    handleTagFilterChange,
    tagIds,
    setTagIds,
    total,
    page,
    setPage,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    setEditingItem,
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
    isFileType,
    loadItems,
    handleOpenAdd,
    handleOpenEdit,
    confirmDelete,
    handleResFileDrop,
    handleFileSelect,
    handleSubmit,
  }
}
