"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { scenarioApi, sceneBatchApi } from "@/lib/api"
import type { Scenario, SceneBatch } from "@/lib/types/scene"
import { useToast } from "@/hooks/use-toast"

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-gray-100 text-gray-500" },
  pending: { label: "审批中", className: "bg-yellow-50 text-yellow-600" },
  approved: { label: "已通过", className: "bg-blue-50 text-blue-600" },
  rejected: { label: "已驳回", className: "bg-red-50 text-red-500" },
  published: { label: "已发布", className: "bg-green-50 text-green-600" },
  archived: { label: "已归档", className: "bg-purple-50 text-purple-600" },
}

export default function SceneArchivePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [batches, setBatches] = useState<SceneBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const [scenarioRes, batchRes] = await Promise.all([
        scenarioApi.list({ status: "archived", limit: 1000 }),
        sceneBatchApi.list({ limit: 1000 }),
      ])
      setScenarios(scenarioRes.items)
      setBatches(batchRes.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取归档数据" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const professions = useMemo(() => {
    const set = new Set<string>()
    scenarios.forEach((s) => {
      (s.professionNames || s.professionIds || []).forEach((name) => set.add(name))
    })
    return Array.from(set).sort()
  }, [scenarios])

  const filtered = useMemo(() => {
    let result = scenarios
    if (selectedProfession) {
      result = result.filter((s) =>
        (s.professionNames || s.professionIds || []).includes(selectedProfession)
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.professionNames || s.professionIds || []).some((v) => v.toLowerCase().includes(q)) ||
          (s.industryNames || s.industryIds || []).some((v) => v.toLowerCase().includes(q))
      )
    }
    return result
  }, [scenarios, selectedProfession, search])

  const batchMap = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches])

  const handleRestore = async (scenario: Scenario) => {
    try {
      await scenarioApi.saveDraft(scenario.id)
      await loadData()
      toast({ title: "已恢复" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "恢复失败", description: err.message || "请稍后重试" })
    }
  }

  const handleDelete = async (scenario: Scenario) => {
    if (!window.confirm(`确定删除场景「${scenario.name}」吗？删除后不可恢复。`)) return
    try {
      await scenarioApi.delete(scenario.id)
      setSelectedIds((prev) => prev.filter((id) => id !== scenario.id))
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
    setSelectedIds(checked ? filtered.map((s) => s.id) : [])
  }

  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) return
    try {
      await Promise.all(selectedIds.map((id) => scenarioApi.saveDraft(id)))
      setSelectedIds([])
      await loadData()
      toast({ title: `已批量恢复 ${selectedIds.length} 个场景` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "批量恢复失败", description: err.message || "请稍后重试" })
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`确定删除选中的 ${selectedIds.length} 个场景吗？删除后不可恢复。`)) return
    try {
      await Promise.all(selectedIds.map((id) => scenarioApi.delete(id)))
      setSelectedIds([])
      await loadData()
      toast({ title: `已批量删除 ${selectedIds.length} 个场景` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "批量删除失败", description: err.message || "请稍后重试" })
    }
  }

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id))
  const someSelected = filtered.some((s) => selectedIds.includes(s.id)) && !allSelected

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">场景历史档案库</h1>
        <p className="text-muted-foreground mt-1">
          查看已归档的场景记录，支持恢复为草稿继续编辑
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
                onClick={() => setSelectedProfession(null)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                  selectedProfession === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                全部专业
              </button>
              {professions.map((prof) => (
                <button
                  key={prof}
                  onClick={() => setSelectedProfession(prof)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                    selectedProfession === prof ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {prof}
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
                placeholder="搜索场景名称 / 编码 / 专业 / 行业"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white shadow-sm p-3">
              <span className="text-sm text-muted-foreground">
                已选择 <span className="font-medium text-foreground">{selectedIds.length}</span> 个场景
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
                    <TableHead className="w-44">场景名称</TableHead>
                    <TableHead className="w-28">场景编码</TableHead>
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
                        暂无归档场景
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
                                {(entry.professionNames || entry.professionIds || []).join("、") || "-"} · {(entry.industryNames || entry.industryIds || []).join("、") || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-28 truncate">{entry.code}</TableCell>
                          <TableCell className="text-sm">{entry.version}</TableCell>
                          <TableCell className="text-sm max-w-24 truncate">{(entry.industryNames || entry.industryIds || []).join("、") || "-"}</TableCell>
                          <TableCell className="text-sm max-w-32 truncate">{(entry.professionNames || entry.professionIds || []).join("、") || "-"}</TableCell>
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
                                <Link href={`/scene/scenarios/${entry.id}/edit`}>
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
