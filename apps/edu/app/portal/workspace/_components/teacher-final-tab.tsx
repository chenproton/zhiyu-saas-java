'use client'

import { useState } from 'react'
import { BarChart3, GraduationCap, TrendingUp, Users, AlertCircle, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { SectionCard } from './section-card'
import { StatCard } from './stat-card'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import {
  mockSemesterSummary,
  mockAssessmentDimensions,
  mockCompositeDistribution,
  mockSessionSummary,
  mockStudentRanking,
} from '../_data/mock-teacher-data'

const gradeColorMap: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-red-100 text-red-700',
  E: 'bg-gray-100 text-gray-700',
}

export function TeacherFinalTab() {
  const [dimensionFilter, setDimensionFilter] = useState('全部')

  const filteredDimensions = mockAssessmentDimensions.filter((d) => {
    if (dimensionFilter === '全部') return true
    return d.category === dimensionFilter
  })

  return (
    <div className="space-y-5">
      {/* 学期概览 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="课程节次总数"
          value={mockSemesterSummary.totalSessions}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="平均出勤率"
          value={`${mockSemesterSummary.avgAttendance}%`}
          icon={Users}
          color="green"
        />
        <StatCard
          title="综合评测均分"
          value={mockSemesterSummary.compositeAvgScore}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="总学生数"
          value={mockSemesterSummary.totalStudents}
          icon={Users}
          color="amber"
        />
        <StatCard
          title="数据采集率"
          value={`${mockSemesterSummary.dataCollectionRate}%`}
          icon={GraduationCap}
          color="cyan"
        />
        <StatCard
          title="需关注学生"
          value={mockSemesterSummary.needAttention}
          icon={AlertCircle}
          color="rose"
        />
      </div>

      {/* 过程性考核维度 */}
      <SectionCard title="过程性考核维度汇总" icon={BarChart3} iconColor="blue">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <Tabs value={dimensionFilter} onValueChange={setDimensionFilter}>
            <TabsList className="h-8 bg-gray-100">
              <TabsTrigger
                value="全部"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                全部
              </TabsTrigger>
              <TabsTrigger
                value="课中"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                课中
              </TabsTrigger>
              <TabsTrigger
                value="课后"
                className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                课后
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredDimensions.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-gray-400">
              暂无考核维度数据
            </div>
          )}
          {filteredDimensions.map((dim) => (
            <div
              key={dim.id}
              className="p-4 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">{dim.name}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${dim.category === '课中' ? 'border-blue-200 text-blue-600' : 'border-amber-200 text-amber-600'}`}
                >
                  {dim.category}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>权重 {dim.weight}%</span>
                  <span className="font-semibold text-gray-900">
                    {dim.avgScore > 0 ? dim.avgScore : '-'}
                  </span>
                </div>
                <Progress value={dim.avgScore} className="h-1.5" />
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>{dim.sessions} 个节次</span>
                  <StatusBadge status={dim.status} label={dim.status} className="h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 综合成绩分布 */}
        <SectionCard title="学期综合成绩分布" icon={BarChart3} iconColor="purple">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mockCompositeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="学生数" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* 课程节次明细 */}
        <SectionCard title="课程节次汇总明细" icon={BarChart3} iconColor="green">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs">周/日</TableHead>
                  <TableHead className="text-xs">主题</TableHead>
                  <TableHead className="text-xs">出勤率</TableHead>
                  <TableHead className="text-xs">测验均分</TableHead>
                  <TableHead className="text-xs">作业提交</TableHead>
                  <TableHead className="text-xs">作业均分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockSessionSummary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-gray-400 py-8">
                      暂无课程节次明细
                    </TableCell>
                  </TableRow>
                )}
                {mockSessionSummary.map((session, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-gray-500">
                      第{session.week}周 {session.day}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{session.topic}</TableCell>
                    <TableCell className="text-xs">{session.attendance}%</TableCell>
                    <TableCell className="text-xs">{session.quizAvg}</TableCell>
                    <TableCell className="text-xs">{session.homeworkRate}%</TableCell>
                    <TableCell className="text-xs">{session.homeworkAvg}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>

      {/* 学生综合排名 */}
      <SectionCard title="学生综合排名" icon={GraduationCap} iconColor="blue">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold w-12">排名</TableHead>
                <TableHead className="text-xs font-semibold">姓名</TableHead>
                <TableHead className="text-xs font-semibold">出勤</TableHead>
                <TableHead className="text-xs font-semibold">随堂测验</TableHead>
                <TableHead className="text-xs font-semibold">课后作业</TableHead>
                <TableHead className="text-xs font-semibold">互评</TableHead>
                <TableHead className="text-xs font-semibold">实训报告</TableHead>
                <TableHead className="text-xs font-semibold">总评</TableHead>
                <TableHead className="text-xs font-semibold">等级</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockStudentRanking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-xs text-gray-400 py-8">
                    暂无学生排名数据
                  </TableCell>
                </TableRow>
              )}
              {mockStudentRanking.map((student) => (
                <TableRow key={student.rank} className={student.rank <= 3 ? 'bg-blue-50/30' : ''}>
                  <TableCell className="text-sm font-bold text-center">
                    {student.rank <= 3 ? (
                      <span
                        className={
                          student.rank === 1
                            ? 'text-amber-500'
                            : student.rank === 2
                              ? 'text-gray-500'
                              : 'text-orange-500'
                        }
                      >
                        {student.rank}
                      </span>
                    ) : (
                      student.rank
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{student.name}</TableCell>
                  <TableCell className="text-sm">{student.attendance}%</TableCell>
                  <TableCell className="text-sm">{student.inClassQuiz}</TableCell>
                  <TableCell className="text-sm">{student.homework}</TableCell>
                  <TableCell className="text-sm">{student.peerReview}</TableCell>
                  <TableCell className="text-sm">{student.report}</TableCell>
                  <TableCell className="text-sm font-bold text-blue-600">{student.total}</TableCell>
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
      </SectionCard>
    </div>
  )
}
