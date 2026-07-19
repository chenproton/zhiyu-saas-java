"use client"

import {
  ArrowLeft, ArrowRight, Book, CheckCircle2, Clock, Copy, FileText,
  GripVertical, Lightbulb, Link2, Plus, Save, Scale, Search, Star,
  Target, Trash2, Eye, X, Check, Play, Upload, Image, Video, Globe,
  MapPin, Package, Award, List, ListOrdered, ChevronDown, ChevronUp,
  AlertCircle, Info, PenTool, Database, ClipboardList, FileQuestion,
  User, Users, Bot, FolderCheck, Gavel, Presentation, Unlock, Lock,
  ChevronRight, ChevronLeft, PieChart as PieChartIcon, Headphones,
  Archive, RotateCcw, BookOpen, Pencil, Minus,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { scenarioApi, taskApi, knowledgeApi, abilityApi, questionBankApi, questionApi, examApi } from "@/lib/api"
import type { ScenarioTask } from "@/lib/types/scene"
import { useToast } from "@/hooks/use-toast"

type CardType = "info" | "description" | "knowledge" | "ability" | "resources" | "evaluation" | "evaluationRules" | "weight"

const cardConfigs: { type: CardType; title: string; icon: React.ReactNode }[] = [
  { type: "info", title: "配置任务\n基础信息", icon: <FileText className="h-4 w-4" /> },
  { type: "description", title: "配置任务\n说明", icon: <Book className="h-4 w-4" /> },
  { type: "knowledge", title: "考查\n知识点", icon: <Lightbulb className="h-4 w-4" /> },
  { type: "ability", title: "考查\n能力点", icon: <Award className="h-4 w-4" /> },
  { type: "resources", title: "配置任务\n资源", icon: <Link2 className="h-4 w-4" /> },
  { type: "evaluation", title: "配置任务\n测评形式", icon: <CheckCircle2 className="h-4 w-4" /> },
  { type: "evaluationRules", title: "配置任务\n评价规则", icon: <Gavel className="h-4 w-4" /> },
  { type: "weight", title: "配置任务\n权重", icon: <Scale className="h-4 w-4" /> },
]

const evaluationMethodOptions = [
  { key: "random_draw", label: "现场问答", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { key: "review", label: "现场评审", color: "bg-purple-50 text-purple-600 border-purple-200" },
  { key: "paper", label: "试卷", color: "bg-green-50 text-green-600 border-green-200" },
  { key: "question_bank", label: "题库", color: "bg-orange-50 text-orange-600 border-orange-200" },
  { key: "quiz", label: "随堂测", color: "bg-red-50 text-red-600 border-red-200" },
  { key: "outcome", label: "成果评价", color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  { key: "homework", label: "作业", color: "bg-pink-50 text-pink-600 border-pink-200" },
]

const defaultGradeMapping = [
  { id: "grade-1", grade: "A", minScore: 90, maxScore: 100, color: "bg-green-500", remark: "表现卓越" },
  { id: "grade-2", grade: "B", minScore: 75, maxScore: 89, color: "bg-blue-500", remark: "表现良好" },
  { id: "grade-3", grade: "C", minScore: 60, maxScore: 74, color: "bg-yellow-500", remark: "基本达标" },
  { id: "grade-4", grade: "D", minScore: 0, maxScore: 59, color: "bg-red-500", remark: "未达标准" },
]

interface TaskState {
  description: string
  knowledgePoints: string[]
  abilityPoints: string[]
  resources: string[]
  evaluationMethods: string[]
  weight: number
  locked: boolean
  gradeMapping: { id: string; grade: string; minScore: number; maxScore: number; color: string; remark: string }[]
  methodWeights: Record<string, number>
}

function makeDefaultTaskState(): TaskState {
  return {
    description: "",
    knowledgePoints: [],
    abilityPoints: [],
    resources: [],
    evaluationMethods: ["review"],
    methodWeights: { review: 100 },
    weight: 0,
    locked: false,
    gradeMapping: JSON.parse(JSON.stringify(defaultGradeMapping)),
  }
}

export default function ScenarioTasksPage() {
  const params = useParams()
  const router = useRouter()
  const scenarioId = params.id as string
  const { toast } = useToast()

  const [scenario, setScenario] = useState<any>(null)
  const [tasks, setTasks] = useState<ScenarioTask[]>([])
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})
  const [dataLoading, setDataLoading] = useState(true)

  const [editingCard, setEditingCard] = useState<{ taskId: string; type: CardType } | null>(null)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isWeightConfigOpen, setIsWeightConfigOpen] = useState(false)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string; name: string } | null>(null)

  const [newTask, setNewTask] = useState({ name: "", type: "training" as "assessment" | "training", difficulty: 3, hours: 4, background: "" })

  const loadData = useCallback(async () => {
    setDataLoading(true)
    try {
      const [scenarioData, tasksRes] = await Promise.all([
        scenarioApi.get(scenarioId),
        taskApi.list({ scenarioId, limit: 1000 }),
      ])
      setScenario(scenarioData)
      setTasks(tasksRes.items.sort((a, b) => a.sortOrder - b.sortOrder))
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "无法获取数据" })
    } finally {
      setDataLoading(false)
    }
  }, [scenarioId])

  useEffect(() => { loadData() }, [loadData])

  const totalWeight = useMemo(() =>
    Object.values(taskStates).reduce((sum, s) => sum + s.weight, 0),
    [taskStates]
  )

  const getState = useCallback((id: string): TaskState =>
    taskStates[id] || makeDefaultTaskState(),
    [taskStates]
  )

  const updateState = useCallback((id: string, updates: Partial<TaskState>) => {
    setTaskStates(prev => ({ ...prev, [id]: { ...getState(id), ...updates } }))
  }, [getState])

  const getSummary = useCallback((taskId: string, type: CardType): string => {
    const task = tasks.find(t => t.id === taskId)
    const state = taskStates[taskId]
    if (!task) return ""
    switch (type) {
      case "info": return `名称: ${task.name}\n编码: ${task.code || "-"}\n类型: ${task.taskType === "assessment" ? "考核" : "训练"}\n难度: ${task.difficulty}星\n学时: ${task.estimatedHours}h`
      case "description": return state?.description ? state.description.slice(0, 60) + (state.description.length > 60 ? "..." : "") : "未填写"
      case "knowledge": return state?.knowledgePoints?.length ? `${state.knowledgePoints.length} 个知识点` : "未配置"
      case "ability": return state?.abilityPoints?.length ? `${state.abilityPoints.length} 个能力点` : "未配置"
      case "resources": return state?.resources?.length ? `${state.resources.length} 个资源` : "未配置"
      case "evaluation": return state?.evaluationMethods?.length ? state.evaluationMethods.map(m => evaluationMethodOptions.find(o => o.key === m)?.label).join("、") : "未配置"
      case "evaluationRules": return state?.evaluationMethods?.length ? `${state.evaluationMethods.length} 种评价方式` : "待配置"
      case "weight": return `${state?.weight || 0}%`
      default: return ""
    }
  }, [tasks, taskStates])

  const isConfigured = useCallback((taskId: string, type: CardType): boolean => {
    const state = taskStates[taskId]
    if (!state) return false
    switch (type) {
      case "info": return true
      case "description": return !!state.description
      case "knowledge": return state.knowledgePoints.length > 0
      case "ability": return state.abilityPoints.length > 0
      case "resources": return state.resources.length > 0
      case "evaluation": return state.evaluationMethods.length > 0
      case "evaluationRules": return state.evaluationMethods.length > 0
      case "weight": return state.weight > 0
      default: return false
    }
  }, [taskStates])

  const handleAddTask = async () => {
    if (!newTask.name.trim()) return
    try {
      const payload: any = {
        scenarioId,
        name: newTask.name.trim(),
        code: `TK-${Date.now().toString().slice(-6)}`,
        taskType: newTask.type,
        difficulty: newTask.difficulty,
        estimatedHours: newTask.hours,
        background: newTask.background,
        sortOrder: tasks.length + 1,
        dependencyIds: [],
        isReferenced: false,
      }
      const created = await taskApi.create(payload)
      await loadData()
      setIsAddTaskOpen(false)
      setNewTask({ name: "", type: "training", difficulty: 3, hours: 4, background: "" })
      toast({ title: "添加成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "添加失败", description: err.message })
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      await taskApi.delete(id)
      setDeleteConfirmTask(null)
      await loadData()
      toast({ title: "删除成功" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除失败", description: err.message })
    }
  }

  const handleDragDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    const newTasks = [...tasks]
    const [removed] = newTasks.splice(fromIdx, 1)
    newTasks.splice(toIdx, 0, removed)
    setTasks(newTasks.map((t, i) => ({ ...t, sortOrder: i + 1 })))
    try {
      await taskApi.reorder(scenarioId, newTasks.map(t => t.id))
    } catch (err: any) {
      toast({ variant: "destructive", title: "排序失败" })
      await loadData()
    }
  }

  const distributeWeights = () => {
    const unlocked = tasks.filter(t => !taskStates[t.id]?.locked)
    const lockedWeight = tasks.filter(t => taskStates[t.id]?.locked).reduce((s, t) => s + (taskStates[t.id]?.weight || 0), 0)
    const remaining = 100 - lockedWeight
    if (unlocked.length === 0) return
    const each = Math.floor(remaining / unlocked.length)
    const newStates = { ...taskStates }
    unlocked.forEach((t, i) => {
      newStates[t.id] = { ...(newStates[t.id] || makeDefaultTaskState()), weight: each + (i < remaining % unlocked.length ? 1 : 0) }
    })
    setTaskStates(newStates)
  }

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <PrdAnnotation data={getAnnotation("editor-step2-back")}>
              <Button variant="ghost" size="sm" onClick={() => router.push(`/scene/scenarios/${scenarioId}/edit`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回上一步
              </Button>
            </PrdAnnotation>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">步骤 2</Badge>
              <span className="text-sm font-medium text-gray-800">任务链配置</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PrdAnnotation data={getAnnotation("editor-step2-save")}>
              <Button variant="outline" size="sm" onClick={() => router.push(`/scene/scenarios/${scenarioId}/edit`)}>
                <Save className="mr-2 h-4 w-4" />
                保存草稿
              </Button>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("editor-step2-finish")}>
              <Button onClick={() => router.push("/scene")}>
                完成配置
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </PrdAnnotation>
          </div>
        </div>
      </div>

      {dataLoading ? (
        <div className="flex items-center justify-center py-20"><p className="text-gray-500">加载中...</p></div>
      ) : (
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
          <PrdAnnotation data={getAnnotation("editor-scenario-summary")} className="block">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{scenario?.name || "场景"}</CardTitle>
                      {scenario?.coBuilderIds?.length > 0 && <Badge variant="secondary" className="text-[10px]">共建</Badge>}
                    </div>
                    <CardDescription>
                      {scenario?.industryName && `${scenario.industryName} | `}
                      难度: {scenario?.difficulty || 3} 星
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={cn("h-4 w-4", i < (scenario?.difficulty || 3) ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
                      ))}
                    </div>
                    <Badge variant="outline">{scenario?.version || "v1.0"}</Badge>
                  </div>
                </div>
              </CardHeader>
              {scenario?.background && (
                <CardContent className="pt-0 border-t">
                  <p className="text-sm text-gray-600 pt-3">{scenario.background}</p>
                </CardContent>
              )}
            </Card>
          </PrdAnnotation>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-lg">任务列表</h2>
              <Badge variant="secondary">{tasks.length} 个任务</Badge>
              <div className={cn("flex items-center gap-1 text-sm px-2 py-1 rounded", totalWeight === 100 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600")}>
                <Scale className="h-3.5 w-3.5" /> 权重: {totalWeight}%
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> 添加任务
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsWeightConfigOpen(true)}>
                <PieChartIcon className="mr-2 h-4 w-4" /> 配置任务权重
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-3 pl-10 min-w-max">
              {cardConfigs.map(c => (
                <PrdAnnotation key={c.type} data={getAnnotation(`editor-card-${c.type}`)} className="w-52 shrink-0">
                  <div className="w-52 shrink-0 text-xs text-gray-500 text-center whitespace-pre-line leading-tight py-1">{c.title}</div>
                </PrdAnnotation>
              ))}
            </div>

            <div className="space-y-3 min-w-max">
              {tasks.map((task, idx) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"))
                    if (!isNaN(fromIdx)) handleDragDrop(fromIdx, idx)
                  }}
                  className={cn("flex items-center gap-3 p-3 bg-white rounded-xl border hover:border-primary/30 transition-colors group")}
                >
                  <div className="flex items-center gap-1 shrink-0 w-8 cursor-grab">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-400 font-medium">{idx + 1}</span>
                  </div>

                  <div className="flex items-center gap-3 flex-1">
                    {cardConfigs.map(config => {
                      const configured = isConfigured(task.id, config.type)
                      const summary = getSummary(task.id, config.type)
                      const isWeightReadonly = config.type === "weight"

                      return (
                        <button
                          key={config.type}
                          onClick={() => !isWeightReadonly && setEditingCard({ taskId: task.id, type: config.type })}
                          disabled={isWeightReadonly}
                          className={cn(
                            "w-52 h-36 shrink-0 rounded-lg border p-3 text-left transition-all flex flex-col",
                            isWeightReadonly ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60" :
                              configured ? "bg-white border-gray-200 hover:border-primary hover:shadow-sm" :
                                "bg-gray-50 border-dashed border-gray-300 hover:border-primary"
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className={cn("p-1 rounded", configured ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400")}>
                              {config.icon}
                            </div>
                            <span className="text-xs font-medium truncate flex-1">{config.title.split("\n")[0]}</span>
                          </div>
                          <p className={cn("text-xs line-clamp-5 flex-1 leading-relaxed whitespace-pre-line", configured ? "text-gray-600" : "text-gray-400")}>
                            {summary}
                          </p>
                        </button>
                      )
                    })}
                  </div>

                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-500"
                    onClick={() => setDeleteConfirmTask({ id: task.id, name: task.name })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="py-16 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">暂无任务，点击添加第一个任务</p>
                  <Button onClick={() => setIsAddTaskOpen(true)}><Plus className="mr-2 h-4 w-4" />添加任务</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>添加任务</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>任务名称</Label><Input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder="输入任务名称" className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>任务类型</Label>
                <Select value={newTask.type} onValueChange={v => setNewTask({ ...newTask, type: v as "assessment" | "training" })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="training">训练任务</SelectItem><SelectItem value="assessment">考核任务</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>预估学时</Label><Input type="number" value={newTask.hours} onChange={e => setNewTask({ ...newTask, hours: +e.target.value })} className="mt-1.5" /></div>
            </div>
            <div><Label>难度</Label><div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setNewTask({ ...newTask, difficulty: n })}>
                  <Star className={cn("h-6 w-6", n <= newTask.difficulty ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
                </button>
              ))}
            </div></div>
            <div><Label>背景介绍</Label><Textarea value={newTask.background} onChange={e => setNewTask({ ...newTask, background: e.target.value })} className="mt-1.5" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>取消</Button>
            <Button onClick={handleAddTask} disabled={!newTask.name}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WeightConfigDialog open={isWeightConfigOpen} onOpenChange={setIsWeightConfigOpen}
        tasks={tasks} taskStates={taskStates} updateAnyState={updateState} onAutoDistribute={distributeWeights} />

      <Dialog open={!!deleteConfirmTask} onOpenChange={(open) => !open && setDeleteConfirmTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除任务「{deleteConfirmTask?.name}」吗？删除后不可恢复。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmTask(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteConfirmTask && handleDeleteTask(deleteConfirmTask.id)}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingCard && (
        <EditCardDialog
          tasks={tasks}
          taskId={editingCard.taskId}
          cardType={editingCard.type}
          state={taskStates[editingCard.taskId] || makeDefaultTaskState()}
          task={tasks.find(t => t.id === editingCard.taskId)!}
          updateState={(u) => updateState(editingCard.taskId, u)}
          updateTask={async (u) => {
            try {
              await taskApi.update(editingCard.taskId, u as any)
              await loadData()
            } catch (err: any) {
              toast({ variant: "destructive", title: "更新失败", description: err.message })
            }
          }}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  )
}

function WeightConfigDialog({
  open, onOpenChange, tasks, taskStates, updateAnyState, onAutoDistribute,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  tasks: ScenarioTask[]; taskStates: Record<string, TaskState>
  updateAnyState: (id: string, u: Partial<TaskState>) => void; onAutoDistribute: () => void
}) {
  const total = Object.values(taskStates).reduce((s, ts) => s + (ts?.weight || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>配置任务权重</DialogTitle><DialogDescription>权重总和需为 100%，修改后点击自动均衡或手动调整。</DialogDescription></DialogHeader>
        <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
          {tasks.map(t => {
            const ts = taskStates[t.id] || makeDefaultTaskState()
            return (
              <div key={t.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1"><p className="font-medium text-sm">{t.name}</p><p className="text-xs text-gray-500">{t.code}</p></div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateAnyState(t.id, { locked: !ts.locked })}>
                    {ts.locked ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Unlock className="h-3.5 w-3.5 text-gray-400" />}
                  </Button>
                  <Input type="number" className="w-20 h-9 text-sm" value={ts.weight}
                    onChange={e => updateAnyState(t.id, { weight: Math.max(0, Math.min(100, +e.target.value || 0)) })} />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className={cn("text-sm font-medium", total === 100 ? "text-green-600" : "text-amber-600")}>合计: {total}%</span>
          <Button variant="outline" size="sm" onClick={onAutoDistribute}><RotateCcw className="mr-1 h-3.5 w-3.5" />自动均衡</Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditCardDialog({
  tasks, taskId, cardType, state, task, updateState, updateTask, onClose,
}: {
  tasks: ScenarioTask[]; taskId: string; cardType: CardType
  state: TaskState; task: ScenarioTask
  updateState: (u: Partial<TaskState>) => void
  updateTask: (u: Partial<ScenarioTask>) => Promise<void>
  onClose: () => void
}) {
  const config = cardConfigs.find(c => c.type === cardType)!
  const [localTask, setLocalTask] = useState({ name: task.name, type: task.taskType, difficulty: task.difficulty, hours: task.estimatedHours, background: task.background || "" })

  const [knowledgeData, setKnowledgeData] = useState<any[]>([])
  const [abilityData, setAbilityData] = useState<any[]>([])
  const [resourceSearch, setResourceSearch] = useState("")

  useEffect(() => {
    if (cardType === "knowledge") knowledgeApi.list({ limit: 1000 }).then(r => setKnowledgeData(r.items)).catch(() => {})
    if (cardType === "ability") abilityApi.list({ limit: 1000 }).then(r => setAbilityData(r.items)).catch(() => {})
  }, [cardType])

  const handleSave = () => {
    if (cardType === "info") {
      updateTask({ name: localTask.name, taskType: localTask.type, difficulty: localTask.difficulty, estimatedHours: localTask.hours, background: localTask.background })
    }
    onClose()
  }

  const renderContent = () => {
    switch (cardType) {
      case "info":
        return (
          <div className="space-y-4">
            <div><Label>任务名称</Label><Input value={localTask.name} onChange={e => setLocalTask({ ...localTask, name: e.target.value })} className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>任务类型</Label>
                <Select value={localTask.type} onValueChange={v => setLocalTask({ ...localTask, type: v as "assessment" | "training" })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="training">训练</SelectItem><SelectItem value="assessment">考核</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>预估学时</Label><Input type="number" value={localTask.hours} onChange={e => setLocalTask({ ...localTask, hours: +e.target.value })} className="mt-1.5" /></div>
            </div>
            <div><Label>难度</Label><div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setLocalTask({ ...localTask, difficulty: n })}>
                  <Star className={cn("h-6 w-6", n <= localTask.difficulty ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
                </button>
              ))}
            </div></div>
            <div><Label>背景</Label><Textarea value={localTask.background} onChange={e => setLocalTask({ ...localTask, background: e.target.value })} className="mt-1.5" rows={3} /></div>
          </div>
        )

      case "description":
        return (
          <div className="space-y-3">
            <Label>任务说明</Label>
            <Textarea value={state.description} onChange={e => updateState({ description: e.target.value })}
              placeholder="描述任务的目标、步骤、要求等..." className="min-h-[300px]" />
          </div>
        )

      case "knowledge":
        return (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="text-sm text-gray-500">已选 {state.knowledgePoints.length} 个知识点</div>
            {knowledgeData.map(kp => (
              <div key={kp.id} className={cn("flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-primary",
                state.knowledgePoints.includes(kp.id) && "border-primary bg-primary/5")}
                onClick={() => {
                  const ids = state.knowledgePoints.includes(kp.id)
                    ? state.knowledgePoints.filter(i => i !== kp.id)
                    : [...state.knowledgePoints, kp.id]
                  updateState({ knowledgePoints: ids })
                }}>
                <div className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0",
                  state.knowledgePoints.includes(kp.id) ? "bg-primary border-primary" : "border-gray-300")}>
                  {state.knowledgePoints.includes(kp.id) && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{kp.name}</p>
                  {kp.description && <p className="text-xs text-gray-500 truncate">{kp.description}</p>}
                </div>
              </div>
            ))}
            {knowledgeData.length === 0 && <p className="text-center text-gray-500 py-8">暂无知识点数据</p>}
          </div>
        )

      case "ability":
        return (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="text-sm text-gray-500">已选 {state.abilityPoints.length} 个能力点</div>
            {abilityData.map(ap => (
              <div key={ap.id} className={cn("flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-primary",
                state.abilityPoints.includes(ap.id) && "border-primary bg-primary/5")}
                onClick={() => {
                  const ids = state.abilityPoints.includes(ap.id)
                    ? state.abilityPoints.filter(i => i !== ap.id)
                    : [...state.abilityPoints, ap.id]
                  updateState({ abilityPoints: ids })
                }}>
                <div className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0",
                  state.abilityPoints.includes(ap.id) ? "bg-primary border-primary" : "border-gray-300")}>
                  {state.abilityPoints.includes(ap.id) && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{ap.name}</p>
                  {ap.category && <Badge variant="outline" className="text-[10px] mt-1">{ap.category}</Badge>}
                </div>
              </div>
            ))}
            {abilityData.length === 0 && <p className="text-center text-gray-500 py-8">暂无能力点数据</p>}
          </div>
        )

      case "resources":
        return (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="搜索资源..." value={resourceSearch} onChange={e => setResourceSearch(e.target.value)} className="pl-8" />
            </div>
            <div className="text-sm text-gray-500">已选 {state.resources.length} 个资源</div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              <div className="p-6 text-center">
                <div className="aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center mb-3">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" /><p className="text-sm text-gray-500">上传资源</p>
                </div>
                <p className="text-xs text-gray-400">支持文档、图片、视频、链接等类型，上传后将自动关联到当前任务</p>
              </div>
            </div>
          </div>
        )

      case "evaluation":
        return (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <Label>选择测评方式</Label>
            <div className="grid grid-cols-2 gap-3">
              {evaluationMethodOptions.map(opt => {
                const selected = state.evaluationMethods.includes(opt.key)
                return (
                  <div key={opt.key} className={cn("flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors",
                    selected && "border-primary bg-primary/5")}
                    onClick={() => {
                      const methods = selected ? state.evaluationMethods.filter(m => m !== opt.key) : [...state.evaluationMethods, opt.key]
                      const weights: Record<string, number> = {}
                      methods.forEach((m, i) => { weights[m] = Math.floor(100 / methods.length) + (i < 100 % methods.length ? 1 : 0) })
                      updateState({ evaluationMethods: methods, methodWeights: weights })
                    }}>
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0",
                      selected ? "bg-primary border-primary" : "border-gray-300")}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )

      case "evaluationRules":
        return (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <Label>已选测评方式</Label>
            {state.evaluationMethods.length === 0 ? (
              <p className="text-gray-500 text-sm">请先在"测评形式"中配置测评方式</p>
            ) : (
              <div className="space-y-3">
                {state.evaluationMethods.map(method => {
                  const opt = evaluationMethodOptions.find(o => o.key === method)
                  return (
                    <div key={method} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-sm">{opt?.label || method}</span>
                        <span className="text-xs text-gray-500">权重: {state.methodWeights[method] || 0}%</span>
                      </div>
                      <div className="text-xs text-gray-400">评价规则配置将在后续版本中完善</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case "weight":
        return (
          <div className="space-y-4">
            <Label>任务权重</Label>
            <div className="flex items-center gap-4">
              <Input type="number" className="w-32" value={state.weight}
                onChange={e => updateState({ weight: Math.max(0, Math.min(100, +e.target.value || 0)) })} />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Switch checked={state.locked} onCheckedChange={v => updateState({ locked: v })} />
              <Label className="text-sm">{state.locked ? "已锁定" : "未锁定"}</Label>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{config.title.replace("\n", " ")}</DialogTitle>
          <DialogDescription>{task.name}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {renderContent()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
