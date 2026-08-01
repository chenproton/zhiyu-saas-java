"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "@zhiyu/ui"
import {
  FileText,
  HelpCircle,
  Shuffle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Save,
  Play,
  CheckCircle2,
  Award,
  BookOpen,
  Users,
  MessageCircle,
  FolderOpen,
} from "lucide-react"
import { TaskEvaluationConfig } from "../_types/registrar-adapted"

// ==================== Mock Data ====================

export const INITIAL_CONFIG: TaskEvaluationConfig = {
  enabledMethods: ["random_quiz", "peer_review", "homework", "classwork"],
  randomDrawQuestions: [],
  reviewSteps: [],
}

const EVAL_POINT_TEMPLATES: Array<{ id: string; name: string; desc: string; weight: number; maxScore: number }> = []

// ==================== Helper Components ====================

function MethodSwitch({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between border rounded-lg p-4 hover:bg-muted/30 transition-colors">
      <div className="flex gap-3">
        <div className="mt-0.5 text-primary">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function RandomQuizPanel({ config, setConfig }: { config: TaskEvaluationConfig; setConfig: (c: TaskEvaluationConfig) => void }) {
  const [newQuestion, setNewQuestion] = useState({ name: "", description: "", answer: "" })

  const addQuestion = () => {
    if (!newQuestion.name.trim() || !newQuestion.description.trim()) return
    setConfig({
      ...config,
      randomDrawQuestions: [
        ...(config.randomDrawQuestions || []),
        { id: `rq-${Date.now()}`, name: newQuestion.name, description: newQuestion.description, answer: newQuestion.answer, major: "软件工程" },
      ],
    })
    setNewQuestion({ name: "", description: "", answer: "" })
    toast({ title: "题目已添加" })
  }

  const removeQuestion = (id: string) => {
    setConfig({
      ...config,
      randomDrawQuestions: (config.randomDrawQuestions || []).filter((q) => q.id !== id),
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">题库管理</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">题目标题</Label>
            <Input value={newQuestion.name} onChange={(e) => setNewQuestion({ ...newQuestion, name: e.target.value })} className="mt-1 text-sm" placeholder="请输入题目标题" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">题目描述</Label>
            <Input value={newQuestion.description} onChange={(e) => setNewQuestion({ ...newQuestion, description: e.target.value })} className="mt-1 text-sm" placeholder="请输入题目内容" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">参考答案</Label>
            <Input value={newQuestion.answer} onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })} className="mt-1 text-sm" placeholder="请输入参考答案" />
          </div>
          <Button size="sm" onClick={addQuestion}><Plus className="h-3.5 w-3.5 mr-1" />添加题目</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(config.randomDrawQuestions || []).map((q, idx) => (
          <Card key={q.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{idx + 1}</Badge>
                    <p className="text-sm font-medium">{q.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{q.description}</p>
                  <p className="text-xs text-green-600">答案：{q.answer}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeQuestion(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(config.randomDrawQuestions || []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">暂无抽题，请先添加</p>
        )}
      </div>
    </div>
  )
}

function PeerReviewPanel({ config, setConfig }: { config: TaskEvaluationConfig; setConfig: (c: TaskEvaluationConfig) => void }) {
  const [newStep, setNewStep] = useState({ label: "", desc: "", subjectType: "student", weight: 20 })

  const toggleStep = (id: string) => {
    setConfig({
      ...config,
      reviewSteps: (config.reviewSteps || []).map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    })
  }

  const updateWeight = (id: string, weight: number) => {
    setConfig({
      ...config,
      reviewSteps: (config.reviewSteps || []).map((s) => (s.id === id ? { ...s, weight } : s)),
    })
  }

  const removeStep = (id: string) => {
    setConfig({
      ...config,
      reviewSteps: (config.reviewSteps || []).filter((s) => s.id !== id),
    })
  }

  const addStep = () => {
    if (!newStep.label.trim()) return
    setConfig({
      ...config,
      reviewSteps: [
        ...(config.reviewSteps || []),
        { id: `rs-${Date.now()}`, label: newStep.label, desc: newStep.desc, enabled: true, subjectType: newStep.subjectType, weight: newStep.weight },
      ],
    })
    setNewStep({ label: "", desc: "", subjectType: "student", weight: 20 })
    toast({ title: "评价环节已添加" })
  }

  const totalWeight = (config.reviewSteps || []).reduce((sum, s) => sum + (s.enabled ? s.weight : 0), 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">互评环节配置</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">环节名称</Label>
              <Input value={newStep.label} onChange={(e) => setNewStep({ ...newStep, label: e.target.value })} className="mt-1 text-sm" placeholder="如：小组互评" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">评价主体</Label>
              <select
                className="w-full mt-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
                value={newStep.subjectType}
                onChange={(e) => setNewStep({ ...newStep, subjectType: e.target.value })}
              >
                <option value="student">学生自评</option>
                <option value="group">小组互评</option>
                <option value="teacher">教师评价</option>
              </select>
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">权重 (%)</Label>
              <Input type="number" value={newStep.weight} onChange={(e) => setNewStep({ ...newStep, weight: Math.max(0, parseInt(e.target.value) || 0) })} className="mt-1 text-sm" min={0} max={100} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">环节说明</Label>
            <Input value={newStep.desc} onChange={(e) => setNewStep({ ...newStep, desc: e.target.value })} className="mt-1 text-sm" placeholder="描述该评价环节的具体要求" />
          </div>
          <Button size="sm" onClick={addStep}><Plus className="h-3.5 w-3.5 mr-1" />添加环节</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>互评流程</span>
            <Badge variant={totalWeight === 100 ? "default" : "destructive"} className="text-xs">权重合计 {totalWeight}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(config.reviewSteps || []).map((s, idx) => (
            <div key={s.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Switch checked={s.enabled} onCheckedChange={() => toggleStep(s.id)} />
                <div>
                  <p className="text-sm font-medium">{idx + 1}. {s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" value={s.weight} onChange={(e) => updateWeight(s.id, parseInt(e.target.value) || 0)} className="w-20 h-8 text-sm" min={0} max={100} />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => removeStep(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          {(config.reviewSteps || []).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">暂无互评环节</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OutcomeArchivePanel() {
  const [archived, setArchived] = useState(false)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <FolderOpen className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">过程性考核归档</p>
              <p className="text-xs text-muted-foreground mt-1">将学生本课程的全过程考核数据（出勤、作业、测验、互评、课堂表现等）统一归档生成最终成绩册。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">—</p><p className="text-xs text-muted-foreground">总课时</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">—</p><p className="text-xs text-muted-foreground">参与学生</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">—</p><p className="text-xs text-muted-foreground">作业/测验</p></CardContent></Card>
            <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">—</p><p className="text-xs text-muted-foreground">互评活动</p></CardContent></Card>
          </div>
          <Button onClick={() => { setArchived(true); toast({ title: "过程性考核归档完成" })
 }} disabled={archived}>
            {archived ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {archived ? "已归档" : "执行归档"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Main Tab ====================

export function PostClassTab() {
  const [config, setConfig] = useState<TaskEvaluationConfig>(INITIAL_CONFIG)

  const toggleMethod = (method: string) => {
    const enabled = new Set(config.enabledMethods)
    if (enabled.has(method)) enabled.delete(method)
    else enabled.add(method)
    setConfig({ ...config, enabledMethods: Array.from(enabled) })
  }

  const isEnabled = (method: string) => config.enabledMethods.includes(method)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MethodSwitch
          icon={<HelpCircle className="h-5 w-5" />}
          title="随机抽题"
          desc="课后随机抽取题目，检验学生课堂知识掌握情况"
          checked={isEnabled("random_quiz")}
          onChange={() => toggleMethod("random_quiz")}
        />
        <MethodSwitch
          icon={<Users className="h-5 w-5" />}
          title="互评互判"
          desc="学生之间按照既定规则进行作品或表现互评"
          checked={isEnabled("peer_review")}
          onChange={() => toggleMethod("peer_review")}
        />
        <MethodSwitch
          icon={<FileText className="h-5 w-5" />}
          title="课后作业"
          desc="布置与批改课后作业"
          checked={isEnabled("homework")}
          onChange={() => toggleMethod("homework")}
        />
        <MethodSwitch
          icon={<BookOpen className="h-5 w-5" />}
          title="课堂练习"
          desc="随堂发放课堂练习并统计完成情况"
          checked={isEnabled("classwork")}
          onChange={() => toggleMethod("classwork")}
        />
      </div>

      <Tabs defaultValue="random_quiz" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="random_quiz" className="text-xs">随机抽题</TabsTrigger>
          <TabsTrigger value="peer_review" className="text-xs">互评互判</TabsTrigger>
          <TabsTrigger value="archive" className="text-xs">考核归档</TabsTrigger>
        </TabsList>
        <TabsContent value="random_quiz">
          <RandomQuizPanel config={config} setConfig={setConfig} />
        </TabsContent>
        <TabsContent value="peer_review">
          <PeerReviewPanel config={config} setConfig={setConfig} />
        </TabsContent>
        <TabsContent value="archive">
          <OutcomeArchivePanel />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">评价维度模板</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EVAL_POINT_TEMPLATES.map((ep) => (
              <div key={ep.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{ep.name}</p>
                  <p className="text-xs text-muted-foreground">{ep.desc}</p>
                </div>
                <Badge variant="outline" className="text-xs">{ep.weight}%</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => toast({ title: "测评配置已保存" })}><Save className="h-4 w-4 mr-1" />保存配置</Button>
      </div>
    </div>
  )
}
