"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { CheckCircle2, Zap, MessageSquare, Trophy, Users, ClipboardList } from "lucide-react"
import { CourseClassSelector, type CourseClassSelection } from "../_components/course-class-selector"
import { lessonBehaviorApi } from "@/lib/api"
import type { LessonBehaviorAggregate } from "@/lib/types"

const emptyAggregate: LessonBehaviorAggregate = {
  signIn: { total: 0, present: 0, late: 0, absent: 0, rate: 0 },
  signInDaily: [],
  quizResults: [],
  rushAnswerRanking: [],
  classInteraction: [],
  attendanceRateData: [],
  studentDetails: [],
}

function normalizeAggregate(res: LessonBehaviorAggregate): LessonBehaviorAggregate {
  return {
    signIn: res.signIn ?? emptyAggregate.signIn,
    signInDaily: res.signInDaily ?? [],
    quizResults: res.quizResults ?? [],
    rushAnswerRanking: res.rushAnswerRanking ?? [],
    classInteraction: res.classInteraction ?? [],
    attendanceRateData: res.attendanceRateData ?? [],
    studentDetails: res.studentDetails ?? [],
  }
}

export default function BehaviorCollectionPage() {
  const [selection, setSelection] = useState<CourseClassSelection | null>(null)
  const [data, setData] = useState<LessonBehaviorAggregate>(emptyAggregate)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selection?.courseId) return
    setLoading(true)
    lessonBehaviorApi
      .aggregate({ courseId: selection.courseId })
      .then((res) => setData(normalizeAggregate(res)))
      .catch(() => setData(emptyAggregate))
      .finally(() => setLoading(false))
  }, [selection?.courseId])

  const { signIn, signInDaily, quizResults, rushAnswerRanking, classInteraction, attendanceRateData, studentDetails } = data
  const quizAvg = quizResults.length
    ? Math.round(quizResults.reduce((s, q) => s + q.avgScore, 0) / quizResults.length)
    : 0
  const interactionTotal = classInteraction.reduce((s, i) => s + i.active, 0)
  const rushTotal = classInteraction.find((i) => i.name === "抢答")?.active ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">课程学习跟踪</h1>
        <p className="text-muted-foreground mt-1">跟踪课堂学习过程数据，包括签到、随堂测验、课堂互动等课中学习行为</p>
      </div>

      <CourseClassSelector onSelect={setSelection} showSession={false} />

      {loading && (
        <div className="text-sm text-muted-foreground">加载中...</div>
      )}

      {/* 签到统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">应到人数</p>
                <p className="text-2xl font-bold">{signIn.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-100 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">实到/迟到/缺勤</p>
                <p className="text-2xl font-bold">{signIn.present}<span className="text-base font-normal text-muted-foreground">/{signIn.late}/{signIn.absent}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-100 text-purple-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">随堂测验均分</p>
                <p className="text-2xl font-bold">{quizAvg}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">抢答参与率</p>
                <p className="text-2xl font-bold">{signIn.total > 0 ? Math.round((rushTotal / signIn.total) * 100) : 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-100 text-cyan-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">课堂互动次数</p>
                <p className="text-2xl font-bold">{interactionTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 每日签到 + 随堂测验 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              每日签到统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signInDaily.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={signInDaily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="present" fill="#22c55e" stackId="a" name="实到" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill="#f59e0b" stackId="a" name="迟到" />
                  <Bar dataKey="absent" fill="#ef4444" stackId="a" name="缺勤" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">暂无签到数据</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-purple-500" />
              随堂测验成绩
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quizResults.length > 0 ? quizResults.map((q) => (
              <div key={q.id} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{q.name}</span>
                  <span className="text-xs text-muted-foreground">参与 {q.count} 人</span>
                </div>
                <Progress value={q.avgScore} className="h-2 mb-1" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>平均分 {q.avgScore}</span>
                  <span>通过率 {q.passRate}%</span>
                </div>
              </div>
            )) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">暂无测验数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 抢答排行 + 出勤趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              课堂抢答排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rushAnswerRanking.length > 0 ? (
              <div className="space-y-2">
                {rushAnswerRanking.map((r) => (
                  <div key={r.rank} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-5 text-center ${r.rank <= 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {r.rank === 1 ? <Trophy className="h-4 w-4 inline text-amber-500" /> : r.rank}
                      </span>
                      <span className="text-sm">{r.name}</span>
                      {r.badge && <Badge variant="secondary" className="text-[10px]">{r.badge}</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>正确 {r.correctCount} 题</span>
                      <span>平均 {r.avgTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">暂无抢答数据</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">出勤率趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceRateData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={attendanceRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} name="出勤率%" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">暂无出勤趋势数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 课堂互动参与度 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">课堂互动参与度</CardTitle>
        </CardHeader>
        <CardContent>
          {classInteraction.length > 0 ? (
            <div className="space-y-3">
              {classInteraction.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.active}/{item.total} 次</span>
                  </div>
                  <Progress value={item.total > 0 ? (item.active / item.total) * 100 : 0} className="h-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">暂无互动数据</div>
          )}
        </CardContent>
      </Card>

      {/* 学生课中学习明细 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">学生课中学习明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">姓名</TableHead>
                  <TableHead className="text-xs">出勤率</TableHead>
                  <TableHead className="text-xs">随堂测验均分</TableHead>
                  <TableHead className="text-xs">课堂互动次数</TableHead>
                  <TableHead className="text-xs">表扬次数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentDetails.length > 0 ? studentDetails.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="text-sm font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm">{s.attendance}%</TableCell>
                    <TableCell className="text-sm">{s.quizAvg}</TableCell>
                    <TableCell className="text-sm">{s.interaction}</TableCell>
                    <TableCell className="text-sm">{s.praise}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">暂无学生明细</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
