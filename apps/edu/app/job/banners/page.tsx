"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Calendar,
  Eye,
  EyeOff,
  ImageIcon,
  Layers,
  LinkIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { jobBannerApi } from "@/lib/api"
import type { BannerConfig } from "@/lib/types/job"
import { useToast } from "@/hooks/use-toast"

type BannerStatus = "visible" | "hidden"

interface Banner extends BannerConfig {
  status: BannerStatus
}

const STATUS_TABS = ["全部", "展示中", "已隐藏"] as const

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`
}

function toLocalBanner(b: BannerConfig): Banner {
  return {
    ...b,
    status: b.isEnabled ? "visible" : "hidden",
  }
}

export default function BannerManagementPage() {
  const { toast } = useToast()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]>("全部")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [title, setTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const loadBanners = async () => {
    setLoading(true)
    try {
      const res = await jobBannerApi.list()
      setBanners(res.items.map(toLocalBanner))
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取轮播图列表" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadBanners()
  }, [])

  const filteredBanners = useMemo(() => {
    let result = [...banners]
    if (activeTab === "展示中") {
      result = result.filter((b) => b.isEnabled)
    } else if (activeTab === "已隐藏") {
      result = result.filter((b) => !b.isEnabled)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.linkUrl || "").toLowerCase().includes(q)
      )
    }
    return result.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [banners, activeTab, searchQuery])

  const visibleCount = useMemo(
    () => banners.filter((b) => b.isEnabled).length,
    [banners]
  )
  const hiddenCount = useMemo(
    () => banners.filter((b) => !b.isEnabled).length,
    [banners]
  )

  const resetForm = () => {
    setImageUrl("")
    setTitle("")
    setLinkUrl("")
    setSortOrder(0)
    setIsActive(true)
    setEditingBanner(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (banner: Banner) => {
    setEditingBanner(banner)
    setImageUrl(banner.imageUrl)
    setTitle(banner.title)
    setLinkUrl(banner.linkUrl || "")
    setSortOrder(banner.sortOrder)
    setIsActive(banner.isEnabled)
    setIsDialogOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "文件类型错误", description: "请上传图片文件" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "文件过大", description: "图片大小不能超过 5MB" })
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setImageUrl(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!imageUrl) {
      toast({ variant: "destructive", title: "请上传图片", description: "轮播图图片不能为空" })
      return
    }
    if (!title.trim()) {
      toast({ variant: "destructive", title: "请输入标题", description: "轮播图标题不能为空" })
      return
    }

    const payload = {
      title: title.trim(),
      imageUrl,
      linkUrl: linkUrl.trim() || undefined,
      sortOrder,
      isEnabled: isActive,
    }

    try {
      if (editingBanner) {
        await jobBannerApi.update(editingBanner.id, payload)
      } else {
        await jobBannerApi.create(payload as Omit<BannerConfig, "id" | "createdAt" | "updatedAt">)
      }
      await loadBanners()
      setIsDialogOpen(false)
      resetForm()
      toast({ title: editingBanner ? "保存成功" : "添加成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "操作失败", description: err.message || "请稍后重试" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该轮播图吗？")) return
    try {
      await jobBannerApi.delete(id)
      await loadBanners()
      toast({ title: "删除成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message || "请稍后重试" })
    }
  }

  const handleToggleStatus = async (banner: Banner) => {
    try {
      await jobBannerApi.update(banner.id, {
        title: banner.title,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        sortOrder: banner.sortOrder,
        isEnabled: !banner.isEnabled,
      })
      await loadBanners()
      toast({ title: !banner.isEnabled ? "已启用展示" : "已隐藏" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "操作失败", description: err.message || "请稍后重试" })
    }
  }

  const stats = [
    { label: "全部轮播图", value: banners.length, icon: Layers, color: "text-blue-600 bg-blue-50" },
    { label: "展示中", value: visibleCount, icon: Eye, color: "text-green-600 bg-green-50" },
    { label: "已隐藏", value: hiddenCount, icon: EyeOff, color: "text-gray-600 bg-gray-100" },
  ]

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">轮播图管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理首页岗位能力精准对接栏的轮播图展示
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">轮播图管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理首页岗位能力精准对接栏的轮播图展示
          </p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" />
          新增轮播图
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", s.color)}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="搜索轮播图标题、跳转链接..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">轮播图列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-100 items-center">
              <div className="col-span-2">轮播图</div>
              <div className="col-span-3">标题</div>
              <div className="col-span-1 text-center">排序</div>
              <div className="col-span-2">创建时间</div>
              <div className="col-span-1 text-center">状态</div>
              <div className="col-span-2">跳转链接</div>
              <div className="col-span-1 text-right">操作</div>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <p className="text-sm">加载中...</p>
                </div>
              ) : filteredBanners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">暂无轮播图，点击右上角按钮新增</p>
                </div>
              ) : (
                filteredBanners.map((banner) => (
                  <div
                    key={banner.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors group relative"
                  >
                    <div className="col-span-2">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="h-14 w-24 rounded-md object-cover border border-slate-100"
                      />
                    </div>

                    <div className="col-span-3 text-sm text-slate-700 truncate font-medium">
                      {banner.title}
                    </div>

                    <div className="col-span-1 text-center text-sm text-slate-600">
                      {banner.sortOrder}
                    </div>

                    <div className="col-span-2 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatDate(banner.createdAt)}
                      </div>
                    </div>

                    <div className="col-span-1 text-center">
                      <Switch
                        checked={banner.isEnabled}
                        onCheckedChange={() => handleToggleStatus(banner)}
                        aria-label={banner.isEnabled ? "展示中" : "已隐藏"}
                      />
                    </div>

                    <div className="col-span-1 text-sm text-slate-600 truncate">
                      {banner.linkUrl ? (
                        <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-600">
                          <LinkIcon className="mr-1 h-3 w-3" />
                          {banner.linkUrl}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">无跳转</span>
                      )}
                    </div>

                    <div className="col-span-2 text-right relative">
                      <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleOpenEdit(banner)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(banner.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "编辑轮播图" : "新增轮播图"}</DialogTitle>
            <DialogDescription>
              上传轮播图并完善相关信息，数据将保存到服务端。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>
                Banner 图片
                <span className="text-xs text-muted-foreground ml-1">
                  支持 jpg、png、gif，建议尺寸 1200×400
                </span>
              </Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-primary hover:bg-slate-50 transition-colors cursor-pointer">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="banner-upload"
                />
                <label htmlFor="banner-upload" className="cursor-pointer block">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="预览"
                      className="max-h-[180px] mx-auto rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
                      <span className="text-sm text-slate-500">点击上传图片</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                placeholder="请输入轮播图标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  排序
                  <span className="text-xs text-muted-foreground ml-1">数字越小越靠前</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>跳转链接</Label>
                <Select
                  value={linkUrl || "__none__"}
                  onValueChange={(v) => setLinkUrl(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="不设置跳转" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不设置跳转</SelectItem>
                    <SelectItem value="/job/positions">岗位列表</SelectItem>
                    <SelectItem value="/evaluation/landing">测评中心</SelectItem>
                    <SelectItem value="/scene">场景大厅</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">展示状态</Label>
                <p className="text-xs text-muted-foreground">
                  关闭后该轮播图将不在首页显示
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!imageUrl || !title.trim()}>
              {editingBanner ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
