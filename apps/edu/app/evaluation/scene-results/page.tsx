"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Eye, FileText, PenLine, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { evaluationResultApi, scenarioApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { SceneEvaluationResult } from "@/lib/types"
import type { Scenario } from "@/lib/types/scene"

function formatDateTime(value: string | Date | undefined): string {
  if (!value) return "-"
  const d = typeof value === "string" ? new Date(value) : value
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SceneResultsPage() {
  const [results, setResults] = useState<SceneEvaluationResult[]>([])
  const [scenes, setScenes] = useState<Record<string, Scenario>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "evaluated">("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [resultsRes, scenesRes] = await Promise.all([
          evaluationResultApi.list(),
          scenarioApi.list(),
        ])
        setResults(resultsRes.items)
        const sceneMap: Record<string, Scenario> = {}
        for (const scene of scenesRes.items) {
          sceneMap[scene.id] = scene
        }
        setScenes(sceneMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载测评结果失败")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredResults = useMemo(() => {
    let rows = results
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.taskId.toLowerCase().includes(q) ||
          r.evaluateeId.toLowerCase().includes(q) ||
          r.methodKey.toLowerCase().includes(q) ||
          (r.sceneId && scenes[r.sceneId]?.name?.toLowerCase().includes(q))
      )
    }
    return rows
  }, [results, statusFilter, searchQuery, scenes])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">场景任务测评结果</h1>
          <p className="text-sm text-gray-500 mt-1">查看并评分学生提交的场景任务测评结果</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索任务、学生或场景..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待评分</SelectItem>
              <SelectItem value="evaluated">已评分</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>测评任务</TableHead>
                <TableHead>学生 / 被评人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>得分 / 满分</TableHead>
                <TableHead>评分人</TableHead>
                <TableHead>评分时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    暂无测评结果
                  </TableCell>
                </TableRow>
              ) : (
                filteredResults.map((result) => {
                  const scene = result.sceneId ? scenes[result.sceneId] : undefined
                  return (
                    <TableRow key={result.id}>
                      <TableCell>
                        <div className="font-medium">{result.taskId}</div>
                        {scene && (
                          <div className="text-xs text-muted-foreground">
                            {scene.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{result.evaluateeId}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            result.status === "evaluated"
                              ? "bg-green-50 text-green-600 border-green-200"
                              : "bg-amber-50 text-amber-600 border-amber-200"
                          )}
                        >
                          {result.status === "evaluated" ? "已评分" : "待评分"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {result.totalScore !== undefined ? result.totalScore : "-"}
                        </span>
                        <span className="text-muted-foreground"> / {result.maxScore}</span>
                      </TableCell>
                      <TableCell>{result.gradedBy || result.evaluatorId || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(result.gradedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/evaluation/scene-results/${result.id}`}>
                            {result.status === "evaluated" ? (
                              <>
                                <Eye className="mr-1 h-3.5 w-3.5" /> 查看
                              </>
                            ) : (
                              <>
                                <PenLine className="mr-1 h-3.5 w-3.5" /> 评分
                              </>
                            )}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
