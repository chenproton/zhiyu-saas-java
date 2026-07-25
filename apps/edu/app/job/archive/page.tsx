"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

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

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Search,
  GraduationCap,
  Eye,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { positionApi, batchApi } from "@/lib/api"
import type { Position, Batch } from "@/lib/types/job-source"
import { convertCareerPositionToPosition, convertJobBatchToBatch } from "@/lib/stores/job-converters"
import { useToast } from "@/hooks/use-toast"
import { useIndustryMap, useMajorMap } from "@/lib/use-resource-maps"

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-gray-100 text-gray-500" },
  pending: { label: "审批中", className: "bg-yellow-50 text-yellow-600" },
  approved: { label: "已通过", className: "bg-blue-50 text-blue-600" },
  rejected: { label: "已驳回", className: "bg-red-50 text-red-500" },
  published: { label: "已发布", className: "bg-green-50 text-green-600" },
  archived: { label: "已归档", className: "bg-purple-50 text-purple-600" },
}

export default function PositionArchivePage() {
  const { toast } = useToast()
  const [positions, setPositions] = useState<Position[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const industryMap = useIndustryMap()
  const majorMap = useMajorMap()

  const loadData = async () => {
    setLoading(true)
    try {
      const [posRes, batchRes] = await Promise.all([
        positionApi.list({ status: "archived", limit: 1000 }),
        batchApi.list({ limit: 1000 }),
      ])
      setPositions(posRes.items.map(convertCareerPositionToPosition))
      setBatches(batchRes.items.map(convertJobBatchToBatch))
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取归档数据" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const majors = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => {
      p.majors.forEach((id) => {
        const name = majorMap.get(id)
        if (name) set.add(name)
      })
    })
    return Array.from(set).sort()
  }, [positions, majorMap])

  const filtered = useMemo(() => {
    let result = positions
    if (selectedMajor) {
      result = result.filter((p) => p.majors.some((id) => majorMap.get(id) === selectedMajor))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortName.toLowerCase().includes(q) ||
          (industryMap.get(p.industry) || "").toLowerCase().includes(q) ||
          p.majors.some((id) => (majorMap.get(id) || "").toLowerCase().includes(q))
      )
    }
    return result
  }, [positions, selectedMajor, search, industryMap, majorMap])

  const batchMap = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches])

  const getMajorNames = (ids: string[]) => {
    if (ids.length === 0) return "-"
    return ids.map((id) => majorMap.get(id) || id).join("，")
  }

  const handleRestore = async (position: Position) => {
    try {
      await positionApi.saveDraft(position.id)
      await loadData()
      toast({ title: "已恢复" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "恢复失败", description: err.message || "请稍后重试" })
    }
  }

  const handleDelete = async (position: Position) => {
    if (!window.confirm(`确定删除岗位「${position.name}」吗？删除后不可恢复。`)) return
    try {
      await positionApi.delete(position.id)
      setSelectedIds((prev) => prev.filter((id) => id !== position.id))
      await loadData()
      toast({ title: "已删除" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message || "请稍后重试" })
    }
  }

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id)
    )
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filtered.map((p) => p.id) : [])
  }

  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return
    try {
      await Promise.all(selectedIds.map((id) => positionApi.saveDraft(id)))
      setSelectedIds([])
      await loadData()
      toast({ title: `已批量恢复 ${selectedIds.length} 个岗位` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "批量恢复失败", description: err.message || "请稍后重试" })
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`确定删除选中的 ${selectedIds.length} 个岗位吗？删除后不可恢复。`)) return
    try {
      await Promise.all(selectedIds.map((id) => positionApi.delete(id)))
      setSelectedIds([])
      await loadData()
      toast({ title: `已批量删除 ${selectedIds.length} 个岗位` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "批量删除失败", description: err.message || "请稍后重试" })
    }
  }

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id))
  const someSelected = filtered.some((p) => selectedIds.includes(p.id)) && !allSelected

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">岗位历史档案库</h1>
        <p className="text-muted-foreground mt-1">
          查看已归档的岗位记录，支持恢复为草稿继续编辑
        </p>
      </div>

      <div className="flex gap-4 items-start">
        <div className="w-64 shrink-0 rounded-lg border border-gray-100 bg-white shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-primary" />按专业归档
          </h3>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              <button
                onClick={() => setSelectedMajor(null)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                  selectedMajor === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                全部专业
              </button>
              {majors.map((major) => (
                <button
                  key={major}
                  onClick={() => setSelectedMajor(major)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                    selectedMajor === major ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {major}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索岗位名称 / 简称 / 行业 / 专业"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white shadow-sm p-3">
              <span className="text-sm text-muted-foreground">
                已选择 <span className="font-medium text-foreground">{selectedIds.length}</span> 个岗位
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleBatchRestore}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  批量恢复
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  批量删除
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 px-3">
                      <Checkbox
                        checked={someSelected ? "indeterminate" : allSelected}
                        onCheckedChange={(checked) => handleSelectAll(checked === true)}
                        aria-label="全选"
                      />
                    </TableHead>
                    <TableHead className="w-44">岗位名称</TableHead>
                    <TableHead className="w-24">简称</TableHead>
                    <TableHead className="w-20">版本</TableHead>
                    <TableHead className="w-24">所属行业</TableHead>
                    <TableHead className="w-32">适用专业</TableHead>
                    <TableHead className="w-28">所属批次分组</TableHead>
                    <TableHead className="w-24">归档时间</TableHead>
                    <TableHead className="w-20">状态</TableHead>
                    <TableHead className="w-28 text-right px-3">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                        暂无归档岗位
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((entry) => {
                      const st = statusConfig[entry.status] || statusConfig.draft
                      const isSelected = selectedIds.includes(entry.id)
                      return (
                        <TableRow key={entry.id} className="group" data-state={isSelected ? "selected" : undefined}>
                          <TableCell className="px-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelect(entry.id, checked === true)}
                              aria-label={`选择 ${entry.name}`}
                            />
                          </TableCell>
                          <TableCell className="max-w-44">
                            <div>
                              <span className="font-medium line-clamp-1">{entry.name}</span>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {industryMap.get(entry.industry) || "-"} · {getMajorNames(entry.majors)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-24 truncate">{entry.shortName || "-"}</TableCell>
                          <TableCell className="text-sm">{entry.version}</TableCell>
                          <TableCell className="text-sm max-w-24 truncate">{industryMap.get(entry.industry) || "-"}</TableCell>
                          <TableCell className="text-sm max-w-32 truncate">{getMajorNames(entry.majors)}</TableCell>
                          <TableCell className="text-sm max-w-28 truncate">{entry.batchId ? batchMap.get(entry.batchId)?.name || "-" : "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(entry.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs whitespace-nowrap ${st.className}`}>
                              {st.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right px-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                                <Link href={`/job/positions/${entry.id}/edit`}>
                                  <Eye className="mr-1 h-3 w-3" />
                                  查看
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                                onClick={() => handleRestore(entry)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                恢复
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(entry)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                删除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
