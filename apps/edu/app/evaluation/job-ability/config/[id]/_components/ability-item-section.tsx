"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { AbilityPoint, LevelMapping } from "@/lib/types"
import { AbilityPointCard } from "./ability-point-card"
import { WeightConfigDialog } from "./weight-config-dialog"
import { newKey, defaultWeight, type DraftItem } from "./types"

interface AbilityItemSectionProps {
  item: DraftItem
  careerPositionId: string
  abilityPoints: AbilityPoint[]
  globalMapping: LevelMapping[]
  levelOptions: string[]
  onChange: (item: DraftItem) => void
  onDelete: () => void
}

/** 能力域卡片：可折叠，内含能力点表格 */
export function AbilityItemSection({
  item,
  careerPositionId,
  abilityPoints,
  globalMapping,
  levelOptions,
  onChange,
  onDelete,
}: AbilityItemSectionProps) {
  const [open, setOpen] = useState(true)
  const [addPointOpen, setAddPointOpen] = useState(false)
  const [pointWeightOpen, setPointWeightOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // 新增能力点表单
  const [formAbilityPointId, setFormAbilityPointId] = useState("")
  const [formRequiredLevel, setFormRequiredLevel] = useState("")

  const update = (patch: Partial<DraftItem>) => onChange({ ...item, ...patch })

  const usedAbilityPointIds = item.points.map((p) => p.abilityPointId)
  const selectableAbilityPoints = abilityPoints.filter(
    (ap) => !usedAbilityPointIds.includes(ap.id),
  )

  const openAddPointDialog = () => {
    setFormAbilityPointId("")
    setFormRequiredLevel(levelOptions[0] ?? "")
    setAddPointOpen(true)
  }

  const handleAddPoint = () => {
    const abilityPoint = abilityPoints.find((ap) => ap.id === formAbilityPointId)
    if (!abilityPoint || !formRequiredLevel) return
    update({
      points: [
        ...item.points,
        {
          key: newKey(),
          abilityPointId: abilityPoint.id,
          name: abilityPoint.name,
          description: abilityPoint.description,
          mappingType: "inherit",
          requiredLevel: formRequiredLevel,
          weight: defaultWeight(item.points.length === 0),
          tasks: [],
        },
      ],
    })
    setAddPointOpen(false)
  }

  const handleSavePointWeights = (weights: Record<string, number>) => {
    update({
      points: item.points.map((point) =>
        weights[point.key] !== undefined ? { ...point, weight: weights[point.key] } : point,
      ),
    })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <Input
            value={item.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-8 w-56 font-medium"
            placeholder="能力域名称"
          />
          <span className="text-xs text-muted-foreground">{item.points.length} 个能力点</span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={item.points.length === 0}
              onClick={() => setPointWeightOpen(true)}
            >
              权重配置
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={openAddPointDialog}
            >
              <Plus className="mr-1 h-3 w-3" />
              新增能力点
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              删除能力域
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <CardContent className="p-0">
            {item.points.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无能力点，点击右上角「新增能力点」开始配置
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-transparent">
                    <TableHead className="w-[240px] text-xs font-medium">能力点名</TableHead>
                    <TableHead className="w-[140px] text-xs font-medium">要求等级</TableHead>
                    <TableHead className="w-[80px] text-center text-xs font-medium">权重%</TableHead>
                    <TableHead className="w-[220px] text-xs font-medium">等级映射</TableHead>
                    <TableHead className="w-[220px] text-right text-xs font-medium">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.points.map((point) => (
                    <AbilityPointCard
                      key={point.key}
                      point={point}
                      careerPositionId={careerPositionId}
                      globalMapping={globalMapping}
                      levelOptions={levelOptions}
                      onChange={(next) =>
                        update({
                          points: item.points.map((p) => (p.key === next.key ? next : p)),
                        })
                      }
                      onDelete={() =>
                        update({ points: item.points.filter((p) => p.key !== point.key) })
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* 新增能力点弹窗 */}
      <Dialog open={addPointOpen} onOpenChange={setAddPointOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增能力点</DialogTitle>
            <DialogDescription>从能力点库中选择能力点并设置要求等级</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>能力点 *</FieldLabel>
              <Select value={formAbilityPointId} onValueChange={setFormAbilityPointId}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择能力点" />
                </SelectTrigger>
                <SelectContent>
                  {selectableAbilityPoints.map((ap) => (
                    <SelectItem key={ap.id} value={ap.id}>
                      {ap.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>要求等级 *</FieldLabel>
              <Select value={formRequiredLevel} onValueChange={setFormRequiredLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择要求等级" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPointOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddPoint} disabled={!formAbilityPointId || !formRequiredLevel}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WeightConfigDialog
        open={pointWeightOpen}
        onOpenChange={setPointWeightOpen}
        title="配置能力点权重"
        description={`配置能力域「${item.name}」下各能力点权重，合计必须为 100%`}
        items={item.points.map((p) => ({ id: p.key, name: p.name, weight: p.weight }))}
        onSave={handleSavePointWeights}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除能力域"
        description={`确定要删除能力域「${item.name}」及其下所有能力点配置吗？保存后生效。`}
        variant="destructive"
        onConfirm={onDelete}
      />
    </Collapsible>
  )
}
