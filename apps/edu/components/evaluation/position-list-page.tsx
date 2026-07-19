// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/shared/status-badge"
import { LevelMappingDisplay } from "./level-mapping-display"
import { LevelMappingDialog } from "./level-mapping-dialog"
import { positionApi } from "@/lib/api"
import { useIndustryMap } from "@/lib/use-resource-maps"
import type { Position, RuleStatus, LevelMapping, CareerPosition } from "@/lib/types"
import { statusConfig, actionConfig, defaultLevelMapping } from "@/lib/types"
import {
  Search,
  Settings2,
  MoreHorizontal,
  X,
  Upload,
  ChevronLeft,
  ChevronRight,
  Settings,
  FileText,
  XCircle,
  CheckCircle,
} from "lucide-react"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

export function PositionListPage() {
  const router = useRouter()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [professionalDirectionFilter, setProfessionalDirectionFilter] = useState<string>("all")
  const industryMap = useIndustryMap()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    positionApi.list({ limit: 1000 })
      .then((res) => {
        if (cancelled) return
        setPositions(res.items.map(mapCareerPositionToPosition))
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load positions', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const mapCareerPositionToPosition = (cp: CareerPosition): Position => ({
    id: cp.id,
    name: cp.name,
    positionCode: cp.shortName || cp.id,
    professionalDirection: cp.industryId || '',
    relatedAbilityCount: 0,
    ruleStatus: 'none',
    lastUpdated: cp.updatedAt,
    updatedBy: cp.createdBy || '-',
  })

  const getIndustryName = (id?: string) => {
    if (!id) return '未设置'
    return industryMap.get(id) || id
  }
  
  // 确认弹窗状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
  }>({ open: false, title: "", description: "", action: () => {} })

  // 获取所有专业方向选项
  const professionalDirections = Array.from(new Set(positions.map(p => getIndustryName(p.professionalDirection))))

  // 筛选后的岗位列表
  const filteredPositions = positions.filter((position) => {
    const matchesSearch =
      position.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      position.positionCode.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesProfessionalDirection =
      professionalDirectionFilter === "all" || getIndustryName(position.professionalDirection) === professionalDirectionFilter
    return matchesSearch && matchesProfessionalDirection
  })

  // 选中状态处理
  const isAllSelected =
    filteredPositions.length > 0 &&
    filteredPositions.every((p) => selectedIds.includes(p.id))

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredPositions.map((p) => p.id))
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // 操作处理
  const handleConfig = (position: Position) => {
    router.push(`/evaluation/job-ability/config/${position.id}`)
  }

  const handleSaveRule = () => {
    alert('此处参考 1.0 版本页面功能即可')
  }

  const handleCancelApproval = (position: Position) => {
    setConfirmDialog({
      open: true,
      title: "取消审批",
      description: `确定要取消「${position.name}」的岗位能力认定规则审批吗？取消后规则将退回至草稿状态。`,
      action: () => {
        setPositions((prev) =>
          prev.map((p) =>
            p.id === position.id ? { ...p, ruleStatus: "draft" as RuleStatus } : p
          )
        )
        setConfirmDialog((prev) => ({ ...prev, open: false }))
      },
    })
  }

  const handlePublish = (position: Position) => {
    setConfirmDialog({
      open: true,
      title: "发布规则",
      description: `确定要发布「${position.name}」的岗位能力认定规则吗？发布后将立即生效。`,
      action: () => {
        setPositions((prev) =>
          prev.map((p) =>
            p.id === position.id
              ? { ...p, ruleStatus: "published" as RuleStatus }
              : p
          )
        )
        setConfirmDialog((prev) => ({ ...prev, open: false }))
      },
    })
  }

  const handleUnpublish = (position: Position) => {
    setConfirmDialog({
      open: true,
      title: "取消发布",
      description: `确定要取消发布「${position.name}」的岗位能力认定规则吗？取消后规则将进入待发布状态。`,
      action: () => {
        setPositions((prev) =>
          prev.map((p) =>
            p.id === position.id ? { ...p, ruleStatus: "ready" as RuleStatus } : p
          )
        )
        setConfirmDialog((prev) => ({ ...prev, open: false }))
      },
    })
  }

  // 批量操作
  const handleBatchPublish = () => {
    const readyPositions = positions.filter(
      (p) => selectedIds.includes(p.id) && p.ruleStatus === "ready"
    )
    if (readyPositions.length === 0) {
      return
    }
    setConfirmDialog({
      open: true,
      title: "批量发布",
      description: `确定要批量发布 ${readyPositions.length} 个岗位的能力认定规则吗？`,
      action: () => {
        setPositions((prev) =>
          prev.map((p) =>
            readyPositions.some((rp) => rp.id === p.id)
              ? { ...p, ruleStatus: "published" as RuleStatus }
              : p
          )
        )
        setSelectedIds([])
        setConfirmDialog((prev) => ({ ...prev, open: false }))
      },
    })
  }

  // 检查操作是否显示
  const shouldShowAction = (action: string, status: RuleStatus) => {
    return actionConfig[action]?.showInStatus.includes(status)
  }

  return (
    <div className="px-8 py-6">
      <PageHeaderCard
        title="岗位能力认定规则配置"
        description="管理各岗位的能力认定规则配置"
        className="mb-4"
      />

        {/* 搜索和筛选 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索岗位名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={professionalDirectionFilter} onValueChange={setProfessionalDirectionFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="所属行业" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部行业</SelectItem>
              {professionalDirections.map((direction) => (
                <SelectItem key={direction} value={direction}>
                  {direction}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 批量操作 */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-secondary/50 rounded-lg">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedIds.length} 项
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              取消选择
            </Button>
            <Button size="sm" onClick={handleBatchPublish}>
              批量发布
            </Button>
          </div>
        )}

        {/* 数据表格 */}
        <div className="rounded-lg border bg-white px-4 py-3">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead><PrdAnnotation data={getAnnotation("pl-col-name")}>岗位名称</PrdAnnotation></TableHead>
                <TableHead><PrdAnnotation data={getAnnotation("pl-col-code")}>岗位编码</PrdAnnotation></TableHead>
                <TableHead><PrdAnnotation data={getAnnotation("pl-col-direction")}>所属行业</PrdAnnotation></TableHead>
                <TableHead className="text-center"><PrdAnnotation data={getAnnotation("pl-col-ability-count")}>关联能力数</PrdAnnotation></TableHead>
                <TableHead><PrdAnnotation data={getAnnotation("pl-col-updater")}>最后更新者</PrdAnnotation></TableHead>
                <TableHead><PrdAnnotation data={getAnnotation("pl-col-update-time")}>更新时间</PrdAnnotation></TableHead>
                <TableHead className="text-right"><PrdAnnotation data={getAnnotation("pl-col-actions")}>操作</PrdAnnotation></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p className="text-muted-foreground">加载中...</p>
                  </TableCell>
                </TableRow>
              ) : filteredPositions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p className="text-muted-foreground">暂无数据</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPositions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(position.id)}
                        onCheckedChange={() => handleSelectOne(position.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{position.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {position.positionCode}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getIndustryName(position.professionalDirection)}
                    </TableCell>
                    <TableCell className="text-center">
                      {position.relatedAbilityCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {position.updatedBy || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {position.lastUpdated}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleConfig(position)}>
                        <PrdAnnotation data={getAnnotation("pl-btn-config")}>
                          <Settings2 className="mr-1 h-3.5 w-3.5" />
                          配置认定规则
                        </PrdAnnotation>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              共 {filteredPositions.length} 条记录
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <Button variant="outline" size="sm" className="min-w-8">
                1
              </Button>
              <Button variant="outline" size="sm" disabled>
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>



      {/* 确认弹窗 */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent annotationContext="position-list">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              取消
            </Button>
            <Button onClick={confirmDialog.action}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
