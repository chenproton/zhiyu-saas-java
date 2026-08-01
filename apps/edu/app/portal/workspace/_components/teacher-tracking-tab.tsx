"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  CheckCircle2, Zap, MessageSquare, Trophy, Users, ClipboardList, TrendingUp,
} from "lucide-react"
import { SectionCard } from "./section-card"
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import {
  mockSignInData,
  mockSignInDaily,
  mockQuizResults,
  mockRushAnswerRanking,
  mockClassInteraction,
  mockAttendanceRateData,
  mockStudentDetails,
} from "../_data/mock-teacher-data"

export function TeacherTrackingTab() {
  return (
    <div className="space-y-5">
      {/* 签到统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SectionCard className="!p-0 !bg-white">
          <CardContent className="pt-5 px-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600"><Users className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">应到人数</p>
                <p className="text-2xl font-bold">{mockSignInData.total}</p>
              </div>
            </div>
          </CardContent>
        </SectionCard>
        <SectionCard className="!p-0 !bg-white">
          <CardContent className="pt-5 px-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-100 text-green-600"><CheckCircle2 className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">实到/迟到/缺勤</p>
                <p className="text-2xl font-bold">{mockSignInData.present}<span className="text-base font-normal text-gray-400">/{mockSignInData.late}/{mockSignInData.absent}</span></p>
              </div>
            </div>
          </CardContent>
        </SectionCard>
        <SectionCard className="!p-0 !bg-white">
          <CardContent className="pt-5 px-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-100 text-purple-600"><ClipboardList className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">随堂测验均分</p>
                <p className="text-2xl font-bold">
                  {mockQuizResults.length > 0
                    ? Math.round(mockQuizResults.reduce((s, q) => s + q.avgScore, 0) / mockQuizResults.length)
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </SectionCard>
        <SectionCard className="!p-0 !bg-white">
          <CardContent className="pt-5 px-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600"><Zap className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">抢答参与率</p>
                <p className="text-2xl font-bold">76%</p>
              </div>
            </div>
          </CardContent>
        </SectionCard>
        <SectionCard className="!p-0 !bg-white">
          <CardContent className="pt-5 px-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-100 text-cyan-600"><MessageSquare className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-gray-500">课堂互动次数</p>
                <p className="text-2xl font-bold">28</p>
              </div>
            </div>
          </CardContent>
        </SectionCard>
      </div>

      {/* 每日签到 + 随堂测验 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="每日签到统计" icon={CheckCircle2} iconColor="green">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mockSignInDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="present" fill="#22c55e" stackId="a" name="实到" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" fill="#f59e0b" stackId="a" name="迟到" />
              <Bar dataKey="absent" fill="#ef4444" stackId="a" name="缺勤" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="随堂测验成绩" icon={ClipboardList} iconColor="purple">
          <div className="space-y-4">
            {mockQuizResults.length === 0 && (
              <div className="py-6 text-center text-xs text-gray-400">暂无随堂测验数据</div>
            )}
            {mockQuizResults.map((q) => (
              <div key={q.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{q.name}</span>
                  <span className="text-xs text-gray-500">参与 {q.count} 人</span>
                </div>
                <Progress value={q.avgScore} className="h-2 mb-1" />
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>平均分 {q.avgScore}/{q.maxScore}</span>
                  <span>通过率 {q.passRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* 抢答排行 + 出勤趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="课堂抢答排行" icon={Zap} iconColor="amber">
          <div className="space-y-2">
            {mockRushAnswerRanking.length === 0 && (
              <div className="py-6 text-center text-xs text-gray-400">暂无抢答排行数据</div>
            )}
            {mockRushAnswerRanking.map((r) => (
              <div key={r.rank} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 text-center ${r.rank <= 3 ? "text-amber-500" : "text-gray-500"}`}>
                    {r.rank === 1 ? <Trophy className="h-4 w-4 inline text-amber-500" /> : r.rank}
                  </span>
                  <span className="text-sm">{r.name}</span>
                  {r.badge && <Badge variant="secondary" className="text-[10px]">{r.badge}</Badge>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>正确 {r.correctCount} 题</span>
                  <span>平均 {r.avgTime}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="出勤率趋势" icon={TrendingUp} iconColor="blue">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mockAttendanceRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis domain={[80, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} name="出勤率%" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* 课堂互动参与度 */}
      <SectionCard title="课堂互动参与度" icon={MessageSquare} iconColor="cyan">
        <div className="space-y-3">
          {mockClassInteraction.length === 0 && (
            <div className="py-6 text-center text-xs text-gray-400">暂无课堂互动数据</div>
          )}
          {mockClassInteraction.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{item.name}</span>
                <span className="text-xs text-gray-500">{item.active}/{item.total} 次</span>
              </div>
              <Progress value={(item.active / item.total) * 100} className="h-2" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 学生课中学习明细 */}
      <SectionCard title="学生课中学习明细" icon={Users} iconColor="blue">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold">姓名</TableHead>
                <TableHead className="text-xs font-semibold">出勤率</TableHead>
                <TableHead className="text-xs font-semibold">随堂测验均分</TableHead>
                <TableHead className="text-xs font-semibold">课堂互动次数</TableHead>
                <TableHead className="text-xs font-semibold">表扬次数</TableHead>
                <TableHead className="text-xs font-semibold">综合评价</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockStudentDetails.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-gray-400 py-8">
                    暂无学生明细
                  </TableCell>
                </TableRow>
              )}
              {mockStudentDetails.map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="text-sm font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.attendance}%</TableCell>
                  <TableCell className="text-sm">{s.quizAvg}</TableCell>
                  <TableCell className="text-sm">{s.interaction}</TableCell>
                  <TableCell className="text-sm">{s.praise}</TableCell>
                  <TableCell>
                    <Badge variant={s.grade === "优秀" ? "default" : s.grade === "良好" ? "secondary" : "destructive"} className="text-xs">
                      {s.grade}
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
