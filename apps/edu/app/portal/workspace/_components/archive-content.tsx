"use client"

import {
  BookOpen,
  CalendarDays,
  Clock,
  Download,
  FileText,
  MonitorPlay,
  StickyNote,
  Award,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { mockStudentInfo, mockStudyTime, mockActivityItems, mockEvaluations } from "../_data/mock-student-data"

export function ArchiveContent() {
  return (
    <div className="space-y-5">
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {mockStudentInfo.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{mockStudentInfo.name}</h2>
              <p className="text-sm text-gray-500">
                学号：{mockStudentInfo.studentNo} · {mockStudentInfo.major} · {mockStudentInfo.grade}
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Download className="h-4 w-4" />
              导出 PDF 档案
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MonitorPlay className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">已观看视频</p>
                <p className="text-xl font-bold text-gray-900">24</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">已阅读课件</p>
                <p className="text-xl font-bold text-gray-900">38</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <StickyNote className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">作业提交</p>
                <p className="text-xl font-bold text-gray-900">16</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">测验参与</p>
                <p className="text-xl font-bold text-gray-900">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              学习时长统计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockStudyTime.length === 0 && (
              <div className="py-6 text-center text-xs text-gray-400">暂无学习时长数据</div>
            )}
            {mockStudyTime.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className="text-sm font-semibold text-gray-900">
                  {item.value} {item.unit}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-900 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-green-500" />
              学习活跃度
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockActivityItems.length === 0 && (
              <div className="py-6 text-center text-xs text-gray-400">暂无学习活跃度数据</div>
            )}
            {mockActivityItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className="text-sm font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-900 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            教师评价
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockEvaluations.length === 0 && (
            <div className="py-6 text-center text-xs text-gray-400">暂无教师评价</div>
          )}
          {mockEvaluations.map((ev, i) => (
            <div key={i} className={`p-3 rounded-lg ${ev.bgColor} border ${ev.borderColor}`}>
              <p className={`text-xs ${ev.color} font-medium mb-1`}>{ev.typeLabel}</p>
              <p className={`text-sm ${ev.color.replace("600", "800")}`}>{ev.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
