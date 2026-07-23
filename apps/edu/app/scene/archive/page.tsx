"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

        <div className="flex-1 space-y-4">
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

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>场景名称</TableHead>
                  <TableHead>场景编码</TableHead>
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
                      暂无归档场景
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((entry) => {
                    const st = statusConfig[entry.status] || statusConfig.draft
                    return (
                      <TableRow key={entry.id} className="group">
                        <TableCell>
                          <div>
                            <span className="font-medium">{entry.name}</span>
                            <p className="text-xs text-muted-foreground">
                              {(entry.professionNames || entry.professionIds || []).join("、") || "-"} · {(entry.industryNames || entry.industryIds || []).join("、") || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.code}</TableCell>
                        <TableCell className="text-sm">{entry.version}</TableCell>
                        <TableCell className="text-sm">{(entry.industryNames || entry.industryIds || []).join("、") || "-"}</TableCell>
                        <TableCell className="text-sm">{(entry.professionNames || entry.professionIds || []).join("、") || "-"}</TableCell>
                        <TableCell className="text-sm">{entry.batchId ? batchMap.get(entry.batchId)?.name || "-" : "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${st.className}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right relative">
                          <div className="flex items-center justify-end gap-1 absolute right-0 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm z-10 px-2 py-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
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
  )
}
