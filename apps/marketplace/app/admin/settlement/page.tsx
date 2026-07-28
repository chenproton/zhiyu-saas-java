"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Percent, DollarSign, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { configApi, orderApi, type Order, type PlatformConfig } from "@/lib/api"

interface MonthlyRow {
  month: string
  gmv: number
  orders: number
  refund: number
}

export default function AdminSettlementPage() {
  const { toast } = useToast()
  const [config, setConfig] = useState<PlatformConfig | null>(null)
  const [feeRate, setFeeRate] = useState<number>(15)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfg, orderList] = await Promise.all([
        configApi.get(),
        orderApi.list({ limit: 10000 }),
      ])
      setConfig(cfg)
      setFeeRate(Math.round(cfg.platformFeeRate * 100))
      setOrders(orderList.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveFeeRate = async () => {
    if (!config) return
    setSaving(true)
    try {
      const updated = await configApi.update({
        platformFeeRate: feeRate / 100,
        minWithdrawalAmount: config.minWithdrawalAmount,
      })
      setConfig(updated)
      toast({
        title: "提示",
        description: `平台抽成比例已保存为 ${Math.round(updated.platformFeeRate * 100)}%`,
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "提示",
        description: "保存失败：" + (err instanceof Error ? err.message : "未知错误"),
      })
    } finally {
      setSaving(false)
    }
  }

  const paidOrders = orders.filter((o) => o.status === "paid")
  const totalGMV = paidOrders.reduce((sum, o) => sum + o.price, 0)
  const totalPlatformIncome = paidOrders.reduce((sum, o) => sum + o.platformFee, 0)
  const totalCreatorIncome = paidOrders.reduce((sum, o) => sum + o.sellerIncome, 0)

  const monthlyMap = new Map<string, MonthlyRow>()
  paidOrders.forEach((o) => {
    const month = (o.paidAt || o.createdAt).slice(0, 7)
    const row = monthlyMap.get(month) || { month, gmv: 0, orders: 0, refund: 0 }
    row.gmv += o.price
    row.orders += 1
    monthlyMap.set(month, row)
  })
  orders
    .filter((o) => o.status === "refunded")
    .forEach((o) => {
      const month = (o.paidAt || o.createdAt).slice(0, 7)
      const row = monthlyMap.get(month) || { month, gmv: 0, orders: 0, refund: 0 }
      row.refund += o.price
      monthlyMap.set(month, row)
    })

  const monthlyData: MonthlyRow[] = Array.from(monthlyMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  )

  const exportReport = () => {
    const currentFeeRate = config?.platformFeeRate ?? feeRate / 100
    const csvContent = [
      ["月份", "GMV", "订单量", "平台收入", "创作者分成", "退款金额"],
      ...monthlyData.map((m) => [
        m.month,
        m.gmv,
        m.orders,
        Math.round(m.gmv * currentFeeRate),
        Math.round(m.gmv * (1 - currentFeeRate)),
        m.refund,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `settlement-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">结算中心</h1>
          <p className="text-sm text-muted-foreground">配置抽成比例，查看对账报表</p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={loadData}>
              重试
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">累计 GMV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-accent" />
                <span className="text-2xl font-bold text-accent">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `¥${totalGMV.toLocaleString()}`}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">平台累计收入</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-warning" />
                <span className="text-2xl font-bold text-warning">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `¥${totalPlatformIncome.toLocaleString()}`}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">创作者累计分成</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-success" />
                <span className="text-2xl font-bold text-success">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `¥${totalCreatorIncome.toLocaleString()}`}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fee Rate Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">抽成配置</CardTitle>
            <CardDescription>设置平台从每笔交易中抽取的比例</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="feeRate">平台抽成比例</Label>
                <span className="text-2xl font-bold text-accent">{feeRate}%</span>
              </div>
              <Slider
                id="feeRate"
                value={[feeRate]}
                max={50}
                step={1}
                disabled={loading || saving}
                onValueChange={(v) => setFeeRate(v[0])}
              />
              <p className="text-xs text-muted-foreground">默认 15%，创作者获得剩余 85%</p>
            </div>
            <Button onClick={handleSaveFeeRate} disabled={loading || saving || !config}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存配置
            </Button>
          </CardContent>
        </Card>

        {/* Monthly Report */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">对账报表</CardTitle>
              <CardDescription>按月统计平台交易与分润情况</CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={exportReport} disabled={loading}>
              <Download className="h-4 w-4" />
              导出 Excel
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载中...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>月份</TableHead>
                    <TableHead>GMV</TableHead>
                    <TableHead>订单量</TableHead>
                    <TableHead>平台收入</TableHead>
                    <TableHead>创作者分成</TableHead>
                    <TableHead>退款金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyData.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell>{m.month}</TableCell>
                        <TableCell className="font-medium">¥{m.gmv.toLocaleString()}</TableCell>
                        <TableCell>{m.orders}</TableCell>
                        <TableCell>¥{Math.round(m.gmv * (feeRate / 100)).toLocaleString()}</TableCell>
                        <TableCell className="text-success">
                          ¥{Math.round(m.gmv * (1 - feeRate / 100)).toLocaleString()}
                        </TableCell>
                        <TableCell>¥{m.refund.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
