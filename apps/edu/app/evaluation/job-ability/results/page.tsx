"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Briefcase, User, Calendar, TrendingUp, AlertCircle, GraduationCap, Building2, BookOpen, Award } from "lucide-react"
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
import { useData } from "@/components/providers/data-provider"
import { StudentPortraitModal } from "@/components/shared/student-portrait-modal"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

export default function JobAbilityResultsPage() {
  const { jobAbilityResults, positionsList } = useData()

  const [search, setSearch] = useState("")
  const [selectedPositionId, setSelectedPositionId] = useState<string>("")
  const [rateFilter, setRateFilter] = useState<string>("all")
  const [portraitOpen, setPortraitOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<typeof filteredResults[0] | null>(null)

  // 左侧岗位列表（只显示有结果的岗位）
  // 当 positionsList 为空时，从结果中派生岗位列表，确保页面可导航
  const positionsWithResults = useMemo(() => {
    const resultMap = new Map<string, { id: string; name: string; positionCode: string }>()
    jobAbilityResults.forEach((r) => {
      if (!resultMap.has(r.positionId)) {
        resultMap.set(r.positionId, {
          id: r.positionId,
          name: r.positionName,
          positionCode: r.positionCode,
        })
      }
    })
    if (positionsList.length > 0) {
      const positionIds = new Set(jobAbilityResults.map((r) => r.positionId))
      return positionsList
        .filter((p) => positionIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, positionCode: p.positionCode }))
    }
    return Array.from(resultMap.values())
  }, [positionsList, jobAbilityResults])

  // 默认选中第一个岗位
  useEffect(() => {
    if (!selectedPositionId && positionsWithResults.length > 0) {
      setSelectedPositionId(positionsWithResults[0].id)
    }
  }, [positionsWithResults, selectedPositionId])

  // 右侧筛选后的结果
  const filteredResults = useMemo(() => {
    let results = [...jobAbilityResults]

    if (selectedPositionId) {
      results = results.filter((r) => r.positionId === selectedPositionId)
    }
    if (rateFilter !== "all") {
      if (rateFilter === "excellent") {
        results = results.filter((r) => r.achievementRate >= 90)
      } else if (rateFilter === "good") {
        results = results.filter((r) => r.achievementRate >= 80 && r.achievementRate < 90)
      } else if (rateFilter === "pass") {
        results = results.filter((r) => r.achievementRate >= 60 && r.achievementRate < 80)
      } else if (rateFilter === "fail") {
        results = results.filter((r) => r.achievementRate < 60)
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.positionName.toLowerCase().includes(q)
      )
    }

    return results.sort((a, b) => new Date(b.evaluationTime).getTime() - new Date(a.evaluationTime).getTime())
  }, [jobAbilityResults, selectedPositionId, rateFilter, search])

  const getGradeLabel = (grade?: string) => {
    if (!grade || grade === '-') return '-'
    return grade
  }

  const getRandomScore = (id: string) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash) % 101
  }

  const formatDateTime = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  }

  // 计算每个岗位的结果数量
  const getResultCount = (positionId: string) => {
    return jobAbilityResults.filter(r => r.positionId === positionId).length
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* 左侧岗位导航 */}
      <div className="flex w-64 flex-col border-r bg-white">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">岗位列表</h2>
          <p className="text-xs text-muted-foreground">点击岗位查看测评结果</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {positionsWithResults.map((pos) => (
              <button
                key={pos.id}
                onClick={() => setSelectedPositionId(pos.id)}
                className={`flex w-full flex-col rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedPositionId === pos.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{pos.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{getResultCount(pos.id)} 人</span>
                </div>
                <div className="text-xs text-muted-foreground">{pos.positionCode}</div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧结果列表 */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">岗位能力认定结果</h1>
          <p className="text-sm text-gray-500 mt-1">查看 {positionsList.find(p => p.id === selectedPositionId)?.name || ''} 的认定结果</p>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索学生姓名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* 结果列表 */}
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">学生名称</TableHead>
                  <TableHead className="w-[100px]">学号</TableHead>
                  <TableHead className="w-[120px]">班级</TableHead>
                  <TableHead className="w-[100px]">专业</TableHead>
                  <TableHead className="w-[100px]">院系</TableHead>
                  <TableHead className="w-[140px]">岗位能力达标率</TableHead>
                  <TableHead className="w-[120px]">岗位胜任度</TableHead>
                  <TableHead className="w-[120px]">岗位能力认定得分</TableHead>
                  <TableHead className="w-[140px]">更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {jobAbilityResults.length === 0 ? "暂无认定结果" : "没有找到匹配的认定结果"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 text-blue-500" />
                          <span className="text-sm">{result.studentName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.studentId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.className || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.majorName || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{result.department || '-'}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{result.achievementRate}%（{result.achievedAbilityPoints}/{result.totalAbilityPoints} 能力点达成）</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-purple-600">{getRandomScore(result.id)}%</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-blue-600">{getRandomScore(result.id)}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(result.evaluationTime)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <StudentPortraitModal
        open={portraitOpen}
        onOpenChange={setPortraitOpen}
        studentName={selectedStudent?.studentName || '学生'}
        className={selectedStudent?.className || '-'}
        positionId={selectedStudent?.positionId}
        department={selectedStudent?.department}
        major={selectedStudent?.majorName}
        grade={selectedStudent?.grade}
      />
    </div>
  )
}
