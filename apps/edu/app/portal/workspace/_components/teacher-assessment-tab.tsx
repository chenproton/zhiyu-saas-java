'use client'

import { useState } from 'react'
import {
  FileCheck,
  TrendingUp,
  ClipboardList,
  MessageSquare,
  Clock,
  BookOpen,
  BarChart3,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { SectionCard } from './section-card'
import { StatCard } from './stat-card'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import {
  mockHomeworkSubmissions,
  mockHomeworkTrend,
  mockPeerReviewStats,
  mockTrainingReports,
} from '../_data/mock-teacher-data'

export function TeacherAssessmentTab() {
  return (
    <div className="space-y-5">
      {/* 顶部统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="作业提交率"
          value="78%"
          icon={FileCheck}
          trend="4 项作业进行中"
          color="blue"
        />
        <StatCard
          title="课后测验均分"
          value={78}
          icon={ClipboardList}
          trend="3 次测验已完成"
          color="purple"
        />
        <StatCard
          title="互评完成率"
          value={`${mockPeerReviewStats.completionRate}%`}
          icon={MessageSquare}
          trend={`${mockPeerReviewStats.totalGroups} 个小组`}
          color="green"
        />
        <StatCard
          title="综合评测均分"
          value={83}
          icon={BarChart3}
          trend="较上月 +3.2%"
          trendUp
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 课后作业提交 */}
        <SectionCard title="课后作业提交" icon={BookOpen} iconColor="blue">
          <div className="space-y-4">
            {mockHomeworkSubmissions.length === 0 && (
              <div className="py-6 text-center text-xs text-gray-400">暂无课后作业数据</div>
            )}
            {mockHomeworkSubmissions.map((hw) => (
              <div key={hw.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="text-sm font-medium">{hw.name}</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      截止 {hw.deadline} · 共 {hw.total} 人
                    </p>
                  </div>
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
                    {hw.submitRate}% 已提交
                  </Badge>
                </div>
                <Progress value={hw.submitRate} className="h-2 mb-1" />
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    已提交 {Math.round((hw.total * hw.submitRate) / 100)}/{hw.total} 人
                  </span>
                  {hw.submitRate >= 70 && <span>均分 {hw.avgScore}</span>}
                  {hw.submitRate < 70 && <span>截止日期：{hw.deadline}</span>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 作业提交率趋势 */}
        <SectionCard title="作业提交率趋势" icon={TrendingUp} iconColor="green">
          <ResponsiveContainer width="100%" height={260}>
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
                name="提交率%"
              />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* 单元测验分析 */}
      <SectionCard title="单元测验分析" icon={ClipboardList} iconColor="purple">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockHomeworkSubmissions
            .filter((hw) => hw.avgScore > 0)
            .map((hw) => (
              <div key={hw.id} className="p-4 rounded-xl border border-gray-100 bg-white">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">{hw.name}</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">提交率</span>
                    <span className="font-semibold">{hw.submitRate}%</span>
                  </div>
                  <Progress value={hw.submitRate} className="h-1.5" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">平均分</span>
                    <span className="font-semibold text-blue-600">{hw.avgScore}/100</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">已提交</span>
                    <span className="font-semibold">
                      {Math.round((hw.total * hw.submitRate) / 100)}/{hw.total} 人
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t">
                  <div className="text-[10px] text-gray-400">分数分布</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500 w-10">90-100</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: '35%' }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500 w-10">80-89</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '30%' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500 w-10">70-79</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: '20%' }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500 w-10">60-69</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: '10%' }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500 w-10">&lt;60</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: '5%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </SectionCard>

      {/* 互评统计 */}
      <SectionCard title="互评互判统计" icon={MessageSquare} iconColor="green">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 text-center">
            <div className="text-2xl font-bold text-blue-700">
              {mockPeerReviewStats.totalGroups}
            </div>
            <div className="text-xs text-blue-600/70 mt-1">总小组数</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200 text-center">
            <div className="text-2xl font-bold text-green-700">
              {mockPeerReviewStats.avgPeerScore}
            </div>
            <div className="text-xs text-green-600/70 mt-1">平均互评得分</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {mockPeerReviewStats.completionRate}%
            </div>
            <div className="text-xs text-purple-600/70 mt-1">完成率</div>
          </div>
        </div>
        <div className="space-y-3">
          {mockPeerReviewStats.steps.length === 0 && (
            <div className="py-4 text-center text-xs text-gray-400">暂无互评互判数据</div>
          )}
          {mockPeerReviewStats.steps.map((step) => (
            <div key={step.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{step.name}</span>
                <span className="text-xs text-gray-500">
                  权重 {step.weight}% · 均分 {step.avgScore}
                </span>
              </div>
              <Progress value={step.avgScore} className="h-2" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 实训报告 */}
      <SectionCard title="实训报告统计" icon={FileCheck} iconColor="amber">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold">报告名称</TableHead>
                <TableHead className="text-xs font-semibold">已提交/总数</TableHead>
                <TableHead className="text-xs font-semibold">提交率</TableHead>
                <TableHead className="text-xs font-semibold">平均分</TableHead>
                <TableHead className="text-xs font-semibold">评价</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTrainingReports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-gray-400 py-8">
                    暂无实训报告数据
                  </TableCell>
                </TableRow>
              )}
              {mockTrainingReports.map((report) => (
                <TableRow key={report.name}>
                  <TableCell className="text-sm font-medium">{report.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {report.submitted}/{report.total}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <Progress value={report.rate} className="h-1.5 w-20" />
                      <span className="text-gray-500">{report.rate}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
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
                    >
                      {report.rating}
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
