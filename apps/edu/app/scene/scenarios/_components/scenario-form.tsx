"use client"

import { ArrowRight, Save, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MultiSelect } from "@/components/ui/multi-select"
import { industryApi, positionApi, sceneBatchApi, scenarioApi, userManagementApi } from "@/lib/api"
import type { Scenario } from "@/lib/types/scene"
import type { CareerPosition } from "@/lib/types/job"
import type { Industry } from "@/lib/types/backend"
import type { SceneBatch } from "@/lib/types/scene"
import type { User } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface ScenarioFormProps {
  scenarioId?: string
  defaultBatchId?: string
  defaultPositionId?: string
}

export function ScenarioForm({ scenarioId, defaultBatchId, defaultPositionId }: ScenarioFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [positions, setPositions] = useState<CareerPosition[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [batches, setBatches] = useState<SceneBatch[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [name, setName] = useState("")
  const [code, setCode] = useState(`SC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`)
  const [version, setVersion] = useState("v1.0")
  const [difficulty, setDifficulty] = useState<number>(3)
  const [background, setBackground] = useState("")
  const [deliveryGoal, setDeliveryGoal] = useState("")
  const [careerPositionId, setCareerPositionId] = useState(defaultPositionId || "")
  const [batchId, setBatchId] = useState(defaultBatchId || "")
  const [industryIds, setIndustryIds] = useState<string[]>([])
  const [coBuilderIds, setCoBuilderIds] = useState<string[]>([])
  const [originalStatus, setOriginalStatus] = useState<string>("draft")

  const isEdit = Boolean(scenarioId)

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [posRes, indRes, batchRes, userRes] = await Promise.all([
          positionApi.list({ limit: 1000 }),
          industryApi.list({ limit: 1000 }),
          sceneBatchApi.list({ limit: 1000 }),
          userManagementApi.list({ limit: 1000 }),
        ])
        setPositions(posRes.items)
        setIndustries(indRes.items)
        setBatches(batchRes.items)
        setUsers(userRes.items)
      } catch (err: any) {
        toast({ variant: "destructive", title: "加载选项失败", description: err.message || "请刷新重试" })
      }
    }
    loadOptions()
  }, [])

  useEffect(() => {
    if (!scenarioId) return
    setLoading(true)
    scenarioApi
      .get(scenarioId)
      .then((s) => {
        setName(s.name)
        setCode(s.code)
        setVersion(s.version)
        setDifficulty(s.difficulty)
        setBackground(s.background || "")
        setDeliveryGoal(s.deliveryGoal || "")
        setCareerPositionId(s.careerPositionId || "")
        setBatchId(s.batchId || "")
        setIndustryIds(s.industryIds || [])
        setCoBuilderIds(s.coBuilderIds || [])
        setOriginalStatus(s.status || "draft")
      })
      .catch((err: any) => {
        toast({ variant: "destructive", title: "加载场景失败", description: err.message || "请稍后重试" })
      })
      .finally(() => setLoading(false))
  }, [scenarioId])

  const selectedPosition = useMemo(
    () => positions.find((p) => p.id === careerPositionId),
    [positions, careerPositionId]
  )

  const groupedPositions = useMemo(() => {
    const groups = new Map<string, CareerPosition[]>()
    positions.forEach((p) => {
      const key = p.industryId || "未分类"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    })
    return groups
  }, [positions])

  const handleSave = async (redirectToTasks = false) => {
    if (!name.trim() || !code.trim()) {
      toast({ variant: "destructive", title: "请填写完整", description: "场景名称和编码不能为空" })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Scenario> = {
        name: name.trim(),
        code: code.trim(),
        version: version.trim(),
        difficulty,
        background: background.trim() || undefined,
        deliveryGoal: deliveryGoal.trim() || undefined,
        careerPositionId: careerPositionId || undefined,
        batchId: batchId || undefined,
        industryIds: industryIds.length > 0 ? industryIds : undefined,
        coBuilderIds,
      }
      let id = scenarioId
      if (isEdit && id) {
        await scenarioApi.update(id, payload)
        if (originalStatus !== "draft") {
          await scenarioApi.saveDraft(id)
          setOriginalStatus("draft")
        }
      } else {
        const created = await scenarioApi.create({
          ...payload,
          status: "draft",
          creatorId: "",
        } as Omit<Scenario, "id" | "createdAt" | "updatedAt">)
        id = created.id
      }
      toast({ title: isEdit ? "保存成功" : "创建成功" })
      if (redirectToTasks && id) {
        router.push(`/scene/scenarios/${id}/edit/tasks`)
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message || "请稍后重试" })
    } finally {
      setSaving(false)
    }
  }

  const toggleCoBuilder = (userId: string) => {
    setCoBuilderIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/scene")}>
            <X className="h-4 w-4 mr-2" />
            取消
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">步骤 1</Badge>
            <span className="text-sm font-medium text-gray-800">基础信息编辑</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            保存草稿
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            下一步
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-gray-800">{isEdit ? "编辑实践场景" : "新建实践场景"}</h1>
        <p className="text-sm text-gray-500 mt-1">填写场景基础信息，完成后进入任务链配置</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">场景名称 <span className="text-red-500">*</span></Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入场景名称" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">场景编码 <span className="text-red-500">*</span></Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入场景编码" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="version">版本</Label>
              <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="difficulty">难度</Label>
              <Select value={String(difficulty)} onValueChange={(v) => setDifficulty(Number(v))}>
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} 星
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="batch">所属批次</Label>
              <Select value={batchId || "__none__"} onValueChange={(v) => setBatchId(v === "__none__" ? "" : v)}>
                <SelectTrigger id="batch">
                  <SelectValue placeholder="请选择批次" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不选择</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="industry">所属行业</Label>
              <MultiSelect
                options={industries.map(ind => ({ label: ind.name, value: ind.id }))}
                value={industryIds}
                onChange={setIndustryIds}
                placeholder="请选择行业"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position">目标岗位</Label>
              <Select value={careerPositionId || "__none__"} onValueChange={(v) => setCareerPositionId(v === "__none__" ? "" : v)}>
                <SelectTrigger id="position">
                  <SelectValue placeholder="请选择岗位" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不选择</SelectItem>
                  {Array.from(groupedPositions.entries()).map(([industryId, posList]) => (
                    <div key={industryId}>
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">
                        {industries.find((i) => i.id === industryId)?.name || industryId}
                      </div>
                      {posList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="background">场景背景</Label>
            <Textarea
              id="background"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="描述场景的业务背景和学习目标..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="deliveryGoal">交付目标</Label>
            <Textarea
              id="deliveryGoal"
              value={deliveryGoal}
              onChange={(e) => setDeliveryGoal(e.target.value)}
              placeholder="描述学生完成场景后需要达到的交付成果..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>共建人</Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-sm text-gray-400">暂无用户数据</p>
              ) : (
                users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={coBuilderIds.includes(u.id)}
                      onChange={() => toggleCoBuilder(u.id)}
                      className="rounded border-gray-300"
                    />
                    <span>{u.name || u.username || u.id}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
