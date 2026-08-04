import { useCallback, useEffect, useState, useRef } from 'react'
import { resourceLibraryApi, fileApi } from '@/lib/api'
import { type ResourceLibraryItem } from '@/lib/types/library'
import { useToast } from '@zhiyu/ui'
import { fileTypesWithUpload, validateResourceFile } from '@/lib/resource-type-constants'

export function useResourceCrud(resourceType?: string) {
  const { toast } = useToast()
  const resFileInputRef = useRef<HTMLInputElement>(null)

  const [items, setItems] = useState<ResourceLibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ResourceLibraryItem | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const isFileType =
    fileTypesWithUpload.includes(resourceType || '') ||
    (editingItem ? fileTypesWithUpload.includes(editingItem.resourceType) : false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await resourceLibraryApi.list({
        ...(resourceType ? { resourceType: resourceType as any } : {}),
        limit: 500,
      })
      setItems(res.items)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '无法获取资源列表',
      })
    } finally {
      setLoading(false)
    }
  }, [resourceType, toast])

  useEffect(() => {
    ;(async () => {
      await loadItems()
    })()
  }, [loadItems])

  const resetDialog = () => {
    setName('')
    setUrl('')
    setDescription('')
    setUploadFile(null)
    setUploading(false)
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    resetDialog()
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: ResourceLibraryItem) => {
    setEditingItem(item)
    setName(item.name)
    setUrl(item.url || '')
    setDescription(item.description || '')
    setUploadFile(null)
    setUploading(false)
    setIsDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await resourceLibraryApi.delete(deleteTarget)
      toast({ title: '删除成功' })
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '删除失败', description: err.message })
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
        toast({ variant: 'destructive', title: '文件校验失败', description: err })
        return
      }
      setUploadFile(file)
    }
  }

  const handleFileSelect = (file: File, fileType: string) => {
    const err = validateResourceFile(file, fileType)
    if (err) {
      toast({ variant: 'destructive', title: '文件校验失败', description: err })
      return
    }
    setUploadFile(file)
  }

  const handleSubmit = async (submitType: string) => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: '名称不能为空' })
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
        toast({ variant: 'destructive', title: '文件上传失败', description: err.message })
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
      if (editingItem) {
        await resourceLibraryApi.update(editingItem.id, payload as any)
        toast({ title: '更新成功' })
      } else {
        await resourceLibraryApi.create(payload as any)
        toast({ title: '创建成功' })
      }
      setIsDialogOpen(false)
      loadItems()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存失败', description: err.message })
    }
  }

  return {
    items,
    loading,
    searchQuery,
    setSearchQuery,
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
    resFileInputRef,
    loadItems,
    handleOpenAdd,
    handleOpenEdit,
    confirmDelete,
    handleResFileDrop,
    handleFileSelect,
    handleSubmit,
  }
}
