'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Sparkles, AlertCircle } from 'lucide-react'
import type { Position, PositionAbilityBinding, CompetencyLevel } from '@/lib/types/job-source'
import { COMPETENCY_LEVEL_LABELS } from '@/lib/types/job-source'

const COMPETENCY_LEVELS: { value: CompetencyLevel; label: string }[] = [
  { value: 'understand', label: '了解' },
  { value: 'comprehend', label: '理解' },
  { value: 'master', label: '掌握' },
  { value: 'proficient', label: '熟练' },
  { value: 'expert', label: '精通' },
]

interface Step3ResultTableProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
  onPrev: () => void
  showAiFill?: boolean
}

export function Step3ResultTable({ position, onUpdate, onPrev, showAiFill = true }: Step3ResultTableProps) {
  const bindings = position.abilityBindings
  const [aiNotice, setAiNotice] = useState<string | null>(null)

  const handleUpdateBinding = (bindingId: string, updates: Partial<PositionAbilityBinding>) => {
    onUpdate({
      abilityBindings: position.abilityBindings.map((b) =>
        b.id === bindingId ? { ...b, ...updates } : b
      ),
    })
  }

  const handleAiFillAll = () => {
    setAiNotice('AI 生成服务暂未接入，请手动填写')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">步骤三：能力模型汇总</h2>
          <p className="text-sm text-gray-500 mt-0.5">确认拆解结果并配置胜任力标准，保存后岗位将进入草稿状态</p>
        </div>
        <div className="flex items-center gap-2">
          {showAiFill && (
            <Button
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
              onClick={handleAiFillAll}
              disabled={bindings.length === 0}
            >
              <Sparkles className="h-4 w-4" />
              AI 辅助编写
            </Button>
          )}
        </div>
      </div>

      {aiNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{aiNotice}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-gray-500">工作职责</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{position.responsibilities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-gray-500">能力点</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{bindings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-gray-500">能力域</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {new Set(bindings.map((b) => b.domain).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">能力模型明细表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bindings.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>暂无能力点数据</p>
              <p className="text-xs text-gray-400 mt-1">请返回步骤二进行拆解</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[120px]">能力域名称</TableHead>
                    <TableHead className="w-[160px]">能力点名称</TableHead>
                    <TableHead className="w-[80px]">能力属性</TableHead>
                    <TableHead className="w-[120px]">掌握程度</TableHead>
                    <TableHead>胜任标准描述</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const groups = new Map<string, typeof bindings>()
                    for (const b of bindings) {
                      const key = b.domain || '未分类'
                      if (!groups.has(key)) groups.set(key, [])
                      groups.get(key)!.push(b)
                    }
                    const rows: React.ReactNode[] = []
                    for (const [, group] of groups) {
                      group.forEach((binding, idx) => {
                        rows.push(
                          <TableRow key={binding.id}>
                            {idx === 0 && (
                              <TableCell rowSpan={group.length} className="align-middle">
                                <Badge variant="outline" className="text-[10px]">
                                  {binding.domain || '未分类'}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="font-medium text-sm">{binding.name}</TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-700">
                                {(binding.attributes || [])[0] || '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={binding.level}
                                onValueChange={(v) => handleUpdateBinding(binding.id, { level: v as CompetencyLevel })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[100px]">
                                  <SelectValue placeholder="请选择" />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMPETENCY_LEVELS.map((l) => (
                                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 min-w-[240px]">
                              <Input
                                value={binding.rubricDescription}
                                onChange={(e) => handleUpdateBinding(binding.id, { rubricDescription: e.target.value })}
                                placeholder="请输入胜任标准描述..."
                                className="h-7 text-xs"
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })
                    }
                    return rows
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
