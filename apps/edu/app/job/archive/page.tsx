"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Search,
  Archive,
  Building2,
  GraduationCap,
  MoreHorizontal,
} from "lucide-react"
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

  const industries = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => {
      const name = industryMap.get(p.industry)
      if (name) set.add(name)
    })
    return Array.from(set).sort()
  }, [positions, industryMap])

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">岗位历史档案库</h1>
        <p className="text-muted-foreground mt-1">
          查看已归档的岗位记录，支持恢复为草稿继续编辑
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">归档岗位总数</p>
                <p className="text-2xl font-bold mt-1">{positions.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-100 text-purple-600">
                <Archive className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">覆盖行业</p>
                <p className="text-2xl font-bold mt-1">{industries.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">覆盖专业</p>
                <p className="text-2xl font-bold mt-1">{majors.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-100 text-green-600">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
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

        <div className="flex-1 space-y-4">
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

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>岗位名称</TableHead>
                  <TableHead>简称</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>所属行业</TableHead>
                  <TableHead>适用专业</TableHead>
                  <TableHead>所属批次分组</TableHead>
                  <TableHead>归档时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      暂无归档岗位
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((entry) => {
                    const st = statusConfig[entry.status] || statusConfig.draft
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{entry.name}</span>
                            <p className="text-xs text-muted-foreground">
                              {industryMap.get(entry.industry) || "-"} · {getMajorNames(entry.majors)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.shortName || "-"}</TableCell>
                        <TableCell className="text-sm">{entry.version}</TableCell>
                        <TableCell className="text-sm">{industryMap.get(entry.industry) || "-"}</TableCell>
                        <TableCell className="text-sm">{getMajorNames(entry.majors)}</TableCell>
                        <TableCell className="text-sm">{entry.batchId ? batchMap.get(entry.batchId)?.name || "-" : "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${st.className}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/job/positions/${entry.id}/edit`}>
                                  查看
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRestore(entry)} className="text-blue-600">
                                恢复
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
  )
}
