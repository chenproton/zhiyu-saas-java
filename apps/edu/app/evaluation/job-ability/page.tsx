"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Briefcase, CheckCircle2, FileEdit, AlertCircle, Settings2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@zhiyu/ui"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableRowActions } from "@/components/shared/table-row-actions"
import { certApi, positionApi } from "@/lib/api"
import type { CareerPosition, CertificationRule } from "@/lib/types"

export default function JobAbilityPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [rules, setRules] = useState<CertificationRule[]>([])
  const [pointCounts, setPointCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const [positionRes, ruleRes] = await Promise.all([
          positionApi.list(),
          certApi.listRules(),
        ])
        setPositions(positionRes.items)
        setRules(ruleRes.items)
        // 统计每条规则下已配置的能力点数
        const counts: Record<string, number> = {}
        await Promise.all(
          ruleRes.items.map(async (rule) => {
            try {
              const full = await certApi.getFullRule(rule.id)
              counts[rule.id] = full.items.reduce(
                (sum, item) => sum + item.points.length,
                0,
              )
            } catch {
              counts[rule.id] = 0
            }
          }),
        )
        setPointCounts(counts)
      } catch (err) {
        toast({
          title: "加载失败",
          description: err instanceof Error ? err.message : "获取岗位认证数据失败",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ruleMap = useMemo(() => {
    const map = new Map<string, CertificationRule>()
    rules.forEach((rule) => map.set(rule.careerPositionId, rule))
    return map
  }, [rules])

  const filteredPositions = useMemo(() => {
    const keyword = search.toLowerCase()
    return positions.filter(
      (position) =>
        position.name.toLowerCase().includes(keyword) ||
        (position.code || "").toLowerCase().includes(keyword),
    )
  }, [positions, search])

  const stats = useMemo(() => {
    const ruleStatuses = positions.map((p) => ruleMap.get(p.id)?.status ?? "none")
    return {
      total: positions.length,
      published: ruleStatuses.filter((s) => s === "published").length,
      configured: ruleStatuses.filter((s) => s !== "none" && s !== "published").length,
      none: ruleStatuses.filter((s) => s === "none").length,
    }
  }, [positions, ruleMap])

  const formatDate = (iso?: string) => {
    if (!iso) return "-"
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="岗位能力认定规则"
        description="管理各岗位的能力认定规则配置"
        stats={[
          {
            label: "岗位总数",
            value: stats.total,
            icon: <Briefcase className="size-4 text-blue-500" />,
            iconClassName: "bg-blue-50",
          },
          {
            label: "已发布规则",
            value: stats.published,
            icon: <CheckCircle2 className="size-4 text-green-500" />,
            iconClassName: "bg-green-50",
          },
          {
            label: "配置中",
            value: stats.configured,
            icon: <FileEdit className="size-4 text-amber-500" />,
            iconClassName: "bg-amber-50",
          },
          {
            label: "无规则",
            value: stats.none,
            icon: <AlertCircle className="size-4 text-gray-500" />,
            iconClassName: "bg-gray-50",
          },
        ]}
      />

      {/* 搜索栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索岗位名称或编码..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 岗位认证列表 */}
      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">岗位名称</TableHead>
                <TableHead className="w-[140px]">岗位编码</TableHead>
                <TableHead className="w-[160px]">专业方向</TableHead>
                <TableHead className="w-[110px] text-center">关联能力点数</TableHead>
                <TableHead className="w-[100px]">规则状态</TableHead>
                <TableHead className="w-[150px]">更新时间</TableHead>
                <TableHead className="sticky right-0 w-[200px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredPositions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    暂无岗位数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredPositions.map((position) => {
                  const rule = ruleMap.get(position.id)
                  const pointCount = rule ? pointCounts[rule.id] : undefined
                  return (
                    <TableRow key={position.id} className="group">
                      <TableCell className="font-medium">{position.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {position.code || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-1">
                          {position.majorNames && position.majorNames.length > 0
                            ? position.majorNames.join("、")
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {rule ? (pointCount ?? "-") : 0}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={rule?.status ?? "none"} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="text-xs">
                          {formatDate(rule?.updatedAt ?? position.updatedAt)}
                        </span>
                      </TableCell>
                      <TableRowActions className="sticky right-0 bg-white">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            router.push(`/evaluation/job-ability/config/${position.id}`)
                          }
                        >
                          <Settings2 className="mr-1 h-3 w-3" />
                          配置认证规则
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            router.push(
                              `/evaluation/job-ability/results?positionId=${position.id}`,
                            )
                          }
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          查看结果
                        </Button>
                      </TableRowActions>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
