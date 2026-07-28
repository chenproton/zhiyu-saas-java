"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout, useRole } from "@/components/dashboard-layout"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Eye, ShoppingCart, Loader2, AlertCircle } from "lucide-react"
import { orderApi, resourceApi, institutionApi, type Order, type Resource, type Institution } from "@/lib/api"
import { toast } from "@zhiyu/ui"

export default function OrdersPage() {
  const { role, institutionId } = useRole()
  const [orders, setOrders] = useState<Order[]>([])
  const [resources, setResources] = useState<Record<string, Resource>>({})
  const [institutions, setInstitutions] = useState<Record<string, Institution>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const fetchData = async () => {
    if (!institutionId) return
    setLoading(true)
    setError(null)
    try {
      const [ordersRes, resourcesRes, institutionsRes] = await Promise.all([
        orderApi.list(),
        resourceApi.list({ limit: 1000 }),
        institutionApi.list({ limit: 1000 }),
      ])
      setOrders(ordersRes.items)
      setResources(Object.fromEntries(resourcesRes.items.map((r) => [r.id, r])))
      setInstitutions(Object.fromEntries(institutionsRes.items.map((i) => [i.id, i])))
    } catch (err: any) {
      setError(err.message || "加载订单数据失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [institutionId])

  if (!institutionId) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">请先入驻机构</p>
        </div>
      </DashboardLayout>
    )
  }

  const myOrders = orders.filter(
    (o) => o.buyerId === institutionId || o.sellerId === institutionId
  )

  const filteredOrders = myOrders.filter((o) => {
    const resource = resources[o.resourceId]
    const matchesSearch =
      !searchQuery.trim() ||
      o.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false
    const matchesStatus = statusFilter === "all" || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalAmount = filteredOrders.reduce((sum, o) => sum + o.price, 0)
  const completedAmount = filteredOrders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.price, 0)

  const handlePay = async (orderId: string) => {
    setPaying(true)
    try {
      await orderApi.pay(orderId)
      toast({ title: "支付成功" })
      const res = await orderApi.list()
      setOrders(res.items)
      setSelectedOrder(null)
    } catch (err: any) {
      toast({
        title: "支付失败",
        description: err.message || "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setPaying(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">订单管理</h1>
          <p className="text-sm text-muted-foreground">
            {role === "enterprise" ? "查看本机构的销售订单" : "查看本校的采购订单"}
          </p>
        </div>

        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-4 text-muted-foreground">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p>{error}</p>
            <Button onClick={fetchData}>重新加载</Button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">总订单数</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{myOrders.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">订单总金额</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">¥{totalAmount.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">已完成金额</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">¥{completedAmount.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">待支付金额</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">
                    ¥{(totalAmount - completedAmount).toLocaleString()}
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
                    placeholder="搜索订单号或资源名称..."
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
                    <SelectItem value="paid">已完成</SelectItem>
                    <SelectItem value="pending">待支付</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                    <SelectItem value="refunded">已退款</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">订单列表</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>订单号</TableHead>
                      <TableHead>资源名称</TableHead>
                      <TableHead>{role === "enterprise" ? "采购方" : "销售方"}</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>下单时间</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const resource = resources[order.resourceId]
                      const counterpartyId = role === "enterprise" ? order.buyerId : order.sellerId
                      const counterparty = institutions[counterpartyId]
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{resource?.name || "-"}</TableCell>
                          <TableCell>{counterparty?.name || "-"}</TableCell>
                          <TableCell className="font-medium">¥{order.price.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={order.status === "paid" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}>
                              {order.status === "paid" ? "已完成" : order.status === "pending" ? "待支付" : order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{order.createdAt}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {filteredOrders.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">暂无订单</div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Order Detail Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>订单详情</DialogTitle>
              <DialogDescription>订单号：{selectedOrder?.orderNo}</DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <OrderDetailContent
                order={selectedOrder}
                role={role ?? "school"}
                resources={resources}
                institutions={institutions}
                paying={paying}
                onPay={handlePay}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

function OrderDetailContent({
  order,
  role,
  resources,
  institutions,
  paying,
  onPay,
}: {
  order: Order
  role: string
  resources: Record<string, Resource>
  institutions: Record<string, Institution>
  paying: boolean
  onPay: (orderId: string) => void
}) {
  const resource = resources[order.resourceId]
  const buyer = institutions[order.buyerId]
  const seller = institutions[order.sellerId]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">资源名称</p>
          <p className="font-medium text-foreground">{resource?.name || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">资源版本</p>
          <p className="text-foreground">{resource?.version || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">采购方</p>
          <p className="text-foreground">{buyer?.name || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">创建方</p>
          <p className="text-foreground">{seller?.name || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">订单状态</p>
          <Badge className={order.status === "paid" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}>
            {order.status === "paid" ? "已完成" : order.status === "pending" ? "待支付" : order.status}
          </Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">下单时间</p>
          <p className="text-foreground">{order.createdAt}</p>
        </div>
      </div>

      <div className="rounded-lg bg-secondary p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">买断价格</span>
          <span className="text-xl font-bold text-foreground">¥{order.price.toLocaleString()}</span>
        </div>
        {role === "operator" && (
          <>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">平台抽成</span>
              <span className="text-foreground">-¥{order.platformFee.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">创作者收益</span>
              <span className="font-medium text-success">¥{order.sellerIncome.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      {order.status === "pending" && role === "school" && (
        <Button className="w-full gap-2" disabled={paying} onClick={() => onPay(order.id)}>
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
          确认支付
        </Button>
      )}
    </div>
  )
}
