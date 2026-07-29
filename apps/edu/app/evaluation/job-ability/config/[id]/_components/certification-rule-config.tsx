"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Save, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingView, useToast } from "@zhiyu/ui"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  abilityApi,
  certApi,
  positionApi,
  taskApi,
} from "@/lib/api"
import {
  defaultLevelMapping,
  type AbilityPoint,
  type CertificationRule,
  type LevelMapping,
} from "@/lib/types"
import { AbilityItemSection } from "./ability-item-section"
import { LevelMappingDialog } from "./level-mapping-dialog"
import { newKey, type DraftItem } from "./types"

interface CertificationRuleConfigProps {
  positionId: string
}

export function CertificationRuleConfig({ positionId }: CertificationRuleConfigProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [positionName, setPositionName] = useState("")
  const [rule, setRule] = useState<CertificationRule | null>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [globalMapping, setGlobalMapping] = useState<LevelMapping[]>(defaultLevelMapping)
  const [abilityPoints, setAbilityPoints] = useState<AbilityPoint[]>([])
  const [globalMappingOpen, setGlobalMappingOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [position, ruleRes, abilityRes, taskRes] = await Promise.all([
          positionApi.get(positionId),
          certApi.listRules(),
          abilityApi.list({ limit: 200 }),
          taskApi.list({ limit: 500 }),
        ])
        if (cancelled) return
        setPositionName(position.name)
        setAbilityPoints(abilityRes.items)
        const taskNameMap: Record<string, string> = {}
        taskRes.items.forEach((task) => {
          taskNameMap[task.id] = task.name
        })

        const existingRule =
          ruleRes.items.find((r) => r.careerPositionId === positionId) ?? null
        setRule(existingRule)

        if (!existingRule) {
          setItems([])
          return
        }

        const full = await certApi.getFullRule(existingRule.id)
        // full 响应的能力点不含 abilityPointId，需逐能力域查询认证点补齐
        const abilityPointIdMap: Record<string, string> = {}
        await Promise.all(
          full.items.map(async (item) => {
            const res = await certApi.listPoints(item.id)
            res.items.forEach((p) => {
              abilityPointIdMap[p.id] = p.abilityPointId
            })
          }),
        )
        if (cancelled) return

        setItems(
          full.items.map((item) => ({
            key: item.id,
            name: item.name,
            points: item.points.map((p) => ({
              key: p.id,
              abilityPointId: abilityPointIdMap[p.id] ?? p.id,
              name: p.name,
              description: p.description,
              mappingType: p.mappingType === "custom" ? "custom" : "inherit",
              customLevelMapping: p.customLevelMapping,
              requiredLevel: p.requiredLevel,
              weight: p.weight,
              tasks: (p.tasks ?? []).map((t) => ({
                key: t.id,
                taskId: t.taskId,
                taskName: taskNameMap[t.taskId] ?? "未知任务",
                maxScore: t.maxScore,
                weight: t.weight,
              })),
            })),
          })),
        )
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "加载失败",
            description: err instanceof Error ? err.message : "获取认证规则失败",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionId, reloadKey])

  const levelOptions = useMemo(() => globalMapping.map((m) => m.level), [globalMapping])

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { key: newKey(), name: `能力域 ${prev.length + 1}`, points: [] },
    ])
  }

  /** 保存前校验：同一能力域下能力点权重合计 100；同一能力点下任务权重（有任务时）合计 100 */
  const validate = (): string | null => {
    for (const item of items) {
      if (item.points.length > 0) {
        const sum = item.points.reduce((s, p) => s + (p.weight || 0), 0)
        if (Math.abs(sum - 100) > 0.01) {
          return `能力域「${item.name}」下能力点权重合计为 ${sum}%，应为 100%`
        }
      }
      for (const point of item.points) {
        if (point.tasks.length > 0) {
          const sum = point.tasks.reduce((s, t) => s + (t.weight || 0), 0)
          if (Math.abs(sum - 100) > 0.01) {
            return `能力点「${point.name}」下任务权重合计为 ${sum}%，应为 100%`
          }
        }
      }
    }
    return null
  }

  const handleSave = async () => {
    const error = validate()
    if (error) {
      toast({ title: "权重校验未通过", description: error, variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      // 岗位首次配置时先创建规则，再全量写入
      const targetRule =
        rule ?? (await certApi.createRule({ careerPositionId: positionId, ruleSource: "custom" }))
      await certApi.putFullRule(targetRule.id, {
        careerPositionId: positionId,
        ruleSource: targetRule.ruleSource ?? "custom",
        items: items.map((item, index) => ({
          name: item.name,
          sortOrder: index + 1,
          points: item.points.map((p) => ({
            abilityPointId: p.abilityPointId,
            mappingType: p.mappingType,
            customLevelMapping: p.mappingType === "custom" ? p.customLevelMapping ?? [] : [],
            requiredLevel: p.requiredLevel,
            weight: p.weight,
            tasks: p.tasks.map((t) => ({
              taskId: t.taskId,
              maxScore: t.maxScore,
              weight: t.weight,
            })),
          })),
        })),
      })
      toast({ title: "保存成功", description: "认证规则已保存" })
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast({
        title: "保存失败",
        description: err instanceof Error ? err.message : "保存认证规则失败",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingView text="加载认证规则中..." />
  }

  return (
    <div className="space-y-6">
      {/* 顶部：返回 + 岗位名称 + 规则状态 + 操作 */}
      <div className="flex items-center gap-4">
        <Link href="/evaluation/job-ability">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            返回岗位列表
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{positionName || "岗位"}</h1>
          <StatusBadge status={rule?.status ?? "none"} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setGlobalMappingOpen(true)}>
            <Settings className="size-4" />
            全局等级映射
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? "保存中..." : "保存规则"}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        配置能力认定规则 · 为每个能力点选择关联任务并分配权重
      </p>

      {/* 能力域卡片列表 */}
      <div className="space-y-4">
        {items.map((item) => (
          <AbilityItemSection
            key={item.key}
            item={item}
            careerPositionId={positionId}
            abilityPoints={abilityPoints}
            globalMapping={globalMapping}
            levelOptions={levelOptions}
            onChange={(next) =>
              setItems((prev) => prev.map((i) => (i.key === next.key ? next : i)))
            }
            onDelete={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
          />
        ))}
      </div>

      <Button variant="outline" className="w-full border-dashed" onClick={handleAddItem}>
        <Plus className="mr-2 size-4" />
        新增能力域
      </Button>

      <LevelMappingDialog
        open={globalMappingOpen}
        onOpenChange={setGlobalMappingOpen}
        title="配置全局等级映射"
        description="继承类能力点默认使用此映射（仅当前页面生效，不写入后端）"
        mapping={globalMapping}
        onSave={setGlobalMapping}
      />
    </div>
  )
}
