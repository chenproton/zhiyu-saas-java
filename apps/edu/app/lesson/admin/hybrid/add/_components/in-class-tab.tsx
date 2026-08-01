'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Users,
  CheckCircle2,
  BarChart3,
  ClipboardList,
  Zap,
  Shuffle,
  MessageSquare,
  ArrowLeft,
  Play,
  Square,
  Plus,
  Trash2,
  QrCode,
  MapPin,
  Lock,
  UserCheck,
  Timer,
  Eye,
  Vote,
  HelpCircle,
} from 'lucide-react'

// ==================== Mock Data ====================

export const EMPTY_STUDENTS: { id: string; name: string; status: 'present' | 'late' | 'absent' }[] =
  []

export const VOTE_RESULTS: { option: string; count: number; percent: number }[] = []

export const SURVEY_RESULTS: (
  | { question: string; type: 'radio'; options: string[]; counts: number[] }
  | { question: string; type: 'text'; sampleAnswers: string[] }
)[] = []

// ==================== Feature Card ====================

function FeatureCard({
  icon,
  title,
  desc,
  colorClass,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  colorClass: string
  onClick: () => void
}) {
  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={onClick}>
      <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
        <div className={`rounded-full p-3 ${colorClass}`}>{icon}</div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  )
}

// ==================== Roll Call Panel ====================

export function RollCallPanel({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<'random' | 'sequential' | 'all'>('random')
  const [count, setCount] = useState(5)
  const [duration, setDuration] = useState(30)
  const [isActive, setIsActive] = useState(false)
  const [records, setRecords] = useState(() =>
    EMPTY_STUDENTS.map((s) => ({ ...s, called: Math.random() > 0.5 })),
  )

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium">课堂点名</h3>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">点名方式</Label>
              <div className="flex gap-1 mt-1.5">
                {[
                  { key: 'random' as const, label: '随机' },
                  { key: 'sequential' as const, label: '顺序' },
                  { key: 'all' as const, label: '全部' },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs border transition-all ${
                      mode === m.key
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">抽取人数</Label>
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1 text-sm"
                min={1}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">倒计时（秒）</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value) || 5))}
                className="mt-1 text-sm"
                min={5}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isActive ? (
              <Button variant="destructive" onClick={() => setIsActive(false)}>
                <Square className="h-4 w-4 mr-1" />
                结束点名
              </Button>
            ) : (
              <Button onClick={() => setIsActive(true)}>
                <Play className="h-4 w-4 mr-1" />
                开始点名
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">点名记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {records.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  s.called ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                }`}
              >
                <UserCheck
                  className={`h-3.5 w-3.5 ${s.called ? 'text-green-600' : 'text-gray-300'}`}
                />
                <span className="text-xs">{s.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== CheckIn Panel ====================

export function CheckInPanel({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<'gps' | 'qrcode' | 'password'>('qrcode')
  const [password, setPassword] = useState('CS101')
  const [gpsRadius, setGpsRadius] = useState(100)
  const [isActive, setIsActive] = useState(false)

  const stats = {
    total: EMPTY_STUDENTS.length,
    present: EMPTY_STUDENTS.filter((s) => s.status === 'present').length,
    late: EMPTY_STUDENTS.filter((s) => s.status === 'late').length,
    absent: EMPTY_STUDENTS.filter((s) => s.status === 'absent').length,
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium">签到管理</h3>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">应到人数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-muted-foreground">实到人数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{stats.late}</p>
            <p className="text-xs text-muted-foreground">迟到人数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.absent}</p>
            <p className="text-xs text-muted-foreground">缺勤人数</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">签到方式</Label>
            <div className="flex gap-2 mt-1.5">
              {[
                { key: 'gps' as const, label: 'GPS定位', icon: <MapPin className="h-3.5 w-3.5" /> },
                {
                  key: 'qrcode' as const,
                  label: '扫码签到',
                  icon: <QrCode className="h-3.5 w-3.5" />,
                },
                {
                  key: 'password' as const,
                  label: '口令签到',
                  icon: <Lock className="h-3.5 w-3.5" />,
                },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${
                    mode === m.key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {mode === 'password' && (
            <div>
              <Label className="text-xs text-muted-foreground">签到口令</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 text-sm max-w-xs"
              />
            </div>
          )}
          {mode === 'gps' && (
            <div>
              <Label className="text-xs text-muted-foreground">定位半径（米）</Label>
              <Input
                type="number"
                value={gpsRadius}
                onChange={(e) => setGpsRadius(Math.max(10, parseInt(e.target.value) || 10))}
                className="mt-1 text-sm max-w-xs"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            {isActive ? (
              <Button variant="destructive" onClick={() => setIsActive(false)}>
                <Square className="h-4 w-4 mr-1" />
                结束签到
              </Button>
            ) : (
              <Button onClick={() => setIsActive(true)}>
                <Play className="h-4 w-4 mr-1" />
                开始签到
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">签到明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {EMPTY_STUDENTS.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                    {s.name.charAt(0)}
                  </div>
                  <span className="text-sm">{s.name}</span>
                </div>
                <StatusBadge
                  status={s.status}
                  label={s.status === 'present' ? '已到' : s.status === 'late' ? '迟到' : '缺勤'}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Vote Panel ====================

export function VotePanel({ onBack }: { onBack?: () => void }) {
  const [title, setTitle] = useState('是否同意本次课程的教学方案调整？')
  const [options, setOptions] = useState(['支持', '反对', '弃权'])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [isActive, setIsActive] = useState(false)

  const addOption = () =>
    setOptions([...options, `选项 ${String.fromCharCode(65 + options.length)}`])
  const removeOption = (idx: number) => setOptions(options.filter((_, i) => i !== idx))
  const updateOption = (idx: number, val: string) => {
    const next = [...options]
    next[idx] = val
    setOptions(next)
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium">课堂投票</h3>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">投票主题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
            <span className="text-xs text-muted-foreground">允许多选</span>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">选项</Label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  className="text-sm flex-1"
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500"
                    onClick={() => removeOption(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={addOption}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加选项
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {isActive ? (
              <Button variant="destructive" onClick={() => setIsActive(false)}>
                <Square className="h-4 w-4 mr-1" />
                结束投票
              </Button>
            ) : (
              <Button onClick={() => setIsActive(true)}>
                <Play className="h-4 w-4 mr-1" />
                发布投票
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">投票结果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {VOTE_RESULTS.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">暂无投票数据</div>
          ) : (
            VOTE_RESULTS.map((r, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{r.option}</span>
                  <span className="text-muted-foreground">
                    {r.count} 票 ({r.percent}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${r.percent}%` }}
                  />
                </div>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground pt-1">
            共 {VOTE_RESULTS.reduce((s, r) => s + r.count, 0)} 人参与投票
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Survey Panel ====================

export function SurveyPanel({ onBack }: { onBack?: () => void }) {
  const [title, setTitle] = useState('课程满意度调查')
  const [isActive, setIsActive] = useState(false)

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium">课堂问卷</h3>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">问卷标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            {isActive ? (
              <Button variant="destructive" onClick={() => setIsActive(false)}>
                <Square className="h-4 w-4 mr-1" />
                结束问卷
              </Button>
            ) : (
              <Button onClick={() => setIsActive(true)}>
                <Play className="h-4 w-4 mr-1" />
                发布问卷
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">问卷统计</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {SURVEY_RESULTS.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">暂无问卷数据</div>
          ) : (
            SURVEY_RESULTS.map((q, qi) => (
              <div key={qi} className="space-y-2">
                <p className="text-sm font-medium">
                  {qi + 1}. {q.question}
                </p>
                {q.type === 'radio' && q.options && q.counts && (
                  <div className="space-y-1.5 pl-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-gray-600">{opt}</span>
                            <span className="text-gray-400">{q.counts[oi]} 人</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded-full"
                              style={{
                                width: `${(q.counts[oi] / (q.counts.reduce((a, b) => a + b, 0) || 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === 'text' && q.sampleAnswers && (
                  <div className="pl-2 space-y-1">
                    {q.sampleAnswers.map((ans, ai) => (
                      <div key={ai} className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                        {ans}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Quick Quiz (Rush Answer) Panel ====================

export function QuickQuizPanel({ onBack }: { onBack?: () => void }) {
  const [questions, setQuestions] = useState<{ id: string; content: string; timeLimit: number }[]>(
    [],
  )
  const [isActive, setIsActive] = useState(false)

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium">课堂抢答</h3>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            {isActive ? (
              <Button variant="destructive" onClick={() => setIsActive(false)}>
                <Square className="h-4 w-4 mr-1" />
                结束抢答
              </Button>
            ) : (
              <Button onClick={() => setIsActive(true)}>
                <Zap className="h-4 w-4 mr-1" />
                开始抢答
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {questions.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-4 border border-dashed rounded-lg">
                暂无抢答题目
              </div>
            ) : (
              questions.map((q, idx) => (
                <div key={q.id} className="flex items-center gap-2 border rounded-lg p-3">
                  <span className="text-xs font-medium text-primary shrink-0">Q{idx + 1}</span>
                  <span className="text-sm flex-1">{q.content}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    <Timer className="h-3 w-3 inline mr-0.5" />
                    {q.timeLimit}s
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">抢答排行</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-center text-sm text-gray-400 py-6">暂无抢答记录</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Grouping Panel ====================

export function GroupingPanel({ onBack }: { onBack?: () => void }) {
  const [groupSize, setGroupSize] = useState(3)
  const [method, setMethod] = useState<'random' | 'ability' | 'free'>('random')
  const [groups, setGroups] = useState<{ id: number; members: string[] }[]>([])

  const generateGroups = () => {
    const shuffled = [...EMPTY_STUDENTS].sort(() => Math.random() - 0.5)
    const result: { id: number; members: string[] }[] = []
    for (let i = 0; i < shuffled.length; i += groupSize) {
      result.push({
        id: result.length + 1,
        members: shuffled.slice(i, i + groupSize).map((s) => s.name),
      })
    }
    setGroups(result)
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium">随机分组</h3>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">每组人数</Label>
              <Input
                type="number"
                value={groupSize}
                onChange={(e) => setGroupSize(Math.max(2, parseInt(e.target.value) || 2))}
                className="mt-1 text-sm"
                min={2}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">分组方式</Label>
              <div className="flex gap-1 mt-1.5">
                {[
                  { key: 'random' as const, label: '随机' },
                  { key: 'ability' as const, label: '按能力' },
                  { key: 'free' as const, label: '自由组队' },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs border transition-all ${
                      method === m.key
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={generateGroups}>
            <Shuffle className="h-4 w-4 mr-1" />
            生成分组
          </Button>
        </CardContent>
      </Card>

      {groups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">第 {g.id} 组</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {g.members.map((m, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">
                      {m}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== Discussion Panel ====================

export function DiscussionPanel({ onBack }: { onBack?: () => void }) {
  const [topics, setTopics] = useState<
    { id: string; title: string; author: string; replies: number; likes: number; time: string }[]
  >([])
  const [newTopic, setNewTopic] = useState('')

  const addTopic = () => {
    if (!newTopic.trim()) return
    setTopics([
      {
        id: `d-${Date.now()}`,
        title: newTopic,
        author: '教师',
        replies: 0,
        likes: 0,
        time: '刚刚',
      },
      ...topics,
    ])
    setNewTopic('')
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium">课堂讨论</h3>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            placeholder="发起一个新的讨论话题..."
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={addTopic}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              发布话题
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {topics.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8 border border-dashed rounded-lg">
            暂无讨论话题
          </div>
        ) : (
          topics.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
              <CardContent className="p-4">
                <p className="text-sm font-medium">{t.title}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{t.author}</span>
                  <span>{t.time}</span>
                  <span>{t.replies} 回复</span>
                  <span>{t.likes} 赞</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// ==================== Main Panel ====================

export function InClassTab() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null)

  if (activeFeature === 'rollcall') return <RollCallPanel onBack={() => setActiveFeature(null)} />
  if (activeFeature === 'checkin') return <CheckInPanel onBack={() => setActiveFeature(null)} />
  if (activeFeature === 'vote') return <VotePanel onBack={() => setActiveFeature(null)} />
  if (activeFeature === 'survey') return <SurveyPanel onBack={() => setActiveFeature(null)} />
  if (activeFeature === 'quiz') return <QuickQuizPanel onBack={() => setActiveFeature(null)} />
  if (activeFeature === 'group') return <GroupingPanel onBack={() => setActiveFeature(null)} />
  if (activeFeature === 'discussion')
    return <DiscussionPanel onBack={() => setActiveFeature(null)} />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" disabled>
          暂无上课数据
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FeatureCard
          icon={<Users className="h-6 w-6 text-blue-600" />}
          title="课堂点名"
          desc="快速发起课堂点名"
          colorClass="bg-blue-100"
          onClick={() => setActiveFeature('rollcall')}
        />
        <FeatureCard
          icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
          title="签到管理"
          desc="查看学生签到情况"
          colorClass="bg-green-100"
          onClick={() => setActiveFeature('checkin')}
        />
        <FeatureCard
          icon={<BarChart3 className="h-6 w-6 text-purple-600" />}
          title="课堂投票"
          desc="发起实时投票互动"
          colorClass="bg-purple-100"
          onClick={() => setActiveFeature('vote')}
        />
        <FeatureCard
          icon={<ClipboardList className="h-6 w-6 text-amber-600" />}
          title="课堂问卷"
          desc="发放课堂调查问卷"
          colorClass="bg-amber-100"
          onClick={() => setActiveFeature('survey')}
        />
        <FeatureCard
          icon={<Zap className="h-6 w-6 text-red-600" />}
          title="课堂抢答"
          desc="实时抢答互动"
          colorClass="bg-red-100"
          onClick={() => setActiveFeature('quiz')}
        />
        <FeatureCard
          icon={<Shuffle className="h-6 w-6 text-cyan-600" />}
          title="随机分组"
          desc="智能分组协作"
          colorClass="bg-cyan-100"
          onClick={() => setActiveFeature('group')}
        />
        <FeatureCard
          icon={<MessageSquare className="h-6 w-6 text-indigo-600" />}
          title="课堂讨论"
          desc="话题互动交流"
          colorClass="bg-indigo-100"
          onClick={() => setActiveFeature('discussion')}
        />
        <FeatureCard
          icon={<HelpCircle className="h-6 w-6 text-orange-600" />}
          title="随堂测验"
          desc="快速测验反馈"
          colorClass="bg-orange-100"
          onClick={() => setActiveFeature('quiz')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">今日签到统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{EMPTY_STUDENTS.length}</p>
              <p className="text-xs text-muted-foreground">应到人数</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-600">
                {EMPTY_STUDENTS.filter((s) => s.status === 'present').length}
              </p>
              <p className="text-xs text-muted-foreground">实到人数</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-amber-500">
                {EMPTY_STUDENTS.filter((s) => s.status === 'late').length}
              </p>
              <p className="text-xs text-muted-foreground">迟到人数</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-blue-600">
                {EMPTY_STUDENTS.length === 0
                  ? '0%'
                  : `${Math.round((EMPTY_STUDENTS.filter((s) => s.status === 'present').length / EMPTY_STUDENTS.length) * 100)}%`}
              </p>
              <p className="text-xs text-muted-foreground">出勤率</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
