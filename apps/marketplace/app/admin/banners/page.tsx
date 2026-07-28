"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ConfirmDialog } from "@zhiyu/ui"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, Trash2, ImageIcon, Loader2, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { bannerApi, type Banner } from "@/lib/api"

export default function AdminBannersPage() {
  const { toast } = useToast()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    link: "",
    sort: "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: "" })

  const fetchBanners = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await bannerApi.list()
      setBanners(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载轮播图失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners()
  }, [])

  const resetForm = () => {
    setFormData({ title: "", link: "", sort: "" })
    setImageFile(null)
    setImagePreview(null)
    setEditingBanner(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner)
    setFormData({
      title: banner.title,
      link: banner.link,
      sort: String(banner.sort),
    })
    setImagePreview(banner.image)
    setImageFile(null)
    setShowForm(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    const title = formData.title.trim()
    const link = formData.link.trim()
    const sort = formData.sort === "" ? 0 : Number(formData.sort)
    const image = imagePreview || "/placeholder.jpg"

    if (!title) {
      toast({
        variant: "destructive",
        title: "提示",
        description: "请输入标题",
      })
      return
    }

    setSaving(true)
    try {
      if (editingBanner) {
        await bannerApi.update(editingBanner.id, {
          title,
          link,
          sort,
          image,
          enabled: editingBanner.enabled,
        })
      } else {
        await bannerApi.create({
          title,
          link,
          sort,
          image,
          enabled: true,
        })
      }
      setShowForm(false)
      resetForm()
      await fetchBanners()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: err instanceof Error ? err.message : "保存失败",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (banner: Banner) => {
    try {
      await bannerApi.update(banner.id, {
        ...banner,
        enabled: !banner.enabled,
      })
      await fetchBanners()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: err instanceof Error ? err.message : "状态切换失败",
      })
    }
  }

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, id })
  }

  const closeDeleteConfirm = () => {
    setDeleteConfirm((prev) => ({ ...prev, open: false }))
  }

  const executeDelete = async () => {
    const { id } = deleteConfirm
    if (!id) return
    closeDeleteConfirm()
    try {
      await bannerApi.delete(id)
      await fetchBanners()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: err instanceof Error ? err.message : "删除失败",
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">轮播图配置</h1>
            <p className="text-sm text-muted-foreground">配置商城首页轮播推荐</p>
          </div>
          <Button className="gap-2" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            新增轮播图
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {editingBanner ? "编辑轮播图" : "新增轮播图"}
              </CardTitle>
              <CardDescription>上传图片并配置跳转链接</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">标题</Label>
                  <Input
                    id="title"
                    placeholder="请输入轮播图标题"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link">跳转链接</Label>
                  <Input
                    id="link"
                    placeholder="例如：/"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort">排序</Label>
                  <Input
                    id="sort"
                    type="number"
                    placeholder="数字越小越靠前"
                    value={formData.sort}
                    onChange={(e) => setFormData({ ...formData, sort: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">图片</Label>
                  <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
                </div>
              </div>
              {imagePreview && (
                <div className="relative h-24 w-40 overflow-hidden rounded-md bg-muted">
                  <Image
                    src={imagePreview}
                    alt="预览"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  disabled={saving}
                >
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">轮播图列表</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>图片</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>链接</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>启用状态</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        暂无轮播图
                      </TableCell>
                    </TableRow>
                  ) : (
                    banners.map((banner) => (
                      <TableRow key={banner.id}>
                        <TableCell>
                          <div className="relative h-12 w-20 overflow-hidden rounded-md bg-muted">
                            {banner.image ? (
                              <Image
                                src={banner.image}
                                alt={banner.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{banner.title}</TableCell>
                        <TableCell className="font-mono text-xs">{banner.link || "-"}</TableCell>
                        <TableCell>{banner.sort}</TableCell>
                        <TableCell>
                          <Switch
                            checked={banner.enabled}
                            onCheckedChange={() => toggleEnabled(banner)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(banner)}>
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(banner.id)}>
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open) closeDeleteConfirm()
        }}
        title="确认删除"
        description="确定删除该轮播图吗？"
        variant="destructive"
        onConfirm={executeDelete}
      />
    </DashboardLayout>
  )
}
