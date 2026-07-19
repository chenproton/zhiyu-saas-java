"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Search,
  GraduationCap,
  User,
  Award,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { examUsageApi, examResultApi } from "@/lib/api"
import { useMajorMap } from "@/lib/use-resource-maps"
import type { ExamUsage } from "@/lib/types"

interface ExamStudentResult {
  id: string
  studentName: string
  studentId: string
  className: string
  grade: string
  majorId: string
  score: number
  totalScore: number
  submitTime: Date
  isPass: boolean
  rank: number
}

function ExamResultsContent() {
  const searchParams = useSearchParams()
  const usageId = searchParams.get("usageId") || ""
  const [usage, setUsage] = useState<ExamUsage | null>(null)
  const [results, setResults] = useState<ExamStudentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [passFilter, setPassFilter] = useState<string>("all")
  const majorMap = useMajorMap()

  useEffect(() => {
    if (!usageId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      examUsageApi.get(usageId).catch(() => null),
      examResultApi.list({ usageId }).catch(() => ({ items: [], total: 0 })),
    ])
      .then(([usageRes, resultRes]) => {
        setUsage(usageRes)
        const items = resultRes.items || []
        setResults(
          items.map((r, idx) => ({
            id: r.id,
            studentName: r.studentName || "匿名",
            studentId: r.userId,
            className: r.className || "-",
            grade: r.grade || "-",
            majorId: r.majorName || "-",
            score: r.score,
            totalScore: r.totalScore,
            submitTime: new Date(r.submitTime),
            isPass: r.isPass,
            rank: idx + 1,
          }))
        )
      })
      .finally(() => setLoading(false))
  }, [usageId])

  const filteredResults = results.filter((r) => {
    if (passFilter !== "all") {
      if (passFilter === "pass" ? !r.isPass : r.isPass) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      return r.studentName.toLowerCase().includes(q)
    }
    return true
  })

  const stats = {
    total: results.length,
    pass: results.filter((r) => r.isPass).length,
    fail: results.length - results.filter((r) => r.isPass).length,
    avgScore: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0,
    maxScore: results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0,
    minScore: results.length > 0 ? Math.min(...results.map((r) => r.score)) : 0,
  }

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">考试记录不存在</h2>
          <p className="mb-4 text-muted-foreground">该考试记录可能已被删除</p>
          <Button asChild>
            <Link href="/evaluation/exam-usage">返回考试管理</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/evaluation/exam-usage">
            <ArrowLeft className="mr-1 size-4" />
            返回考试管理
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{usage.name}</h1>
            <Badge variant="outline" className="gap-1">
              <GraduationCap className="size-4" />
              在线考试
            </Badge>
          </div>
          <PrdAnnotation data={getAnnotation("eur-btn-export")}>
            <Button variant="outline" disabled>
              <Download className="mr-2 size-4" />
              导出数据
            </Button>
          </PrdAnnotation>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-slate-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">参考人数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">平均分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.avgScore}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">最高分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.maxScore}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">最低分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.minScore}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">及格人数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.pass}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">不及格人数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.fail}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索学生姓名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={passFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setPassFilter("all")}
          >
            全部
          </Button>
          <Button
            variant={passFilter === "pass" ? "default" : "outline"}
            size="sm"
            onClick={() => setPassFilter("pass")}
          >
            <CheckCircle2 className="mr-1 size-3.5 text-emerald-500" />
            及格
          </Button>
          <Button
            variant={passFilter === "fail" ? "default" : "outline"}
            size="sm"
            onClick={() => setPassFilter("fail")}
          >
            <XCircle className="mr-1 size-3.5 text-red-500" />
            不及格
          </Button>
        </div>
      </div>

      {/* 结果列表 */}
      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">
                  <PrdAnnotation data={getAnnotation("eur-col-student")}>
                    <div className="flex items-center gap-1">
                      <User className="size-3.5" />
                      学生名称
                    </div>
                  </PrdAnnotation>
                </TableHead>
                <TableHead className="w-[120px]">
                  <PrdAnnotation data={getAnnotation("eur-col-student-id")}>学号</PrdAnnotation>
                </TableHead>
                <TableHead className="w-[120px]">
                  <PrdAnnotation data={getAnnotation("eur-col-class")}>班级</PrdAnnotation>
                </TableHead>
                <TableHead className="w-[100px]">
                  <PrdAnnotation data={getAnnotation("eur-col-grade")}>年级</PrdAnnotation>
                </TableHead>
                <TableHead className="w-[140px]">
                  <PrdAnnotation data={getAnnotation("eur-col-major")}>专业</PrdAnnotation>
                </TableHead>
                <TableHead className="w-[160px]">
                  <PrdAnnotation data={getAnnotation("eur-col-submit-time")}>考试时间</PrdAnnotation>
                </TableHead>
                <TableHead className="w-[100px]">
                  <PrdAnnotation data={getAnnotation("eur-col-score")}>
                    <div className="flex items-center gap-1">
                      <Award className="size-3.5" />
                      考试得分
                    </div>
                  </PrdAnnotation>
                </TableHead>
                <TableHead className="w-[100px]">
                  <PrdAnnotation data={getAnnotation("eur-col-pass")}>是否及格</PrdAnnotation>
                </TableHead>
                <TableHead className="sticky right-0 w-[100px] bg-white text-right">
                  <PrdAnnotation data={getAnnotation("eur-col-actions")}>操作</PrdAnnotation>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {results.length === 0 ? "暂无考试结果" : "没有找到匹配的结果"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex w-6 items-center justify-center text-xs font-semibold text-muted-foreground">
                          {result.rank}
                        </span>
                        <User className="size-3.5 text-blue-500" />
                        <span className="text-sm">{result.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{result.studentId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{result.className}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{result.grade}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{majorMap.get(result.majorId) || result.majorId || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(result.submitTime)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{result.score}</span>
                        <span className="text-xs text-muted-foreground">/ {result.totalScore}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            result.isPass ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          style={{ width: `${(result.score / result.totalScore) * 100}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.isPass ? (
                        <Badge variant="default" className="gap-1 bg-emerald-500">
                          <CheckCircle2 className="size-3" />
                          及格
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="size-3" />
                          不及格
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-white text-right">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                        <Eye className="size-3.5" />
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export default function ExamResultsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted-foreground">加载中...</div>}>
      <ExamResultsContent />
    </Suspense>
  )
}
