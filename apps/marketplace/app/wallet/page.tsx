"use client"

import { useEffect, useState } from "react"
import { DashboardLayout, useRole } from "@/components/dashboard-layout"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Wallet, TrendingUp, ShoppingCart, DollarSign, AlertCircle, Loader2 } from "lucide-react"
import {
  orderApi,
  resourceApi,
  withdrawalApi,
  statsApi,
  configApi,
  type Order,
  type Resource,
  type Withdrawal,
} from "@/lib/api"
import { Alert, AlertDescription } from "@/components/ui/alert"

type WithdrawalStatus = Withdrawal["status"]

export default function WalletPage() {
  const { role, institutionId } = useRole()
  const { toast } = useToast()

  const [stats, setStats] = useState<{ balance: number; totalIncome: number; totalSpent: number } | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [resources, setResources] = useState<Record<string, Resource>>({})
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [config, setConfig] = useState<{ platformFeeRate: number; minWithdrawalAmount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [accountType, setAccountType] = useState<"bank" | "alipay">("bank")
  const [accountInfo, setAccountInfo] = useState("")

  useEffect(() => {
    if (!institutionId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [statsRes, orderList, resourceList, withdrawalList, configRes] = await Promise.all([
          statsApi.me(),
          orderApi.list({ limit: 1000 }),
          resourceApi.list({ limit: 1000 }),
          withdrawalApi.list({ limit: 1000 }),
          configApi.get(),
        ])
        if (cancelled) return
        const resMap: Record<string, Resource> = {}
        resourceList.items.forEach((r) => (resMap[r.id] = r))
        setStats(statsRes)
        setOrders(orderList.items.filter((o) => o.buyerId === institutionId || o.sellerId === institutionId))
        setResources(resMap)
        setWithdrawals(withdrawalList.items.filter((w) => w.institutionId === institutionId))
        setConfig(configRes)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载账户信息失败")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
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

  const handleWithdraw = async () => {
    if (!config) return
    const amount = Number(withdrawAmount)
    if (!amount || amount < config.minWithdrawalAmount) {
      toast({
        variant: "destructive",
        title: "提示",
        description: `提现金额必须大于等于 ${config.minWithdrawalAmount} 元`,
      })
      return
    }
    if (!accountInfo.trim()) {
      toast({
        variant: "destructive",
        title: "提示",
        description: "请填写账户信息",
      })
      return
    }
    setSubmitting(true)
    try {
      await withdrawalApi.create({ amount, accountType, accountInfo: accountInfo.trim() })
      toast({
        title: "提示",
        description: "提现申请已提交，等待平台审核",
      })
      setWithdrawAmount("")
      setAccountInfo("")
      const list = await withdrawalApi.list({ limit: 1000 })
      setWithdrawals(list.items.filter((w) => w.institutionId === institutionId))
      const s = await statsApi.me()
      setStats(s)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: err instanceof Error ? err.message : "提交提现申请失败",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const statsLoading = loading || !stats || !config

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">账户中心</h1>
          <p className="text-sm text-muted-foreground">管理钱包、账单与提现</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {role === "enterprise" ? "可提现余额" : "累计消费"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-accent" />
                <span className="text-2xl font-bold text-accent">
                  {statsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    `¥${role === "enterprise" ? stats.balance.toLocaleString() : stats.totalSpent.toLocaleString()}`
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {role === "enterprise" ? "累计收益" : "订单数量"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="text-2xl font-bold text-success">
                  {statsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : role === "enterprise" ? (
                    `¥${stats.totalIncome.toLocaleString()}`
                  ) : (
                    orders.length
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">平台抽成比例</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-warning" />
                <span className="text-2xl font-bold text-warning">
                  {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : `${(config.platformFeeRate * 100).toFixed(0)}%`}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="wallet">
          <TabsList>
            <TabsTrigger value="wallet">我的钱包</TabsTrigger>
            <TabsTrigger value="bills">账单记录</TabsTrigger>
            {role === "enterprise" && <TabsTrigger value="withdraw">提现申请</TabsTrigger>}
          </TabsList>

          <TabsContent value="wallet" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">钱包概览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {statsLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : role === "enterprise" ? (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                      <div>
                        <p className="text-sm text-muted-foreground">可提现余额</p>
                        <p className="text-2xl font-bold text-foreground">
                          ¥{stats.balance.toLocaleString()}
                        </p>
                      </div>
                      <Button>申请提现</Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground">累计收益</p>
                        <p className="text-xl font-bold text-success">¥{stats.totalIncome.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground">累计订单</p>
                        <p className="text-xl font-bold text-foreground">{orders.length}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                      <div>
                        <p className="text-sm text-muted-foreground">累计消费金额</p>
                        <p className="text-2xl font-bold text-foreground">
                          ¥{stats.totalSpent.toLocaleString()}
                        </p>
                      </div>
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">学校账户仅用于采购，不支持提现</p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bills" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {role === "enterprise" ? "收益明细" : "消费明细"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>时间</TableHead>
                        <TableHead>资源名称</TableHead>
                        <TableHead>订单号</TableHead>
                        {role === "enterprise" ? (
                          <>
                            <TableHead>销售金额</TableHead>
                            <TableHead>平台抽成</TableHead>
                            <TableHead>实际收益</TableHead>
                          </>
                        ) : (
                          <TableHead>金额</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        const resource = resources[order.resourceId]
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="text-muted-foreground">{order.createdAt}</TableCell>
                            <TableCell>{resource?.name || "-"}</TableCell>
                            <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                            {role === "enterprise" ? (
                              <>
                                <TableCell>¥{order.price.toLocaleString()}</TableCell>
                                <TableCell className="text-destructive">-¥{order.platformFee.toLocaleString()}</TableCell>
                                <TableCell className="text-success">¥{order.sellerIncome.toLocaleString()}</TableCell>
                              </>
                            ) : (
                              <TableCell className="font-medium">¥{order.price.toLocaleString()}</TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {role === "enterprise" && (
            <TabsContent value="withdraw" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">申请提现</CardTitle>
                  <CardDescription>
                    {config ? `最低提现金额为 ${config.minWithdrawalAmount} 元` : "加载配置中..."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AlertCircle className="inline h-4 w-4 text-warning" />
                  <span className="ml-1 text-sm text-warning">
                    {statsLoading ? "加载余额中..." : `当前可提现余额：¥${stats.balance.toLocaleString()}`}
                  </span>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="amount">提现金额</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="请输入提现金额"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>收款账户类型</Label>
                      <Select value={accountType} onValueChange={(v) => setAccountType(v as "bank" | "alipay")} disabled={submitting}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择账户类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">银行卡</SelectItem>
                          <SelectItem value="alipay">支付宝</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account">账户信息</Label>
                    <Input
                      id="account"
                      placeholder={accountType === "bank" ? "银行卡号及开户行" : "支付宝账号"}
                      value={accountInfo}
                      onChange={(e) => setAccountInfo(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <Button onClick={handleWithdraw} disabled={submitting || statsLoading}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    提交提现申请
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">提现记录</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>申请时间</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>账户类型</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawals.map((w) => (
                          <TableRow key={w.id}>
                            <TableCell>{w.createdAt}</TableCell>
                            <TableCell>¥{w.amount.toLocaleString()}</TableCell>
                            <TableCell>{w.accountType === "bank" ? "银行卡" : "支付宝"}</TableCell>
                            <TableCell>
                              <WithdrawalStatusBadge status={w.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  const map: Record<WithdrawalStatus, { label: string; color: string }> = {
    pending: { label: "待审核", color: "bg-warning/20 text-warning" },
    approved: { label: "审核通过", color: "bg-info/20 text-info" },
    paid: { label: "已打款", color: "bg-success/20 text-success" },
    rejected: { label: "驳回", color: "bg-destructive/20 text-destructive" },
  }
  return <Badge className={map[status].color}>{map[status].label}</Badge>
}
