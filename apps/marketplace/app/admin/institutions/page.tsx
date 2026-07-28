"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Eye, CheckCircle, XCircle, Power } from "lucide-react"
import { institutionApi, resourceApi, orderApi, type Institution, type InstitutionStatus } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/hooks/use-toast"

export default function AdminInstitutionsPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const [resourceCount, setResourceCount] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [countsLoading, setCountsLoading] = useState(false)

  const fetchInstitutions = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await institutionApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery || undefined,
        limit: 1000,
      })
      setInstitutions(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载机构列表失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstitutions()
  }, [statusFilter, searchQuery])

  const filteredInstitutions = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return institutions.filter((inst) => {
      const matchesSearch =
        inst.name.toLowerCase().includes(query) ||
        inst.creditCode.toLowerCase().includes(query) ||
        inst.orgCode.toLowerCase().includes(query)
      const matchesStatus = statusFilter === "all" || inst.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [institutions, searchQuery, statusFilter])

  useEffect(() => {
    if (!selectedInstitution || !detailsOpen) return

    const fetchCounts = async () => {
      try {
        setCountsLoading(true)
        const [resourcesRes, ordersRes] = await Promise.all([
          resourceApi.list({ institutionId: selectedInstitution.id, limit: 1000 }),
          orderApi.list({ limit: 1000 }),
        ])
        setResourceCount(resourcesRes.total)
        setOrderCount(
          ordersRes.items.filter(
            (o) => o.buyerId === selectedInstitution.id || o.sellerId === selectedInstitution.id
          ).length
        )
      } catch {
        setResourceCount(0)
        setOrderCount(0)
      } finally {
        setCountsLoading(false)
      }
    }

    fetchCounts()
  }, [selectedInstitution, detailsOpen])

  const handleViewDetails = (inst: Institution) => {
    setSelectedInstitution(inst)
    setDetailsOpen(true)
  }

  const handleApprove = async (inst?: Institution) => {
    const target = inst || selectedInstitution
    if (!target) return
    try {
      setActionLoading(true)
      await institutionApi.approve(target.id)
      await fetchInstitutions()
      setDetailsOpen(false)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: err instanceof Error ? err.message : "审核通过失败",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!selectedInstitution) return
    try {
      setActionLoading(true)
      if (selectedInstitution.status === "approved") {
        await institutionApi.disable(selectedInstitution.id)
      } else {
        // 已禁用机构重新启用时复用审核通过接口
        await institutionApi.approve(selectedInstitution.id)
      }
      await fetchInstitutions()
      setDetailsOpen(false)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: err instanceof Error ? err.message : "状态切换失败",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim() || !selectedInstitution) return
    try {
      setActionLoading(true)
      // 后端暂无独立驳回接口，使用 disable 将机构置为已禁用
      await institutionApi.disable(selectedInstitution.id)
      setRejectOpen(false)
      setRejectReason("")
      setDetailsOpen(false)
      await fetchInstitutions()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: err instanceof Error ? err.message : "驳回失败",
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">机构入驻审核</h1>
          <p className="text-sm text-muted-foreground">管理平台入驻机构与入驻审核</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">机构总数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{institutions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已入驻</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {institutions.filter((i) => i.status === "approved").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">待审核</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {institutions.filter((i) => i.status === "pending").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已禁用</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {institutions.filter((i) => i.status === "disabled").length}
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
                placeholder="搜索机构名称、信用代码..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="approved">已入驻</SelectItem>
                <SelectItem value="disabled">已禁用</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">机构列表</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">加载中...</div>
            ) : error ? (
              <div className="py-8 text-center text-destructive">{error}</div>
            ) : filteredInstitutions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">暂无数据</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>机构名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>统一社会信用代码</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>入驻时间</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstitutions.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.name}</TableCell>
                      <TableCell>{inst.type === "school" ? "学校" : "企业"}</TableCell>
                      <TableCell className="font-mono text-xs">{inst.creditCode}</TableCell>
                      <TableCell>
                        <InstitutionStatusBadge status={inst.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{inst.createdAt}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewDetails(inst)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {inst.status === "pending" && hasPermission("admin", "institutions", "approve") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success"
                              onClick={() => handleApprove(inst)}
                              disabled={actionLoading}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>{selectedInstitution?.name}</DialogTitle>
              <DialogDescription>机构详情与审核操作</DialogDescription>
            </DialogHeader>
            {selectedInstitution && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">机构类型</p>
                    <p className="font-medium text-foreground">
                      {selectedInstitution.type === "school" ? "学校" : "企业"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">机构编码</p>
                    <p className="font-mono text-foreground">{selectedInstitution.orgCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">统一社会信用代码</p>
                    <p className="font-mono text-foreground">{selectedInstitution.creditCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">联系人</p>
                    <p className="text-foreground">
                      {selectedInstitution.contactName} {selectedInstitution.contactPhone}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">机构简介</p>
                  <p className="text-sm text-foreground">{selectedInstitution.intro}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">擅长领域</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedInstitution.expertiseTags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-xs text-muted-foreground">创建资源数</p>
                    <p className="text-xl font-bold text-foreground">
                      {countsLoading ? "..." : resourceCount}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-xs text-muted-foreground">交易订单数</p>
                    <p className="text-xl font-bold text-foreground">
                      {countsLoading ? "..." : orderCount}
                    </p>
                  </div>
                </div>

                {selectedInstitution.status === "pending" ? (
                  <div className="flex gap-2">
                    {hasPermission("admin", "institutions", "approve") && (
                      <Button
                        className="flex-1 gap-2 bg-success hover:bg-success/90"
                        onClick={() => handleApprove()}
                        disabled={actionLoading}
                      >
                        <CheckCircle className="h-4 w-4" />
                        审核通过
                      </Button>
                    )}
                    {hasPermission("admin", "institutions", "reject") && (
                      <Button
                        variant="destructive"
                        className="flex-1 gap-2"
                        onClick={() => setRejectOpen(true)}
                        disabled={actionLoading}
                      >
                        <XCircle className="h-4 w-4" />
                        驳回
                      </Button>
                    )}
                  </div>
                ) : (
                  hasPermission("admin", "institutions", "disable") && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handleToggleStatus}
                      disabled={actionLoading}
                    >
                      <Power className="h-4 w-4" />
                      {selectedInstitution.status === "approved" ? "禁用机构" : "启用机构"}
                    </Button>
                  )
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>驳回入驻申请</DialogTitle>
              <DialogDescription>请填写驳回原因</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="rejectReason">驳回原因 *</Label>
              <Textarea
                id="rejectReason"
                placeholder="请说明驳回原因..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={actionLoading}>
                取消
              </Button>
              {hasPermission("admin", "institutions", "reject") && (
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || actionLoading}
                >
                  确认驳回
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

function InstitutionStatusBadge({ status }: { status: InstitutionStatus }) {
  const map: Record<InstitutionStatus, { label: string; color: string }> = {
    pending: { label: "待审核", color: "bg-warning/20 text-warning" },
    approved: { label: "已入驻", color: "bg-success/20 text-success" },
    disabled: { label: "已禁用", color: "bg-muted text-muted-foreground" },
  }
  return <Badge className={map[status].color}>{map[status].label}</Badge>
}
