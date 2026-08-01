'use client'

import { useEffect, useState } from 'react'
import { Award, FileCheck, GraduationCap, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@zhiyu/ui'
import { SectionCard } from './section-card'
import { portalApi } from '@/lib/api'
import type { WorkspaceExam } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ==================== Mock 岗位认定数据 ====================

interface AssessmentIndicator {
  label: string
  value: string
}

interface PositionAssessment {
  id: string
  positionName: string
  indicators: AssessmentIndicator[]
  details: { name: string; score: number; level: string; required: string; passed: boolean }[]
}

// 岗位能力认定数据应由后端测评结果 API 提供，默认空状态
const emptyPositionAssessments: PositionAssessment[] = []

const typeIconMap: Record<string, typeof GraduationCap> = {
  随堂测: FileCheck,
  单元测试: FileCheck,
  在线测评: GraduationCap,
  岗位能力认定: Award,
}

export function AssessmentTab() {
  const [exams, setExams] = useState<WorkspaceExam[]>([])
  const [loading, setLoading] = useState(true)
  const [examFilter, setExamFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await portalApi.workspaceDashboard({ role: 'student' })
        if (!cancelled) setExams(res.exams || [])
      } catch {
        if (!cancelled) setExams([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredExams = examFilter === 'all' ? exams : exams.filter((e) => e.status === examFilter)

  return (
    <div className="space-y-5">
      {/* ===== 岗位能力认定结果 ===== */}
      <SectionCard title="岗位能力认定结果" icon={Award} iconColor="amber">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {emptyPositionAssessments.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-gray-400">
              暂无岗位能力认定结果
            </div>
          )}
          {emptyPositionAssessments.map((pa) => (
            <div
              key={pa.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              {/* 岗位头 */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-4 py-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500" />
                  {pa.positionName}
                </h4>
              </div>
              {/* 四项指标 */}
              <div className="grid grid-cols-2 gap-3 p-4">
                {pa.indicators.map((ind) => (
                  <div
                    key={ind.label}
                    className="rounded-lg border border-gray-200 p-2.5 text-center"
                  >
                    <p className="text-xs text-gray-500 leading-tight">{ind.label}</p>
                    <p className="text-lg font-bold leading-tight mt-0.5">{ind.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ===== 参与的考试/测评清单 ===== */}
      <SectionCard title="参与的日常考试与期末测评" icon={FileCheck} iconColor="blue">
        {/* 状态筛选 */}
        <Tabs value={examFilter} onValueChange={setExamFilter}>
          <TabsList className="h-8 bg-gray-100 mb-4">
            <TabsTrigger
              value="all"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              全部
            </TabsTrigger>
            <TabsTrigger
              value="待考"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              待考
            </TabsTrigger>
            <TabsTrigger
              value="进行中"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              进行中
            </TabsTrigger>
            <TabsTrigger
              value="已完成"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              已完成
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-8">序号</TableHead>
                <TableHead className="text-xs">考试名称</TableHead>
                <TableHead className="text-xs">类型</TableHead>
                <TableHead className="text-xs">状态</TableHead>
                <TableHead className="text-xs">时间</TableHead>
                <TableHead className="text-xs">时长</TableHead>
                <TableHead className="text-xs text-right">结果</TableHead>
                <TableHead className="text-xs text-right w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-xs text-gray-400 py-10">
                    加载中...
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filteredExams.map((exam, i) => {
                  const Icon = typeIconMap[exam.type]
                  return (
                    <TableRow key={exam.id}>
                      <TableCell className="text-xs text-gray-400">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-gray-400" />
                          {exam.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{exam.type}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={exam.status}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {exam.startTime || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{exam.duration}分钟</TableCell>
                      <TableCell className="text-xs text-right font-semibold">
                        {exam.score !== undefined ? (
                          <span className="text-emerald-600">
                            {exam.score}/{exam.totalScore}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="text-[10px] h-7 px-2">
                          {exam.status === '已完成' ? '查看' : '进入'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
          {!loading && filteredExams.length === 0 && (
            <div className="py-10 text-center text-xs text-gray-400">暂无记录</div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
