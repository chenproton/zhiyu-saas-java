'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, Eye, FileCheck, GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@zhiyu/ui'
import { SectionCard } from './section-card'
import { portalApi, jobAbilityResultApi } from '@/lib/api'
import type { WorkspaceExam, JobAbilityResult } from '@/lib/types'
import { examHref } from '@/lib/learn-links'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useT } from '@/lib/i18n/locale-provider'

const typeIconMap: Record<string, typeof GraduationCap> = {
  随堂测: FileCheck,
  单元测试: FileCheck,
  在线测评: GraduationCap,
  岗位能力认定: Award,
}

export function AssessmentTab() {
  const t = useT()
  const [exams, setExams] = useState<WorkspaceExam[]>([])
  const [loading, setLoading] = useState(true)
  const [examFilter, setExamFilter] = useState('all')

  const [results, setResults] = useState<JobAbilityResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<JobAbilityResult | null>(null)

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

  // 岗位能力认定结果：学生仅可查看本人的认定结果（后端按角色过滤）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setResultsLoading(true)
      try {
        const res = await jobAbilityResultApi.list({ page: 1, limit: 50 })
        if (!cancelled) setResults(res.items || [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setResultsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await jobAbilityResultApi.get(id))
    } catch {
      // 明细加载失败保持弹窗打开，展示兜底文案
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredExams = examFilter === 'all' ? exams : exams.filter((e) => e.status === examFilter)

  return (
    <div className="space-y-5">
      {/* ===== 岗位能力认定结果 ===== */}
      <SectionCard title={t('岗位能力认定结果')} icon={Award} iconColor="amber">
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs">{t('岗位名称')}</TableHead>
                <TableHead className="text-xs">{t('姓名')}</TableHead>
                <TableHead className="text-xs">{t('学号')}</TableHead>
                <TableHead className="text-xs">{t('所属院系')}</TableHead>
                <TableHead className="text-xs">{t('班级')}</TableHead>
                <TableHead className="text-xs">{t('岗位能力达成率')}</TableHead>
                <TableHead className="text-xs">{t('岗位胜任度')}</TableHead>
                <TableHead className="text-xs">{t('能力认证得分')}</TableHead>
                <TableHead className="text-xs text-right w-20">{t('操作')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultsLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-xs text-gray-400 py-10">
                    {t('加载中...')}
                  </TableCell>
                </TableRow>
              )}
              {!resultsLoading &&
                results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="text-sm font-medium">{result.positionName}</TableCell>
                    <TableCell className="text-sm">{result.studentName}</TableCell>
                    <TableCell className="text-xs text-gray-500">{result.studentId}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {result.department || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {result.className || '-'}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {result.totalAbilityPoints > 0
                        ? `${((result.achievedAbilityPoints / result.totalAbilityPoints) * 100).toFixed(0)}%`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {result.positionCompetency != null
                        ? `${result.positionCompetency.toFixed(1)}%`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {result.abilityCognitionScore != null
                        ? result.abilityCognitionScore.toFixed(1)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[10px] h-7 px-2"
                        onClick={() => openDetail(result.id)}
                      >
                        <Eye className="mr-1 w-3 h-3" />
                        {t('查看明细')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          {!resultsLoading && results.length === 0 && (
            <div className="py-10 text-center text-xs text-gray-400">
              {t('暂无岗位能力认定结果')}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ===== 参与的考试/测评清单 ===== */}
      <SectionCard title={t('参与的日常考试与期末测评')} icon={FileCheck} iconColor="blue">
        {/* 状态筛选 */}
        <Tabs value={examFilter} onValueChange={setExamFilter}>
          <TabsList className="h-8 bg-gray-100 mb-4">
            <TabsTrigger
              value="all"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              {t('全部')}
            </TabsTrigger>
            <TabsTrigger
              value="待考"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              {t('待考')}
            </TabsTrigger>
            <TabsTrigger
              value="进行中"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              {t('进行中')}
            </TabsTrigger>
            <TabsTrigger
              value="已完成"
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              {t('已完成')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-8">{t('序号')}</TableHead>
                <TableHead className="text-xs">{t('考试名称')}</TableHead>
                <TableHead className="text-xs">{t('类型')}</TableHead>
                <TableHead className="text-xs">{t('状态')}</TableHead>
                <TableHead className="text-xs">{t('时间')}</TableHead>
                <TableHead className="text-xs">{t('时长')}</TableHead>
                <TableHead className="text-xs text-right">{t('结果')}</TableHead>
                <TableHead className="text-xs text-right w-20">{t('操作')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-xs text-gray-400 py-10">
                    {t('加载中...')}
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
                      <TableCell className="text-xs">{t(exam.type)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={exam.status}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {exam.startTime || exam.endTime ? (
                          <span>
                            {exam.startTime || '-'}
                            {exam.endTime ? ` ~ ${exam.endTime}` : ''}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {t('{count}分钟', { count: exam.duration })}
                      </TableCell>
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
                        <Button size="sm" variant="ghost" className="text-[10px] h-7 px-2" asChild>
                          <Link
                            href={
                              // 试卷版本由作答页按 usage.examVersion 服务端解析，链接只带 usage
                              exam.examId ? examHref(exam.examId, { usage: exam.id }) : '#'
                            }
                          >
                            {exam.status === '已完成' ? t('查看') : t('进入')}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
          {!loading && filteredExams.length === 0 && (
            <div className="py-10 text-center text-xs text-gray-400">{t('暂无记录')}</div>
          )}
        </div>
      </SectionCard>

      {/* ===== 能力点认定明细弹窗 ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('能力点认定明细')}</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.studentName}（${detail.studentId}）· ${detail.positionName}`
                : t('加载中...')}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-gray-400">{t('加载中...')}</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">
                  {t('能力点达成 {achieved}/{total}', {
                    achieved: detail.achievedAbilityPoints,
                    total: detail.totalAbilityPoints,
                  })}
                </span>
                <span className="text-gray-500">
                  {t('达标率 {rate}%', { rate: (detail.achievementRate ?? 0).toFixed(1) })}
                </span>
                <span className="text-gray-500">
                  {t('认定时间 {time}', { time: formatDateTime(detail.evaluationTime) })}
                </span>
              </div>
              {detail.abilityPointDetails && detail.abilityPointDetails.length > 0 ? (
                <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('能力点')}</TableHead>
                        <TableHead className="w-[100px]">{t('得分')}</TableHead>
                        <TableHead className="w-[110px]">{t('档位')}</TableHead>
                        <TableHead className="w-[100px]">{t('权重')}</TableHead>
                        <TableHead className="w-[100px]">{t('是否达成')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.abilityPointDetails.map((point, index) => (
                        <TableRow key={point.abilityPointId || index}>
                          <TableCell className="text-sm">{point.abilityPointName}</TableCell>
                          <TableCell className="text-sm">
                            {point.maxScore != null
                              ? `${point.score}/${point.maxScore}`
                              : point.score}
                          </TableCell>
                          <TableCell className="text-sm">
                            {point.levelLabel ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  point.levelLabel === '未达标'
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-primary/5 text-primary border-primary/15',
                                )}
                              >
                                {t(point.levelLabel)}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {point.weight != null ? `${point.weight}%` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                point.achieved
                                  ? 'bg-green-50 text-green-600 border-green-200'
                                  : 'bg-red-50 text-red-600 border-red-200',
                              )}
                            >
                              {point.achieved ? t('已达成') : t('未达成')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">{t('暂无能力点明细')}</div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">{t('未找到结果明细')}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
