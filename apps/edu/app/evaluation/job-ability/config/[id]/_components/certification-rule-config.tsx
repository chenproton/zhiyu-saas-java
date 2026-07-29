"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, Plus, Save, Settings } from "lucide-react"
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
import type { PositionAbilityBinding, AbilityDomain } from "@/lib/api"
import { AbilityItemSection } from "./ability-item-section"
import { LevelMappingDialog } from "./level-mapping-dialog"
import { newKey, type DraftItem, type DraftPoint } from "./types"

const POSITION_LEVEL_TO_CERT: Record<string, string> = {
  understand: "了解L1",
  comprehend: "理解L2",
  master: "掌握L3",
  proficient: "熟练L4",
  expert: "精通L5",
}

function mapLevel(level: string): string {
  return POSITION_LEVEL_TO_CERT[level] ?? level ?? "了解L1"
}

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
  const [positionBindings, setPositionBindings] = useState<PositionAbilityBinding[]>([])
  const [positionDomains, setPositionDomains] = useState<AbilityDomain[]>([])
  const [globalMappingOpen, setGlobalMappingOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [position, ruleRes, abilityRes, taskRes, domainsRes, bindingsRes] = await Promise.all([
          positionApi.get(positionId),
          certApi.listRules(),
          abilityApi.list({ limit: 200 }),
          taskApi.list({ limit: 500 }),
          abilityApi.listDomains(positionId).catch(() => ({ items: [] as AbilityDomain[] })),
          abilityApi.listBindings({ careerPositionId: positionId }).catch(() => ({ items: [] as PositionAbilityBinding[] })),
        ])
        if (cancelled) return
        setPositionName(position.name)
        setAbilityPoints(abilityRes.items)
        setPositionDomains(domainsRes.items)
        setPositionBindings(bindingsRes.items)
        const taskNameMap: Record<string, string> = {}
        taskRes.items.forEach((task) => {
          taskNameMap[task.id] = task.name
        })

        const existingRule =
          ruleRes.items.find((r) => r.careerPositionId === positionId) ?? null
        setRule(existingRule)

        if (!existingRule) {
          const pointNameMap = new Map<string, string>()
          abilityRes.items.forEach((ap) => pointNameMap.set(ap.id, ap.name))
          const imported = buildItemsFromPosition(domainsRes.items, bindingsRes.items, pointNameMap)
          setItems(imported)
          return
        }

        const full = await certApi.getFullRule(existingRule.id)
        if (cancelled) return
        setGlobalMapping(
          full.rule.levelMapping && full.rule.levelMapping.length > 0
            ? full.rule.levelMapping
            : defaultLevelMapping,
        )
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

  const handleImportFromPosition = () => {
    const pointNameMap = new Map<string, string>()
    abilityPoints.forEach((ap) => pointNameMap.set(ap.id, ap.name))
    const imported = buildItemsFromPosition(positionDomains, positionBindings, pointNameMap)
    if (imported.length === 0) {
      toast({ title: "无可导入内容", description: "该岗位尚未配置能力模型，请先在岗位编辑中完成能力建模", variant: "destructive" })
      return
    }
    setItems(imported)
    toast({ title: "已导入", description: `从岗位能力模型导入 ${imported.length} 个能力域` })
  }

  const levelOptions = useMemo(() => globalMapping.map((m) => m.level), [globalMapping])

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { key: newKey(), name: `能力域 ${prev.length + 1}`, points: [] },
    ])
  }

  const handleSave = async () => {
    const error = validateItems(items)
    if (error) {
      toast({ title: "权重校验未通过", description: error, variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const targetRule =
        rule ?? (await certApi.createRule({ careerPositionId: positionId, ruleSource: "custom" }))
      await certApi.putFullRule(targetRule.id, {
        careerPositionId: positionId,
        ruleSource: targetRule.ruleSource ?? "custom",
        levelMapping: globalMapping,
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
          <Button variant="outline" size="sm" className="gap-2" onClick={handleImportFromPosition}>
            <Download className="size-4" />
            导入岗位能力模型
          </Button>
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
        description="继承类能力点默认使用此映射，保存规则后作为该岗位的默认评级区间"
        mapping={globalMapping}
        onSave={setGlobalMapping}
      />
    </div>
  )
}

/** 验证函数移至顶层以消除 lint 警告 */
function validateItems(items: DraftItem[]): string | null {
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

function buildItemsFromPosition(
  domains: AbilityDomain[],
  bindings: PositionAbilityBinding[],
  pointNameMap: Map<string, string>,
): DraftItem[] {
  if (!domains.length && !bindings.length) return []

  const bindingMap = new Map<string, PositionAbilityBinding>()
  bindings.forEach((b) => bindingMap.set(b.id, b))

  if (domains.length) {
    return domains
      .filter((d) => d.bindingIds?.length > 0)
      .map((d, index) => ({
        key: newKey(),
        name: d.name,
        points: buildPoints(d.bindingIds, bindingMap, pointNameMap),
      }))
  }

  return [
    {
      key: newKey(),
      name: "默认能力域",
      points: bindings.map((b) => ({
        key: newKey(),
        abilityPointId: b.abilityPointId,
        name: pointNameMap.get(b.abilityPointId) ?? b.abilityPointId,
        description: b.rubricDescription,
        mappingType: "inherit" as const,
        requiredLevel: mapLevel(b.requiredLevel),
        weight: Math.round(10000 / bindings.length) / 100,
        tasks: [],
      })),
    },
  ]
}

function buildPoints(
  bindingIds: string[],
  bindingMap: Map<string, PositionAbilityBinding>,
  pointNameMap: Map<string, string>,
): DraftPoint[] {
  const points: DraftPoint[] = []
  for (const bid of bindingIds) {
    const b = bindingMap.get(bid)
    if (!b) continue
    points.push({
      key: newKey(),
      abilityPointId: b.abilityPointId,
      name: pointNameMap.get(b.abilityPointId) ?? b.abilityPointId,
      description: b.rubricDescription,
      mappingType: "inherit",
      requiredLevel: mapLevel(b.requiredLevel),
      weight: 0,
      tasks: [],
    })
  }
  if (points.length > 0) {
    const each = Math.round(10000 / points.length) / 100
    points.forEach((p) => { p.weight = each })
  }
  return points
}
