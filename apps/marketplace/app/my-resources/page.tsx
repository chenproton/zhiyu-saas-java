"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { DashboardLayout, useRole } from "@/components/dashboard-layout"
import { ConfirmDialog } from "@zhiyu/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Upload,
  Download,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { resourceApi, type Resource } from "@/lib/api"
import {
  RESOURCE_CATEGORIES,
  getCategoryName,
  getCategoryColor,
  type ResourceCategoryId,
} from "@/lib/resource-constants"

type ResourceStatus = Resource["status"]

const STATUS_MAP: Record<ResourceStatus, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-muted text-muted-foreground" },
  reviewing: { label: "审核中", color: "bg-warning/20 text-warning" },
  rejected: { label: "已驳回", color: "bg-destructive/20 text-destructive" },
  pending_publish: { label: "待发布", color: "bg-info/20 text-info" },
  published: { label: "已发布", color: "bg-success/20 text-success" },
  offlined: { label: "已下架", color: "bg-muted text-muted-foreground" },
}

export default function MyResourcesPage() {
  const { institutionId } = useRole()
  const router = useRouter()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: string; resourceId: string }>({
    open: false,
    action: "",
    resourceId: "",
  })

  const fetchResources = async () => {
    if (!institutionId) {
      setResources([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await resourceApi.list({ institutionId })
      setResources(response.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载资源失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId])

  const myResources = resources

  const filteredResources = myResources.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "all" || r.category === categoryFilter
    const matchesStatus = statusFilter === "all" || r.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const openActionConfirm = (action: string, resourceId: string) => {
    setConfirmDialog({ open: true, action, resourceId })
  }

  const closeActionConfirm = () => {
    setConfirmDialog((prev) => ({ ...prev, open: false }))
  }

  const executeAction = async () => {
    const { action, resourceId } = confirmDialog
    if (!resourceId) return
    closeActionConfirm()
    setActionLoading(resourceId)
    try {
      switch (action) {
        case "提交审核":
          await resourceApi.submit(resourceId)
          break
        case "上架":
          await resourceApi.publish(resourceId)
          break
        case "下架":
          await resourceApi.offline(resourceId)
          break
        case "删除":
          await resourceApi.delete(resourceId)
          break
        default:
          throw new Error(`未知操作：${action}`)
      }
      await fetchResources()
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action}失败`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">我的资源库</h1>
            <p className="text-sm text-muted-foreground">管理您创建的教学资源</p>
          </div>
          <Link href="/my-resources/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              新建资源
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">资源总数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myResources.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已发布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {myResources.filter((r) => r.status === "published").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">审核中</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {myResources.filter((r) => r.status === "reviewing").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已驳回</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {myResources.filter((r) => r.status === "rejected").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap gap-2 py-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索资源名称..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="品类筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部品类</SelectItem>
                {RESOURCE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">资源列表</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>资源信息</TableHead>
                      <TableHead>品类</TableHead>
                      <TableHead>价格</TableHead>
                      <TableHead>版本</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.map((resource) => (
                      <TableRow key={resource.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-16 overflow-hidden rounded-md bg-muted">
                              <Image
                                src={resource.coverImage || "/placeholder.jpg"}
                                alt={resource.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{resource.name}</p>
                              <p className="text-xs text-muted-foreground">
                                销量 {resource.salesCount}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(resource.category as ResourceCategoryId)}>
                            {getCategoryName(resource.category as ResourceCategoryId)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">¥{resource.price.toLocaleString()}</TableCell>
                        <TableCell>{resource.version}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_MAP[resource.status].color}>
                            {STATUS_MAP[resource.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{resource.createdAt}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={actionLoading === resource.id}
                              >
                                {actionLoading === resource.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/resources/${resource.id}`)}>
                                查看
                              </DropdownMenuItem>
                              {(resource.status === "draft" || resource.status === "rejected") && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/my-resources/${resource.id}/edit`}>
                                    编辑
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {resource.status === "draft" && (
                                <DropdownMenuItem onClick={() => openActionConfirm("提交审核", resource.id)}>
                                  提交审核
                                </DropdownMenuItem>
                              )}
                              {resource.status === "pending_publish" && (
                                <DropdownMenuItem onClick={() => openActionConfirm("上架", resource.id)}>
                                  上架
                                </DropdownMenuItem>
                              )}
                              {resource.status === "published" && (
                                <DropdownMenuItem onClick={() => openActionConfirm("下架", resource.id)}>
                                  下架
                                </DropdownMenuItem>
                              )}
                              {(resource.status === "draft" || resource.status === "rejected" || resource.status === "offlined") && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => openActionConfirm("删除", resource.id)}
                                >
                                  删除
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredResources.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">暂无资源</div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) closeActionConfirm()
        }}
        title="确认操作"
        description={`确定要${confirmDialog.action}该资源吗？`}
        onConfirm={executeAction}
      />
    </DashboardLayout>
  )
}
