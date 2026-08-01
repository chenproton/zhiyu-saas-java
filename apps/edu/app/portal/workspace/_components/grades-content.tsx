'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { Award, FileText, GraduationCap, TrendingUp } from 'lucide-react'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { mockGradeRecords, mockGradeTrend, mockCompareData } from '../_data/mock-student-data'

export function GradesContent() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const passedCount = mockGradeRecords.filter((g) => g.total >= 60).length
  const avgScore =
    mockGradeRecords.length > 0
      ? Math.round(mockGradeRecords.reduce((s, g) => s + g.total, 0) / mockGradeRecords.length)
      : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">本学期课程</p>
                <p className="text-2xl font-bold text-gray-900">{mockGradeRecords.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">已通过</p>
                <p className="text-2xl font-bold text-gray-900">{passedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">平均绩点</p>
                <p className="text-2xl font-bold text-gray-900">3.42</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">平均成绩</p>
                <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {mockGradeRecords.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
            暂无成绩记录
          </div>
        )}
        {mockGradeRecords.map((g) => {
          const isExpanded = expandedId === g.courseId
          return (
            <Card
              key={g.courseId}
              className="bg-white border border-gray-100 shadow-sm overflow-hidden"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                      {g.courseName.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-gray-900">{g.courseName}</h3>
                      <p className="text-xs text-gray-500">{g.teacher}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{g.total}</p>
                      <p className="text-xs text-gray-400">总评成绩</p>
                    </div>
                    <StatusBadge status={g.status} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-blue-600"
                      onClick={() => setExpandedId(isExpanded ? null : g.courseId)}
                    >
                      {isExpanded ? '收起' : '展开'}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-5 pt-5 border-t space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-blue-50">
                        <p className="text-xs text-blue-600 font-medium">平时成绩</p>
                        <p className="text-lg font-bold text-blue-700">
                          {g.usual} <span className="text-xs font-normal">×20%</span>
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50">
                        <p className="text-xs text-green-600 font-medium">期中成绩</p>
                        <p className="text-lg font-bold text-green-700">
                          {g.midterm} <span className="text-xs font-normal">×20%</span>
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-50">
                        <p className="text-xs text-purple-600 font-medium">期末成绩</p>
                        <p className="text-lg font-bold text-purple-700">
                          {g.final} <span className="text-xs font-normal">×50%</span>
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-orange-50">
                        <p className="text-xs text-orange-600 font-medium">实践成绩</p>
                        <p className="text-lg font-bold text-orange-700">
                          {g.practice} <span className="text-xs font-normal">×10%</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card className="border border-gray-100 shadow-none">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">成绩趋势</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={mockGradeTrend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="total"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                name="总评"
                              />
                              <Line
                                type="monotone"
                                dataKey="usual"
                                stroke="#10b981"
                                strokeWidth={2}
                                name="平时"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                      <Card className="border border-gray-100 shadow-none">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">个人 vs 班级平均</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={mockCompareData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                              <Tooltip />
                              <Bar
                                dataKey="self"
                                fill="#3b82f6"
                                name="个人"
                                radius={[4, 4, 0, 0]}
                              />
                              <Bar
                                dataKey="avg"
                                fill="#94a3b8"
                                name="班级平均"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
