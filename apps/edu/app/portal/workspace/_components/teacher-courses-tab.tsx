'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Calendar,
  MapPin,
  Users,
  ClipboardList,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  Zap,
  MessageSquare,
  Trophy,
  FileCheck,
  ExternalLink,
  PlayCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SectionCard } from './section-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PrepAssociateDialog } from './prep-associate-dialog'
import { HybridGradingDialog } from './hybrid-grading-dialog'
import { portalApi, courseApi } from '@/lib/api'
import { SCENE_PLATFORM_URL } from '@/lib/external-links'
import type { WorkspaceDashboard, WorkspaceClassPlan } from '@/lib/types'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { type PrepAssociationRecord } from '../_data/workspace-teacher-types'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import {
  mockSignInData,
  mockSignInDaily,
  mockQuizResults,
  mockRushAnswerRanking,
  mockClassInteraction,
  mockAttendanceRateData,
  mockStudentDetails,
  mockHomeworkSubmissions,
  mockHomeworkTrend,
  mockPeerReviewStats,
  mockTrainingReports,
  mockSemesterSummary,
  mockAssessmentDimensions,
  mockCompositeDistribution,
  mockStudentRanking,
} from '../_data/workspace-teacher-types'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useT } from '@/lib/i18n/locale-provider'

const gradeColorMap: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-primary/10 text-primary',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-red-100 text-red-700',
  E: 'bg-gray-100 text-gray-700',
}

interface SelectedCourse {
  id: string
  name: string
  className: string
  students: number
}

function TrackingView() {
  const t = useT()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-gray-500">{t('应到人数')}</p>
              <p className="text-lg font-bold">{mockSignInData.total}</p>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-green-50 border border-green-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-gray-500">{t('实到/迟到/缺勤')}</p>
              <p className="text-lg font-bold">
                {mockSignInData.present}
                <span className="text-sm font-normal text-gray-400">
                  /{mockSignInData.late}/{mockSignInData.absent}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-xs text-gray-500">{t('随堂测验均分')}</p>
              <p className="text-lg font-bold">
                {mockQuizResults.length > 0
                  ? Math.round(
                      mockQuizResults.reduce((s, q) => s + q.avgScore, 0) / mockQuizResults.length,
                    )
                  : 0}
              </p>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-xs text-gray-500">{t('抢答参与率')}</p>
              <p className="text-lg font-bold">0%</p>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-600" />
            <div>
              <p className="text-xs text-gray-500">{t('课堂互动次数')}</p>
              <p className="text-lg font-bold">28</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('每日签到统计')}</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockSignInDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar
                dataKey="present"
                fill="#22c55e"
                stackId="a"
                name={t('实到')}
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="late" fill="#f59e0b" stackId="a" name={t('迟到')} />
              <Bar dataKey="absent" fill="#ef4444" stackId="a" name={t('缺勤')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('出勤率趋势')}</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockAttendanceRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[80, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="rate" fill="var(--primary)" radius={[4, 4, 0, 0]} name={t('出勤率%')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('课堂抢答排行')}</h4>
          <div className="space-y-2">
            {mockRushAnswerRanking.map((r) => (
              <div
                key={r.rank}
                className="flex items-center justify-between py-1.5 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold w-5 ${r.rank <= 3 ? 'text-amber-500' : 'text-gray-400'}`}
                  >
                    {r.rank === 1 ? <Trophy className="h-4 w-4 inline text-amber-500" /> : r.rank}
                  </span>
                  <span className="text-sm">{r.name}</span>
                  {r.badge && (
                    <Badge variant="secondary" className="text-[10px]">
                      {r.badge}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {t('正确 {correctCount} 题 · {avgTime}', {
                    correctCount: r.correctCount,
                    avgTime: r.avgTime,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('课堂互动参与度')}</h4>
          <div className="space-y-3">
            {mockClassInteraction.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-xs text-gray-400">
                    {t('{active}/{total} 次', { active: item.active, total: item.total })}
                  </span>
                </div>
                <Progress value={(item.active / item.total) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <h4 className="text-sm font-semibold p-4 pb-2">{t('学生课中学习明细')}</h4>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs">{t('姓名')}</TableHead>
              <TableHead className="text-xs">{t('出勤率')}</TableHead>
              <TableHead className="text-xs">{t('测验均分')}</TableHead>
              <TableHead className="text-xs">{t('互动次数')}</TableHead>
              <TableHead className="text-xs">{t('表扬次数')}</TableHead>
              <TableHead className="text-xs">{t('综合评价')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockStudentDetails.slice(0, 6).map((s) => (
              <TableRow key={s.name}>
                <TableCell className="text-sm font-medium">{s.name}</TableCell>
                <TableCell className="text-sm">{s.attendance}%</TableCell>
                <TableCell className="text-sm">{s.quizAvg}</TableCell>
                <TableCell className="text-sm">{s.interaction}</TableCell>
                <TableCell className="text-sm">{s.praise}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      s.grade === '优秀'
                        ? 'default'
                        : s.grade === '良好'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="text-xs"
                  >
                    {s.grade}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AssessmentView() {
  const t = useT()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('课后作业提交')}</h4>
          <div className="space-y-3">
            {mockHomeworkSubmissions.map((hw) => (
              <div key={hw.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{hw.name}</span>
                  <Badge
                    variant={
                      hw.submitRate >= 90
                        ? 'default'
                        : hw.submitRate >= 70
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="text-xs"
                  >
                    {hw.submitRate}%
                  </Badge>
                </div>
                <Progress value={hw.submitRate} className="h-1.5 mb-1" />
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {t('已提交 {submitted}/{total} 人', {
                      submitted: Math.round((hw.total * hw.submitRate) / 100),
                      total: hw.total,
                    })}
                  </span>
                  {hw.submitRate >= 70 && (
                    <span>{t('均分 {avgScore}', { avgScore: hw.avgScore })}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('作业提交率趋势')}</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mockHomeworkTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <h4 className="text-sm font-semibold mb-3">{t('单元测验分数分布')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {mockHomeworkSubmissions
            .filter((hw) => hw.avgScore > 0)
            .map((hw) => (
              <div key={hw.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <h5 className="text-sm font-medium mb-2">{hw.name}</h5>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{t('提交率')}</span>
                    <span className="font-semibold">{hw.submitRate}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{t('平均分')}</span>
                    <span className="font-semibold text-primary">{hw.avgScore}/100</span>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {[
                    ['90-100', 35, '#22c55e'],
                    ['80-89', 30, '#3b82f6'],
                    ['70-79', 20, '#f59e0b'],
                    ['60-69', 10, '#f97316'],
                    ['<60', 5, '#ef4444'],
                  ].map(([label, w, color]) => (
                    <div key={label as string} className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-400 w-10">{label}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${w}%`, backgroundColor: color as string }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <h4 className="text-sm font-semibold mb-3">{t('互评互判统计')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/10">
            <div className="text-xl font-bold text-primary">{mockPeerReviewStats.totalGroups}</div>
            <div className="text-[10px] text-primary">{t('总小组数')}</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="text-xl font-bold text-green-700">
              {mockPeerReviewStats.avgPeerScore}
            </div>
            <div className="text-[10px] text-green-500">{t('平均互评得分')}</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="text-xl font-bold text-purple-700">
              {mockPeerReviewStats.completionRate}%
            </div>
            <div className="text-[10px] text-purple-500">{t('完成率')}</div>
          </div>
        </div>
        {mockPeerReviewStats.steps.map((step) => (
          <div key={step.name} className="space-y-1 mb-2">
            <div className="flex items-center justify-between text-sm">
              <span>{step.name}</span>
              <span className="text-xs text-gray-400">
                {t('权重 {weight}% · 均分 {avgScore}', {
                  weight: step.weight,
                  avgScore: step.avgScore,
                })}
              </span>
            </div>
            <Progress value={step.avgScore} className="h-1.5" />
          </div>
        ))}
      </div>

      <div className="border rounded-xl overflow-hidden">
        <h4 className="text-sm font-semibold p-4 pb-2">{t('实训报告统计')}</h4>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs">{t('报告名称')}</TableHead>
              <TableHead className="text-xs">{t('已提交/总数')}</TableHead>
              <TableHead className="text-xs">{t('提交率')}</TableHead>
              <TableHead className="text-xs">{t('平均分')}</TableHead>
              <TableHead className="text-xs">{t('评价')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTrainingReports.map((report) => (
              <TableRow key={report.name}>
                <TableCell className="text-sm font-medium">{report.name}</TableCell>
                <TableCell className="text-sm">
                  {report.submitted}/{report.total}
                </TableCell>
                <TableCell className="text-sm">{report.rate}%</TableCell>
                <TableCell className="text-sm">
                  {report.avgScore > 0 ? report.avgScore : '-'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      report.rating === '良好'
                        ? 'default'
                        : report.rating === '待提交'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="text-xs"
                  >
                    {report.rating}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function FinalView() {
  const t = useT()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
          <div className="text-lg font-bold text-primary">{mockSemesterSummary.totalSessions}</div>
          <div className="text-[10px] text-primary">{t('课程节次')}</div>
        </div>
        <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-center">
          <div className="text-lg font-bold text-green-700">
            {mockSemesterSummary.avgAttendance}%
          </div>
          <div className="text-[10px] text-green-500">{t('平均出勤率')}</div>
        </div>
        <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
          <div className="text-lg font-bold text-purple-700">
            {mockSemesterSummary.compositeAvgScore}
          </div>
          <div className="text-[10px] text-purple-500">{t('综合评测均分')}</div>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
          <div className="text-lg font-bold text-amber-700">
            {mockSemesterSummary.totalStudents}
          </div>
          <div className="text-[10px] text-amber-500">{t('总学生数')}</div>
        </div>
        <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100 text-center">
          <div className="text-lg font-bold text-cyan-700">
            {mockSemesterSummary.dataCollectionRate}%
          </div>
          <div className="text-[10px] text-cyan-500">{t('数据采集率')}</div>
        </div>
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-center">
          <div className="text-lg font-bold text-rose-700">{mockSemesterSummary.needAttention}</div>
          <div className="text-[10px] text-rose-500">{t('需关注学生')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('过程性考核维度')}</h4>
          <div className="space-y-3">
            {mockAssessmentDimensions.slice(0, 6).map((dim) => (
              <div key={dim.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {dim.name}{' '}
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {dim.category}
                    </Badge>
                  </span>
                  <span className="font-semibold">{dim.avgScore > 0 ? dim.avgScore : '-'}</span>
                </div>
                <Progress value={dim.avgScore} className="h-1.5" />
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">{t('综合成绩分布')}</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockCompositeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name={t('学生数')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <h4 className="text-sm font-semibold p-4 pb-2">{t('学生综合排名')}</h4>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs w-10">{t('排名')}</TableHead>
              <TableHead className="text-xs">{t('姓名')}</TableHead>
              <TableHead className="text-xs">{t('出勤')}</TableHead>
              <TableHead className="text-xs">{t('随堂测验')}</TableHead>
              <TableHead className="text-xs">{t('课后作业')}</TableHead>
              <TableHead className="text-xs">{t('互评')}</TableHead>
              <TableHead className="text-xs">{t('实训报告')}</TableHead>
              <TableHead className="text-xs">{t('总评')}</TableHead>
              <TableHead className="text-xs">{t('等级')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockStudentRanking.map((student) => (
              <TableRow key={student.rank}>
                <TableCell className="text-sm font-bold text-center">{student.rank}</TableCell>
                <TableCell className="text-sm font-medium">{student.name}</TableCell>
                <TableCell className="text-sm">{student.attendance}%</TableCell>
                <TableCell className="text-sm">{student.inClassQuiz}</TableCell>
                <TableCell className="text-sm">{student.homework}</TableCell>
                <TableCell className="text-sm">{student.peerReview}</TableCell>
                <TableCell className="text-sm">{student.report}</TableCell>
                <TableCell className="text-sm font-bold text-primary">{student.total}</TableCell>
                <TableCell>
                  <Badge
                    className={`text-xs font-bold ${gradeColorMap[student.grade] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {student.grade}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function CourseDetailDialog({
  open,
  onOpenChange,
  course,
  initialTab,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: SelectedCourse | null
  initialTab: string
}) {
  const t = useT()
  const titleMap: Record<string, string> = {
    tracking: t('节次教学进展'),
    assessment: t('节次测评进展'),
    final: t('课程教学进展分析'),
  }

  const renderContent = () => {
    switch (initialTab) {
      case 'tracking':
        return <TrackingView />
      case 'assessment':
        return <AssessmentView />
      case 'final':
        return <FinalView />
      default:
        return <TrackingView />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-none max-w-[65vw] w-[65vw] max-h-[92vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            {course?.name}
            <Badge variant="outline">{course?.className}</Badge>
            <Badge variant="secondary">{t('{count}人', { count: course?.students ?? 0 })}</Badge>
            <Badge className="bg-primary/10 text-primary">{titleMap[initialTab] || ''}</Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-2 mt-2">{renderContent()}</ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

interface TeacherCoursesTabProps {
  prepAssociations?: Record<string, PrepAssociationRecord>
  onAssociate?: (
    fn: (prev: Record<string, PrepAssociationRecord>) => Record<string, PrepAssociationRecord>,
  ) => void
}

export function TeacherCoursesTab({
  prepAssociations = {},
  onAssociate,
}: TeacherCoursesTabProps = {}) {
  const router = useRouter()
  const t = useT()
  const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null)
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(null)
  const [dialogTab, setDialogTab] = useState('tracking')

  const [prepDialogOpen, setPrepDialogOpen] = useState(false)
  const [prepPlanId, setPrepPlanId] = useState('')
  const [prepSessionId, setPrepSessionId] = useState('')
  const [prepPlanName, setPrepPlanName] = useState('')
  const [prepIsHybrid, setPrepIsHybrid] = useState(true)
  const [prepUrl, setPrepUrl] = useState('')
  const [, setPrepSessionLabels] = useState<Record<string, string>>({})

  const [hybridGradeDialogOpen, setHybridGradeDialogOpen] = useState(false)
  const [hybridGradeSessionTitle, setHybridGradeSessionTitle] = useState('')
  const [hybridGradeClassName, setHybridGradeClassName] = useState('')
  const [hybridGradeCourseId, setHybridGradeCourseId] = useState<string | undefined>(undefined)

  useEffect(() => {
    portalApi
      .workspaceDashboard({ role: 'teacher' })
      .then((res) => setDashboard(res))
      .catch(() => setDashboard(null))
  }, [])

  const classPlans = useMemo(() => dashboard?.classPlans || [], [dashboard?.classPlans])
  const classSessions = useMemo(() => dashboard?.classSessions || [], [dashboard?.classSessions])

  const semesters = useMemo(() => {
    const terms = new Set(classPlans.map((p) => p.term).filter(Boolean))
    return Array.from(terms)
  }, [classPlans])

  useEffect(() => {
    if (semesters.length > 0 && !semesters.includes(selectedTerm)) {
      queueMicrotask(() => setSelectedTerm(semesters[0]))
    }
  }, [semesters, selectedTerm])

  const termPlans = useMemo(
    () => classPlans.filter((p) => p.term === selectedTerm),
    [classPlans, selectedTerm],
  )
  const selectedPlan = termPlans.find((p) => p.id === selectedPlanId) || null

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedPlanId((prev) => {
        if (prev && termPlans.some((p) => p.id === prev)) return prev
        return termPlans[0]?.id || null
      })
    })
  }, [selectedTerm, termPlans])

  const openSessionDialog = (plan: WorkspaceClassPlan, tab: string) => {
    setSelectedCourse({
      id: plan.id,
      name: plan.course,
      className: plan.name,
      students: plan.students,
    })
    setDialogTab(tab)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Tabs value={selectedTerm} onValueChange={setSelectedTerm}>
          <TabsList className="h-9 bg-white border border-gray-100 shadow-sm">
            {semesters.map((term) => (
              <TabsTrigger
                key={term}
                value={term}
                className="text-xs px-3 data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                <Calendar className="h-3.5 w-3.5 mr-1" />
                {term}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧课程/场景导航 */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gradient-to-r from-gray-50 to-white p-3">
              <h3 className="text-sm font-semibold text-gray-900">{t('课程/场景')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('共 {count} 个', { count: termPlans.length })}
              </p>
            </div>
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-2">
              {termPlans.map((plan) => {
                const sessions = classSessions.filter((s) => s.courseId === plan.id)
                const isHybrid = !!plan.courseId
                const courseTypeTag = isHybrid ? t('混合课程') : t('实践场景')
                const isActive = selectedPlanId === plan.id
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all mb-1 ${
                      isActive
                        ? 'bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/15 shadow-sm'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 ${isHybrid ? 'bg-gradient-to-br from-primary to-primary/70' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}
                    >
                      {plan.course.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-gray-900'}`}
                        >
                          {plan.course}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {plan.name}
                        </Badge>
                        <Badge
                          className={`text-[10px] h-4 px-1 border-0 text-white ${isHybrid ? 'bg-gradient-to-r from-primary to-primary/70' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                        >
                          {courseTypeTag}
                        </Badge>
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${isActive ? 'text-primary' : 'text-gray-400'}`}
                      >
                        {t('{count} 个节次', { count: sessions.length })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 右侧节次内容 */}
        <div className="lg:col-span-9">
          <SectionCard title={t('节次列表')} icon={Calendar} iconColor="blue">
            {!selectedPlan ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <BookOpen className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm font-medium">{t('请从左侧选择课程/场景')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const plan = selectedPlan
                  const sessions = classSessions
                    .filter((s) => s.courseId === plan.id)
                    .sort((a, b) => a.week - b.week)
                  const isHybrid = !!plan.courseId
                  const courseTypeTag = isHybrid ? t('混合课程') : t('实践场景')
                  const accentColors = isHybrid
                    ? {
                        bg: 'from-primary/5 to-primary/10',
                        border: 'border-primary/10 hover:border-primary/30',
                        iconBg: 'bg-gradient-to-br from-primary to-primary/70',
                        badgeBg: 'bg-gradient-to-r from-primary to-primary/70',
                        prepUrl: '/lesson/admin/hybrid/add?id=hybrid-1',
                        learnUrl: plan.courseId ? `/lesson/landing/${plan.courseId}` : '',
                      }
                    : {
                        bg: 'from-emerald-50 to-teal-50',
                        border: 'border-emerald-100 hover:border-emerald-300',
                        iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
                        badgeBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
                        prepUrl: `${SCENE_PLATFORM_URL}/student_teacher.html?task=task-1-1`,
                        learnUrl: plan.scenarioId ? `/scene/landing/${plan.scenarioId}` : '',
                      }
                  return (
                    <div
                      key={plan.id}
                      className={`group rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${accentColors.border}`}
                    >
                      {/* 课程头部 */}
                      <div
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r ${accentColors.bg}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg font-bold text-white ${accentColors.iconBg}`}
                          >
                            {plan.course.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold text-gray-900">{plan.course}</h3>
                              <Badge variant="outline" className="text-xs">
                                {plan.name}
                              </Badge>
                              <StatusBadge
                                status={plan.status}
                                label={plan.status === 'active' ? t('已开课') : t('待开课')}
                              />
                              <Badge
                                className={`text-[10px] font-semibold border-0 text-white ${accentColors.badgeBg}`}
                              >
                                {courseTypeTag}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {t('{students}人 · {term} · 任课教师：{teacher}', {
                                students: plan.students,
                                term: plan.term,
                                teacher: plan.teacher,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            className={`text-white text-xs h-7 shadow-sm ${isHybrid ? 'bg-gradient-to-r from-primary to-primary/70 hover:from-primary/90 hover:to-primary/60' : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800'}`}
                            onClick={() => openSessionDialog(plan, 'final')}
                          >
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {t('课程期末总评')}
                          </Button>
                        </div>
                      </div>
                      {/* 节次列表 */}
                      {sessions.length > 0 && (
                        <div className="px-4 pb-5 pt-2">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-400">
                              <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1 align-middle" />
                              {t('已上 {count} 节', {
                                count: sessions.filter((s) => s.status === 'associated').length,
                              })}
                              <span className="inline-block w-2 h-2 rounded-full bg-gray-300 ml-3 mr-1 align-middle" />
                              {t('未上 {count} 节', {
                                count: sessions.filter((s) => s.status === 'pending').length,
                              })}
                              <span className="text-gray-300 mx-2">·</span>
                              {t('共 {count} 个节次', { count: sessions.length })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                            {sessions.map((session) => {
                              const isDone = session.status === 'associated'
                              const sessionBg = isHybrid
                                ? isDone
                                  ? 'bg-primary/5'
                                  : 'bg-white'
                                : isDone
                                  ? 'bg-emerald-50'
                                  : 'bg-white'
                              const sessionBorder = isHybrid
                                ? isDone
                                  ? 'border-primary/15'
                                  : 'border-gray-200'
                                : isDone
                                  ? 'border-emerald-200'
                                  : 'border-gray-200'
                              const sessionBadge = isHybrid
                                ? isDone
                                  ? 'border-primary/30 text-primary'
                                  : 'border-gray-300 text-gray-500'
                                : isDone
                                  ? 'border-emerald-300 text-emerald-600'
                                  : 'border-gray-300 text-gray-500'
                              return (
                                <Popover key={session.id}>
                                  <PopoverTrigger asChild>
                                    <div
                                      className={`rounded-lg p-2.5 text-xs space-y-1.5 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ring-1 ring-transparent hover:ring-primary/30 border ${sessionBorder} ${sessionBg}`}
                                    >
                                      <div className="flex items-center gap-1">
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] h-4 px-1 font-medium ${sessionBadge}`}
                                        >
                                          {isDone ? t('已上') : t('未上')}
                                        </Badge>
                                        <span className="text-[10px] text-gray-500 truncate">
                                          {session.weekday}
                                        </span>
                                      </div>
                                      <div className="font-semibold text-gray-900 truncate">
                                        {t('第 {week} 周', { week: session.week })}
                                      </div>
                                      <div className="text-[10px] text-gray-500 truncate">
                                        {session.period
                                          .replace('上午 ', '上')
                                          .replace('下午 ', '下')}
                                      </div>
                                      {session.venue && (
                                        <div className="text-[10px] text-gray-400 flex items-center gap-1 truncate">
                                          <MapPin className="h-3 w-3 shrink-0" />
                                          {session.venue}
                                        </div>
                                      )}
                                      <div className="text-[10px] text-primary font-medium">
                                        {t('点击查看操作')}
                                      </div>
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    side="right"
                                    align="start"
                                    sideOffset={6}
                                    className="w-72 p-3 bg-white shadow-xl border-gray-200 rounded-xl"
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-800">
                                          {t('第 {week} 周 · {weekday} {period}', {
                                            week: session.week,
                                            weekday: session.weekday,
                                            period: session.period,
                                          })}
                                        </span>
                                        <Badge
                                          variant={isDone ? 'default' : 'secondary'}
                                          className="text-[10px] h-4 px-1.5"
                                        >
                                          {isDone ? t('已上') : t('未上')}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>{session.venue}</span>
                                      </div>
                                      {(() => {
                                        const existing = prepAssociations[session.id]
                                        if (existing && existing.subItems.length > 0) {
                                          return (
                                            <div className="rounded-lg border border-primary/10 bg-primary/5 p-2 space-y-1">
                                              <span className="text-[10px] text-primary font-medium block">
                                                {isHybrid ? t('已关联节次') : t('已关联任务')}（
                                                {existing.subItems.length}）
                                              </span>
                                              <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                                                {existing.subItems.map((si) => (
                                                  <div
                                                    key={si.id}
                                                    className="text-xs text-gray-700 pl-2 border-l-2 border-primary/15"
                                                  >
                                                    {si.name}
                                                  </div>
                                                ))}
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="link"
                                                className="text-[10px] h-5 p-0 text-primary"
                                                onClick={() => {
                                                  setPrepPlanId(plan.id)
                                                  setPrepSessionId(session.id)
                                                  setPrepPlanName(plan.course)
                                                  setPrepIsHybrid(isHybrid)
                                                  setPrepUrl(accentColors.prepUrl)
                                                  setPrepDialogOpen(true)
                                                  setPrepSessionLabels((prev) => ({
                                                    ...prev,
                                                    [session.id]: `${session.weekday} ${session.period}`,
                                                  }))
                                                }}
                                              >
                                                {t('修改关联')}
                                              </Button>
                                            </div>
                                          )
                                        }
                                        return null
                                      })()}
                                      <span className="text-[10px] text-gray-400 block">
                                        {t('操作')}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className={`flex-1 justify-center text-[10px] h-7 px-1.5 ${isHybrid ? 'border-primary/15 text-primary hover:bg-primary/5' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                                          onClick={() => {
                                            setPrepPlanId(plan.id)
                                            setPrepSessionId(session.id)
                                            setPrepPlanName(plan.course)
                                            setPrepIsHybrid(isHybrid)
                                            setPrepUrl(accentColors.prepUrl)
                                            setPrepDialogOpen(true)
                                            setPrepSessionLabels((prev) => ({
                                              ...prev,
                                              [session.id]: `${session.weekday} ${session.period}`,
                                            }))
                                          }}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-0.5" />
                                          {isHybrid ? t('前往备课') : t('导学准备')}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className={`flex-1 justify-center text-[10px] h-7 px-1.5 ${isHybrid ? 'border-primary/15 text-primary hover:bg-primary/5' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                                          disabled={!accentColors.learnUrl}
                                          onClick={() => {
                                            if (accentColors.learnUrl)
                                              router.push(accentColors.learnUrl)
                                          }}
                                        >
                                          <PlayCircle className="h-3 w-3 mr-0.5" />
                                          {isHybrid ? t('上课') : t('前往导学')}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 justify-center text-[10px] h-7 px-1.5 border-amber-200 text-amber-600 hover:bg-amber-50"
                                          onClick={async () => {
                                            // 场景 plan → 场景任务评价
                                            if (!plan.courseId && plan.scenarioId) {
                                              router.push('/evaluation/scene-results')
                                              return
                                            }
                                            // 有课程 id：混合课保留考勤评分，体系课/颗粒课进课程节点测评评分
                                            if (plan.courseId) {
                                              try {
                                                const c = await courseApi.get(plan.courseId)
                                                if (c.type === 'hybrid') {
                                                  setHybridGradeSessionTitle(
                                                    t('第 {week} 周 · {weekday} {period}', {
                                                      week: session.week,
                                                      weekday: session.weekday,
                                                      period: session.period,
                                                    }),
                                                  )
                                                  setHybridGradeClassName(plan.name)
                                                  setHybridGradeCourseId(plan.courseId)
                                                  setHybridGradeDialogOpen(true)
                                                  return
                                                }
                                              } catch {
                                                /* 课程查询失败按非混合课处理 */
                                              }
                                            }
                                            router.push(
                                              plan.courseId
                                                ? `/evaluation/lesson-results?courseId=${plan.courseId}`
                                                : '/evaluation/lesson-results',
                                            )
                                          }}
                                        >
                                          <GraduationCap className="h-3 w-3 mr-0.5" />
                                          {t('前往评分')}
                                        </Button>
                                      </div>
                                      <div className="pt-1.5 mt-1 border-t border-dashed border-gray-200">
                                        <span className="text-[10px] text-gray-400 block mb-1">
                                          {t('数据查看')}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className={`flex-1 justify-center text-[10px] h-6 px-1.5 ${isHybrid ? 'text-primary hover:bg-primary/5' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                            onClick={() => {
                                              openSessionDialog(plan, 'tracking')
                                            }}
                                          >
                                            <TrendingUp className="h-3 w-3 mr-0.5" />
                                            {t('教学进展')}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="flex-1 justify-center text-[10px] h-6 px-1.5 text-primary hover:bg-primary/5"
                                            onClick={() => {
                                              openSessionDialog(plan, 'assessment')
                                            }}
                                          >
                                            <FileCheck className="h-3 w-3 mr-0.5" />
                                            {t('测评进展')}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <CourseDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        course={selectedCourse}
        initialTab={dialogTab}
      />
      <PrepAssociateDialog
        open={prepDialogOpen}
        onOpenChange={setPrepDialogOpen}
        planId={prepPlanId}
        planName={prepPlanName}
        isHybrid={prepIsHybrid}
        currentSubItemIds={prepAssociations[prepSessionId]?.subItems.map((s) => s.id)}
        prepUrl={prepUrl}
        onConfirm={(subItems) => {
          if (onAssociate) {
            onAssociate((prev) => ({
              ...prev,
              [prepSessionId]: {
                planId: prepPlanId,
                subItems: subItems.map((s) => ({ id: s.id, name: s.name })),
              },
            }))
          }
        }}
      />
      <HybridGradingDialog
        open={hybridGradeDialogOpen}
        onOpenChange={setHybridGradeDialogOpen}
        sessionTitle={hybridGradeSessionTitle}
        className={hybridGradeClassName}
        courseId={hybridGradeCourseId}
      />
    </div>
  )
}
