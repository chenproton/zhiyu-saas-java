'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ChevronLeft,
  Plus,
  RotateCcw,
  Trash2,
  Target,
  CheckCircle2,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/error-handling'
import { MixedTagEditor } from '@/components/shared/mixed-tag-editor'
import { taskEvaluationApi } from '@/lib/api'
import type { GradeMapping } from '@/lib/types/lesson'

type EvalSubType =
  | 'knowledge_mastery'
  | 'operation_standard'
  | 'task_completion'
  | 'result_quality'
  | 'communication'
  | 'collaboration'
  | 'professionalism'
  | 'innovation'
  | 'adaptability'

const evalSubTypeLabels: Record<EvalSubType, string> = {
  knowledge_mastery: '知识掌握',
  operation_standard: '操作规范',
  task_completion: '任务完成度',
  result_quality: '成果质量',
  communication: '沟通表达',
  collaboration: '协作能力',
  professionalism: '职业素养',
  innovation: '创新能力',
  adaptability: '应变能力',
}

const evalSubTypeColors: Record<EvalSubType, string> = {
  knowledge_mastery: 'bg-blue-50 text-blue-600 border-blue-200',
  operation_standard: 'bg-teal-50 text-teal-600 border-teal-200',
  task_completion: 'bg-green-50 text-green-600 border-green-200',
  result_quality: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  communication: 'bg-violet-50 text-violet-600 border-violet-200',
  collaboration: 'bg-orange-50 text-orange-600 border-orange-200',
  professionalism: 'bg-amber-50 text-amber-600 border-amber-200',
  innovation: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  adaptability: 'bg-rose-50 text-rose-600 border-rose-200',
}

interface EvalPoint {
  id: string
  name: string
  desc: string
  subType?: EvalSubType
  types?: EvalSubType[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
  scoringMethod?: 'score' | 'level' | 'rubric'
  gradeMapping?: GradeMapping[]
  weight?: number
}

type EvalPointField =
  | 'randomDrawEvalPoints'
  | 'reviewEvalPoints'
  | 'paperEvalPoints'
  | 'questionBankEvalPoints'
  | 'outcomeEvalPoints'
  | 'homeworkEvalPoints'
  | 'quizEvalPoints'

interface ScoreRuleItem {
  id: string
  name: string
  desc: string
  rule: string
  weight: number
}

type RubricScheme = {
  id: string
  name: string
  types: EvalSubType[]
  desc: string
  points: EvalPoint[]
  mode: 'rubric' | 'score_rule'
  scoreRuleItems?: ScoreRuleItem[]
  isDeleted?: boolean
}

export interface MethodDialogCtx {
  state: any
  updateState: (patch: any) => void
  rubricLibrary: RubricScheme[]
  setRubricLibrary: React.Dispatch<React.SetStateAction<RubricScheme[]>>
  editingRubricId: string | null
  setEditingRubricId: (id: string | null) => void
  methodDialogViews: Record<string, 'list' | 'edit'>
  setMethodDialogViews: React.Dispatch<React.SetStateAction<Record<string, 'list' | 'edit'>>>
  openRubricKpDialog: (pointId: string, field: EvalPointField) => void
  openRubricAbDialog: (pointId: string, field: EvalPointField) => void
  setEvalPoints: (field: EvalPointField, points: EvalPoint[]) => void
  updateEvalPoint: (field: EvalPointField, id: string, updates: Partial<EvalPoint>) => void
  addEvalPoint: (field: EvalPointField, init?: Partial<EvalPoint>) => void
  removeEvalPoint: (field: EvalPointField, id: string) => void
  toast: (opts: {
    title?: string
    description?: string
    variant?: 'default' | 'destructive'
  }) => void
  knowledgePoints: any[]
  abilityPoints: any[]
}

export function MethodDialogContent({
  methodKey,
  info,
  ctx,
}: {
  methodKey: string
  info: { points: EvalPoint[]; field: EvalPointField }
  ctx: MethodDialogCtx
}) {
  const {
    state,
    updateState,
    rubricLibrary,
    setRubricLibrary,
    editingRubricId,
    setEditingRubricId,
    methodDialogViews,
    setMethodDialogViews,
    openRubricKpDialog,
    openRubricAbDialog,
    setEvalPoints,
    updateEvalPoint,
    addEvalPoint,
    removeEvalPoint,
    toast,
    knowledgePoints,
    abilityPoints,
  } = ctx
  const [gradeMappingDialogOpen, setGradeMappingDialogOpen] = useState(false)
  const [editingGradeMappingPointId, setEditingGradeMappingPointId] = useState<string | null>(null)
  const [localDraft, setLocalDraft] = useState<{
    name: string
    mode: 'rubric' | 'score_rule'
    types: EvalSubType[]
    scoreRuleItems: ScoreRuleItem[]
  }>({ name: '', mode: 'rubric', types: [], scoreRuleItems: [] })
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [saveTemplateMode, setSaveTemplateMode] = useState<'new' | 'replace'>('new')
  const [selectedReplaceTemplateId, setSelectedReplaceTemplateId] = useState<string | null>(null)
  const [viewRuleScheme, setViewRuleScheme] = useState<RubricScheme | null>(null)
  const [schemeSearch, setSchemeSearch] = useState('')
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const saveHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (saveHintTimeoutRef.current) clearTimeout(saveHintTimeoutRef.current)
    }
  }, [])
  const rubricIdField =
    methodKey === 'random_draw'
      ? 'randomDrawRubricId'
      : methodKey === 'review'
        ? 'reviewRubricId'
        : methodKey === 'outcome'
          ? 'outcomeRubricId'
          : methodKey === 'homework'
            ? 'homeworkRubricId'
            : 'reviewRubricId'
  const currentRubricId = (state as any)[rubricIdField] as string | null
  const view = methodDialogViews[methodKey] || 'edit'
  const setView = (v: 'list' | 'edit') =>
    setMethodDialogViews((prev) => ({ ...prev, [methodKey]: v }))

  const manualDraftLoadedForRef = useRef<string | null>(null)
  useEffect(() => {
    const loadKey = `${methodKey}:${view}:${currentRubricId || ''}`
    if (view === 'edit' && !currentRubricId && manualDraftLoadedForRef.current !== loadKey) {
      manualDraftLoadedForRef.current = loadKey
      const savedScoreRuleItems = state.methodResourceConfigs[methodKey]?.scoreRuleItems || []
      const hasManualRubric = info.points.length > 0
      const hasManualScoreRule = savedScoreRuleItems.length > 0
      if (hasManualRubric || hasManualScoreRule) {
        const savedConfig = state.methodResourceConfigs[methodKey] || {}
        const mode = savedConfig.rubricMode
          ? savedConfig.rubricMode
          : methodKey === 'homework'
            ? 'score_rule'
            : hasManualScoreRule
              ? 'score_rule'
              : 'rubric'
        ;(async () => {
          setLocalDraft({
            name: savedConfig.rubricName || '',
            mode,
            types: [],
            scoreRuleItems: savedScoreRuleItems.map((it: ScoreRuleItem) => ({ ...it })),
          })
        })()
      }
    }
  }, [
    view,
    currentRubricId,
    methodKey,
    info.field,
    info.points.length,
    state.methodResourceConfigs,
  ])

  const applyScheme = (schemeId: string) => {
    const scheme = rubricLibrary.find((s) => s.id === schemeId)
    if (!scheme) return
    updateState({
      [rubricIdField]: schemeId,
      methodResourceConfigs: {
        ...state.methodResourceConfigs,
        [methodKey]: {
          ...state.methodResourceConfigs[methodKey],
          scoreRuleItems: [],
        },
      },
    } as any)
    if (scheme.mode === 'rubric') {
      setEvalPoints(
        info.field,
        scheme.points.map((p) => ({
          ...p,
          id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        })),
      )
    } else {
      setEvalPoints(
        info.field,
        (scheme.scoreRuleItems || []).map((it) => ({
          id: it.id,
          name: it.name,
          desc: it.rule,
          subType: undefined,
          types: [],
          knowledgePointIds: [],
          abilityPointIds: [],
          scoringMethod: 'score' as const,
          gradeMapping: [],
          weight: it.weight,
        })),
      )
    }
  }

  const enterEdit = (schemeId: string | null) => {
    if (schemeId) {
      const scheme = rubricLibrary.find((s) => s.id === schemeId)
      if (scheme) {
        setEvalPoints(info.field, JSON.parse(JSON.stringify(scheme.points)))
        setLocalDraft({
          name: scheme.name,
          mode: scheme.mode,
          types: scheme.types,
          scoreRuleItems: scheme.scoreRuleItems || [],
        })
      }
    } else {
      updateState({ [rubricIdField]: null } as any)
      setEvalPoints(info.field, [])
      updateState({
        methodResourceConfigs: {
          ...state.methodResourceConfigs,
          [methodKey]: {
            ...state.methodResourceConfigs[methodKey],
            scoreRuleItems: [],
          },
        },
      })
      const existingConfig = state.methodResourceConfigs[methodKey] || {}
      setLocalDraft({
        name: existingConfig.rubricName || '',
        mode: methodKey === 'homework' ? 'score_rule' : 'rubric',
        types: [],
        scoreRuleItems: [],
      })
    }
    setEditingRubricId(schemeId)
    setView('edit')
  }

  const cloneScheme = (schemeId: string) => {
    const scheme = rubricLibrary.find((s) => s.id === schemeId)
    if (!scheme) return
    updateState({
      [rubricIdField]: null,
      methodResourceConfigs: {
        ...state.methodResourceConfigs,
        [methodKey]: {
          ...state.methodResourceConfigs[methodKey],
          rubricName: `${scheme.name}（副本）`,
          rubricMode: scheme.mode,
          scoreRuleItems: (scheme.scoreRuleItems || []).map((it: ScoreRuleItem) => ({ ...it })),
        },
      },
    } as any)
    if (scheme.mode === 'rubric') {
      setEvalPoints(
        info.field,
        scheme.points.map((p) => ({
          ...p,
          id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        })),
      )
    } else {
      setEvalPoints(
        info.field,
        (scheme.scoreRuleItems || []).map((it) => ({
          id: it.id,
          name: it.name,
          desc: it.rule,
          subType: undefined,
          types: [],
          knowledgePointIds: [],
          abilityPointIds: [],
          scoringMethod: 'score' as const,
          gradeMapping: [],
          weight: it.weight,
        })),
      )
    }
    setLocalDraft({
      name: `${scheme.name}（副本）`,
      mode: scheme.mode,
      types: scheme.types,
      scoreRuleItems: (scheme.scoreRuleItems || []).map((it: ScoreRuleItem) => ({ ...it })),
    })
    setEditingRubricId(null)
    setView('edit')
  }

  const saveRubricToLibrary = async (schemeId: string | null, updates: Partial<RubricScheme>) => {
    try {
      if (schemeId) {
        const data = {
          name: updates.name || '',
          mode: updates.mode || 'rubric',
          types: updates.types || [],
          description: updates.desc || '',
          data:
            updates.mode === 'score_rule'
              ? { scoreRuleItems: updates.scoreRuleItems || [] }
              : {
                  points: info.points.map((p: EvalPoint) => ({
                    id: p.id,
                    name: p.name,
                    description: p.desc || '',
                    types: p.types || (p.subType ? [p.subType] : []),
                    weight: p.weight || 0,
                    scoringMethod: p.scoringMethod || 'level',
                    gradeMapping: p.gradeMapping || [],
                    knowledgePointIds: p.knowledgePointIds || [],
                    abilityPointIds: p.abilityPointIds || [],
                  })),
                },
        }
        await taskEvaluationApi
          .updateTemplate(schemeId, data)
          .catch((err) => reportError(err, { source: '更新任务评价标准模板' }))
        setRubricLibrary((prev) =>
          prev.map((s) => (s.id === schemeId ? ({ ...s, ...updates } as RubricScheme) : s)),
        )
      } else {
        const data = {
          name: updates.name || '新建评价标准',
          mode: updates.mode || 'rubric',
          types: updates.types || [],
          description: updates.desc || '',
          data:
            updates.mode === 'score_rule'
              ? { scoreRuleItems: updates.scoreRuleItems || [] }
              : {
                  points: info.points.map((p: EvalPoint) => ({
                    id: p.id,
                    name: p.name,
                    description: p.desc || '',
                    types: p.types || (p.subType ? [p.subType] : []),
                    weight: p.weight || 0,
                    scoringMethod: p.scoringMethod || 'level',
                    gradeMapping: p.gradeMapping || [],
                    knowledgePointIds: p.knowledgePointIds || [],
                    abilityPointIds: p.abilityPointIds || [],
                  })),
                },
        }
        const created = await taskEvaluationApi.createTemplate(data).catch(() => null)
        if (created) {
          const isScoreRule = created.mode === 'score_rule'
          const newScheme: RubricScheme = {
            id: created.id,
            name: created.name,
            types: (created.types || []) as EvalSubType[],
            desc: created.description || '',
            points: isScoreRule ? [] : info.points.map((p) => ({ ...p })),
            mode: created.mode as 'rubric' | 'score_rule',
            scoreRuleItems: isScoreRule ? updates.scoreRuleItems || [] : undefined,
          }
          setRubricLibrary((prev) => [...prev, newScheme])
          updateState({ [rubricIdField]: created.id } as any)
        } else {
          const newId = `scheme-${Date.now()}`
          setRubricLibrary((prev) => [
            ...prev,
            {
              id: newId,
              name: updates.name || '新建评价标准',
              types: updates.types || [],
              desc: updates.desc || '',
              points: info.points.map((p) => ({
                ...p,
                id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              })),
              mode: updates.mode || 'rubric',
              scoreRuleItems: updates.scoreRuleItems || [],
            } as RubricScheme,
          ])
          updateState({ [rubricIdField]: newId } as any)
        }
      }
    } catch {
      if (schemeId) {
        setRubricLibrary((prev) =>
          prev.map((s) => (s.id === schemeId ? ({ ...s, ...updates } as RubricScheme) : s)),
        )
      } else {
        const newId = `scheme-${Date.now()}`
        setRubricLibrary((prev) => [
          ...prev,
          {
            id: newId,
            name: updates.name || '新建评价标准',
            types: updates.types || [],
            desc: updates.desc || '',
            points: info.points.map((p) => ({
              ...p,
              id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            })),
            mode: updates.mode || 'rubric',
            scoreRuleItems: updates.scoreRuleItems || [],
          } as RubricScheme,
        ])
        updateState({ [rubricIdField]: newId } as any)
      }
    }
  }

  const editingScheme = editingRubricId ? rubricLibrary.find((s) => s.id === editingRubricId) : null
  const draftScheme = editingScheme
    ? {
        name: editingScheme.name,
        types: editingScheme.types,
        mode: editingScheme.mode,
        scoreRuleItems: editingScheme.scoreRuleItems || [],
      }
    : localDraft

  if (view === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              setView('list')
              setEditingRubricId(null)
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            返回模板列表
          </Button>
        </div>
        <div className="border border-border rounded-xl p-5 bg-white shadow-sm">
          <p className="text-sm font-medium mb-3">评价标准信息</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500">评价标准名称</Label>
              <Input
                value={draftScheme.name}
                onChange={(e) => {
                  if (editingRubricId) {
                    setRubricLibrary((prev) =>
                      prev.map((s) =>
                        s.id === editingRubricId ? { ...s, name: e.target.value } : s,
                      ),
                    )
                  } else {
                    setLocalDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                }}
                className="mt-1 text-sm"
                placeholder="输入评价标准名称"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">评价标准类型</Label>
              <div className="flex gap-3 mt-1">
                {methodKey !== 'homework' && (
                  <button
                    onClick={() => {
                      if (editingRubricId) {
                        setRubricLibrary((prev) =>
                          prev.map((s) =>
                            s.id === editingRubricId ? { ...s, mode: 'rubric' } : s,
                          ),
                        )
                      } else {
                        setLocalDraft((prev) => ({ ...prev, mode: 'rubric' }))
                      }
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5',
                      draftScheme.mode === 'rubric'
                        ? 'bg-primary/10 text-primary border-primary'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div
                      className={cn(
                        'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                        draftScheme.mode === 'rubric' ? 'border-primary' : 'border-gray-300',
                      )}
                    >
                      {draftScheme.mode === 'rubric' && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    评价量规
                  </button>
                )}
                <button
                  onClick={() => {
                    if (editingRubricId) {
                      setRubricLibrary((prev) =>
                        prev.map((s) =>
                          s.id === editingRubricId
                            ? {
                                ...s,
                                mode: 'score_rule',
                                scoreRuleItems: s.scoreRuleItems?.length
                                  ? s.scoreRuleItems
                                  : [
                                      {
                                        id: `sr-${Date.now()}`,
                                        name: '',
                                        desc: '',
                                        rule: '',
                                        weight: 0,
                                      },
                                    ],
                              }
                            : s,
                        ),
                      )
                    } else {
                      setLocalDraft((prev) => ({
                        ...prev,
                        mode: 'score_rule',
                        scoreRuleItems: prev.scoreRuleItems?.length
                          ? prev.scoreRuleItems
                          : [{ id: `sr-${Date.now()}`, name: '', desc: '', rule: '', weight: 0 }],
                      }))
                    }
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5',
                    draftScheme.mode === 'score_rule'
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                  )}
                >
                  <div
                    className={cn(
                      'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                      draftScheme.mode === 'score_rule' ? 'border-primary' : 'border-gray-300',
                    )}
                  >
                    {draftScheme.mode === 'score_rule' && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  评分规则
                </button>
              </div>
              {methodKey === 'homework' && (
                <p className="text-[10px] text-gray-400 mt-1">作业测评仅需使用评分规则即可</p>
              )}
            </div>
          </div>
        </div>
        {draftScheme.mode === 'rubric' ? (
          <div className="border rounded-xl p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">评价量规配置表</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    const count = info.points.length
                    if (count === 0) return
                    const base = Math.floor(100 / count)
                    const remainder = 100 % count
                    const newPoints = info.points.map((p, i) => ({
                      ...p,
                      weight: base + (i < remainder ? 1 : 0),
                    }))
                    setEvalPoints(info.field, newPoints)
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  一键均分
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() =>
                    addEvalPoint(info.field, {
                      name: '',
                      types: draftScheme.types.length ? draftScheme.types : undefined,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加评价维度
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-sm border-collapse table-fixed min-w-[700px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                    <th className="py-2.5 px-2 text-left w-[8%]">序号</th>
                    <th className="py-2.5 px-2 text-left w-[45%]">
                      评价维度名称/关联知识点/能力点
                    </th>
                    <th className="py-2.5 px-2 text-right w-[27%]">评价等级</th>
                    <th className="py-2.5 px-2 text-center w-[12%]">权重(%)</th>
                    <th className="py-2.5 px-2 text-center w-[8%]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {info.points.map((ep, idx) => (
                    <tr key={ep.id} className="border-b hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2">
                        <span className="text-gray-600 align-middle">{idx + 1}</span>
                      </td>
                      <td className="py-3 px-2">
                        <MixedTagEditor
                          text={ep.name}
                          knowledgePointIds={ep.knowledgePointIds || []}
                          abilityPointIds={ep.abilityPointIds || []}
                          knowledgePoints={knowledgePoints}
                          abilityPoints={abilityPoints}
                          onChange={(updates) => updateEvalPoint(info.field, ep.id, updates)}
                          onOpenKpDialog={() => openRubricKpDialog(ep.id, info.field)}
                          onOpenAbDialog={() => openRubricAbDialog(ep.id, info.field)}
                          compact
                        />
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => {
                            setEditingGradeMappingPointId(ep.id)
                            setGradeMappingDialogOpen(true)
                          }}
                          className="text-xs text-right text-primary hover:underline w-full block"
                        >
                          {ep.gradeMapping?.map((gm) => (
                            <div
                              key={gm.id}
                              className="truncate leading-relaxed"
                              title={`${gm.grade} (${gm.minScore}-${gm.maxScore}分) ${gm.remark}`}
                            >
                              {gm.grade} ({gm.minScore}-{gm.maxScore}分) {gm.remark}
                            </div>
                          ))}
                          {!ep.gradeMapping?.length && '点击配置评价等级'}
                        </button>
                      </td>
                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          value={ep.weight || 0}
                          onChange={(e) =>
                            updateEvalPoint(info.field, ep.id, {
                              weight: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)),
                            })
                          }
                          className="h-8 text-sm text-center w-20"
                        />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          className="text-red-500 hover:text-red-600 text-xs"
                          onClick={() => removeEvalPoint(info.field, ep.id)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-2">
              <button
                onClick={() =>
                  addEvalPoint(info.field, {
                    name: '',
                    types: draftScheme.types.length ? draftScheme.types : undefined,
                  })
                }
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="h-4 w-4" />
                添加评价维度
              </button>
              {info.points.length > 0 && (
                <div className="flex justify-end text-xs items-center gap-1">
                  <span className="text-gray-500">维度权重合计：</span>
                  <span
                    className={cn(
                      'font-semibold',
                      info.points.reduce((sum, p) => sum + (p.weight || 0), 0) === 100
                        ? 'text-green-600'
                        : 'text-red-500',
                    )}
                  >
                    {info.points.reduce((sum, p) => sum + (p.weight || 0), 0)}%
                  </span>
                  {info.points.reduce((sum, p) => sum + (p.weight || 0), 0) !== 100 && (
                    <span className="text-red-500">⚠️（需等于100%）</span>
                  )}
                </div>
              )}
            </div>
            {info.points.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">尚未添加评价点</p>
                <p className="text-xs mt-1">点击上方按钮添加第一个评价点</p>
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded-xl p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">评分规则配置表</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    const items = draftScheme.scoreRuleItems || []
                    const count = items.length
                    if (count === 0) return
                    const base = Math.floor(100 / count)
                    const remainder = 100 % count
                    const newItems = items.map((it, i) => ({
                      ...it,
                      weight: base + (i < remainder ? 1 : 0),
                    }))
                    if (editingRubricId) {
                      setRubricLibrary((prev) =>
                        prev.map((s) =>
                          s.id === editingRubricId ? { ...s, scoreRuleItems: newItems } : s,
                        ),
                      )
                    } else {
                      setLocalDraft((prev) => ({ ...prev, scoreRuleItems: newItems }))
                    }
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  一键均分
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    const newItem: ScoreRuleItem = {
                      id: `sr-${Date.now()}`,
                      name: '',
                      desc: '',
                      rule: '',
                      weight: 0,
                    }
                    if (editingRubricId) {
                      setRubricLibrary((prev) =>
                        prev.map((s) =>
                          s.id === editingRubricId
                            ? { ...s, scoreRuleItems: [...(s.scoreRuleItems || []), newItem] }
                            : s,
                        ),
                      )
                    } else {
                      setLocalDraft((prev) => ({
                        ...prev,
                        scoreRuleItems: [...(prev.scoreRuleItems || []), newItem],
                      }))
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加评价项
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                    <th className="py-2.5 px-2 text-left w-16">序号</th>
                    <th className="py-2.5 px-2 text-left min-w-[300px]">评价项/评分标准描述</th>
                    <th className="py-2.5 px-2 text-left min-w-[200px]">加减分规则</th>
                    <th className="py-2.5 px-2 text-center w-20">分值</th>
                    <th className="py-2.5 px-2 text-center w-16">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(draftScheme.scoreRuleItems || []).map((item, idx) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2">
                        <span className="text-gray-600 align-middle">{idx + 1}</span>
                      </td>
                      <td className="py-3 px-2">
                        <Textarea
                          value={item.name + (item.desc ? `\n${item.desc}` : '')}
                          onChange={(e) => {
                            const lines = e.target.value.split('\n')
                            const newName = lines[0] || ''
                            const newDesc = lines.slice(1).join('\n')
                            if (editingRubricId) {
                              setRubricLibrary((prev) =>
                                prev.map((s) =>
                                  s.id === editingRubricId
                                    ? {
                                        ...s,
                                        scoreRuleItems: (s.scoreRuleItems || []).map((it) =>
                                          it.id === item.id
                                            ? { ...it, name: newName, desc: newDesc }
                                            : it,
                                        ),
                                      }
                                    : s,
                                ),
                              )
                            } else {
                              setLocalDraft((prev) => ({
                                ...prev,
                                scoreRuleItems: (prev.scoreRuleItems || []).map((it) =>
                                  it.id === item.id ? { ...it, name: newName, desc: newDesc } : it,
                                ),
                              }))
                            }
                          }}
                          className="text-sm min-h-[36px]"
                          placeholder="请输入评分描述"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <Textarea
                          value={item.rule}
                          onChange={(e) => {
                            if (editingRubricId) {
                              setRubricLibrary((prev) =>
                                prev.map((s) =>
                                  s.id === editingRubricId
                                    ? {
                                        ...s,
                                        scoreRuleItems: (s.scoreRuleItems || []).map((it) =>
                                          it.id === item.id ? { ...it, rule: e.target.value } : it,
                                        ),
                                      }
                                    : s,
                                ),
                              )
                            } else {
                              setLocalDraft((prev) => ({
                                ...prev,
                                scoreRuleItems: (prev.scoreRuleItems || []).map((it) =>
                                  it.id === item.id ? { ...it, rule: e.target.value } : it,
                                ),
                              }))
                            }
                          }}
                          className="text-sm min-h-[36px]"
                          placeholder="输入加减分规则"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          value={item.weight || 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                            if (editingRubricId) {
                              setRubricLibrary((prev) =>
                                prev.map((s) =>
                                  s.id === editingRubricId
                                    ? {
                                        ...s,
                                        scoreRuleItems: (s.scoreRuleItems || []).map((it) =>
                                          it.id === item.id ? { ...it, weight: val } : it,
                                        ),
                                      }
                                    : s,
                                ),
                              )
                            } else {
                              setLocalDraft((prev) => ({
                                ...prev,
                                scoreRuleItems: (prev.scoreRuleItems || []).map((it) =>
                                  it.id === item.id ? { ...it, weight: val } : it,
                                ),
                              }))
                            }
                          }}
                          className="h-8 text-sm text-center w-20"
                        />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          className="text-red-500 hover:text-red-600 text-xs"
                          onClick={() => {
                            if (editingRubricId) {
                              setRubricLibrary((prev) =>
                                prev.map((s) =>
                                  s.id === editingRubricId
                                    ? {
                                        ...s,
                                        scoreRuleItems: (s.scoreRuleItems || []).filter(
                                          (it) => it.id !== item.id,
                                        ),
                                      }
                                    : s,
                                ),
                              )
                            } else {
                              setLocalDraft((prev) => ({
                                ...prev,
                                scoreRuleItems: (prev.scoreRuleItems || []).filter(
                                  (it) => it.id !== item.id,
                                ),
                              }))
                            }
                          }}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => {
                  const newItem: ScoreRuleItem = {
                    id: `sr-${Date.now()}`,
                    name: '',
                    desc: '',
                    rule: '',
                    weight: 0,
                  }
                  if (editingRubricId) {
                    setRubricLibrary((prev) =>
                      prev.map((s) =>
                        s.id === editingRubricId
                          ? { ...s, scoreRuleItems: [...(s.scoreRuleItems || []), newItem] }
                          : s,
                      ),
                    )
                  } else {
                    setLocalDraft((prev) => ({
                      ...prev,
                      scoreRuleItems: [...(prev.scoreRuleItems || []), newItem],
                    }))
                  }
                }}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="h-4 w-4" />
                添加评价项
              </button>
              {(draftScheme.scoreRuleItems || []).length > 0 && (
                <div className="flex justify-end text-xs items-center gap-1">
                  <span className="text-gray-500">分值合计：</span>
                  <span className="font-semibold text-gray-700">
                    {(draftScheme.scoreRuleItems || []).reduce(
                      (sum, it) => sum + (it.weight || 0),
                      0,
                    )}
                  </span>
                </div>
              )}
            </div>
            {(draftScheme.scoreRuleItems || []).length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">尚未添加评价项</p>
                <p className="text-xs mt-1">点击上方按钮添加第一个评价项</p>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              const updates: any = { [rubricIdField]: null }
              const commonConfig = {
                ...state.methodResourceConfigs[methodKey],
                rubricName: draftScheme.name || '自定义评价标准',
                rubricMode: draftScheme.mode,
              }
              if (draftScheme.mode === 'score_rule') {
                const items = (draftScheme.scoreRuleItems || []).map((it: ScoreRuleItem) => ({
                  ...it,
                }))
                updates.methodResourceConfigs = {
                  ...state.methodResourceConfigs,
                  [methodKey]: {
                    ...commonConfig,
                    scoreRuleItems: items,
                  },
                }
                setEvalPoints(
                  info.field,
                  items.map((it: ScoreRuleItem) => ({
                    id: it.id,
                    name: it.name,
                    desc: it.rule,
                    subType: undefined,
                    types: [],
                    knowledgePointIds: [],
                    abilityPointIds: [],
                    scoringMethod: 'score' as const,
                    gradeMapping: [],
                    weight: it.weight,
                  })),
                )
              } else {
                updates.methodResourceConfigs = {
                  ...state.methodResourceConfigs,
                  [methodKey]: {
                    ...commonConfig,
                    scoreRuleItems: [],
                  },
                }
              }
              updateState(updates)
              toast({ title: '当前规则已保存', description: draftScheme.name || '自定义评价标准' })
              setSaveHint('保存成功')
              if (saveHintTimeoutRef.current) clearTimeout(saveHintTimeoutRef.current)
              saveHintTimeoutRef.current = setTimeout(() => setSaveHint(null), 3000)
            }}
          >
            保存
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => {
              setSaveTemplateDialogOpen(true)
              setSaveTemplateMode('new')
              setSelectedReplaceTemplateId(null)
            }}
          >
            保存到模板
          </Button>
          {saveHint && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-200">
              {saveHint}
            </span>
          )}
        </div>
        <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>保存到模板</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSaveTemplateMode('new')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs border transition-all',
                    saveTemplateMode === 'new'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  新增模板
                </button>
                <button
                  onClick={() => setSaveTemplateMode('replace')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs border transition-all',
                    saveTemplateMode === 'replace'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  替换现有模板
                </button>
              </div>
              {saveTemplateMode === 'new' ? (
                <div>
                  <Label className="text-xs text-gray-500">模板名称</Label>
                  <Input
                    value={draftScheme.name}
                    onChange={(e) => {
                      if (editingRubricId) {
                        setRubricLibrary((prev) =>
                          prev.map((s) =>
                            s.id === editingRubricId ? { ...s, name: e.target.value } : s,
                          ),
                        )
                      } else {
                        setLocalDraft((prev) => ({ ...prev, name: e.target.value }))
                      }
                    }}
                    className="mt-1 text-sm"
                    placeholder="输入模板名称"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">选择要替换的模板</Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {rubricLibrary
                      .filter((s) => !s.isDeleted)
                      .map((scheme) => (
                        <div
                          key={scheme.id}
                          onClick={() => setSelectedReplaceTemplateId(scheme.id)}
                          className={cn(
                            'p-3 rounded-lg border cursor-pointer transition-all',
                            selectedReplaceTemplateId === scheme.id
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300',
                          )}
                        >
                          <p className="text-sm font-medium">{scheme.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {scheme.mode === 'rubric' ? '评价量规' : '评分规则'}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setSaveTemplateDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="text-xs"
                onClick={async () => {
                  if (saveTemplateMode === 'new') {
                    await saveRubricToLibrary(null, {
                      name: draftScheme.name || '新建评价标准',
                      types: draftScheme.types,
                      desc: '',
                      mode: draftScheme.mode,
                      scoreRuleItems: draftScheme.scoreRuleItems,
                    })
                  } else if (selectedReplaceTemplateId) {
                    await saveRubricToLibrary(selectedReplaceTemplateId, {
                      name: draftScheme.name,
                      types: draftScheme.types,
                      desc: '',
                      mode: draftScheme.mode,
                      scoreRuleItems:
                        draftScheme.mode === 'score_rule' ? draftScheme.scoreRuleItems : undefined,
                    })
                    setRubricLibrary((prev) =>
                      prev.map((s) =>
                        s.id === selectedReplaceTemplateId
                          ? {
                              ...s,
                              points:
                                draftScheme.mode === 'rubric'
                                  ? info.points.map((p) => ({ ...p }))
                                  : s.points,
                              mode: draftScheme.mode,
                              scoreRuleItems: draftScheme.scoreRuleItems || [],
                            }
                          : s,
                      ),
                    )
                  }
                  if (draftScheme.mode === 'score_rule') {
                    setEvalPoints(
                      info.field,
                      (draftScheme.scoreRuleItems || []).map((it: ScoreRuleItem) => ({
                        id: it.id,
                        name: it.name,
                        desc: it.rule,
                        subType: undefined,
                        types: [],
                        knowledgePointIds: [],
                        abilityPointIds: [],
                        scoringMethod: 'score' as const,
                        gradeMapping: [],
                        weight: it.weight,
                      })),
                    )
                  }
                  updateState({
                    methodResourceConfigs: {
                      ...state.methodResourceConfigs,
                      [methodKey]: {
                        ...state.methodResourceConfigs[methodKey],
                        scoreRuleItems: [],
                      },
                    },
                  } as any)
                  setSaveTemplateDialogOpen(false)
                  setView('list')
                  setEditingRubricId(null)
                }}
                disabled={saveTemplateMode === 'replace' && !selectedReplaceTemplateId}
              >
                确认保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={gradeMappingDialogOpen}
          onOpenChange={(v) => !v && setGradeMappingDialogOpen(false)}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑评分等级</DialogTitle>
            </DialogHeader>
            {(() => {
              const ep = info.points.find((p) => p.id === editingGradeMappingPointId)
              if (!ep) return null
              const gm = ep.gradeMapping || []
              return (
                <div className="space-y-3 py-2">
                  {gm.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50/50"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={g.grade}
                            onChange={(e) => {
                              const newGm = gm.map((x) =>
                                x.id === g.id ? { ...x, grade: e.target.value } : x,
                              )
                              updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                            }}
                            className="w-14 h-7 text-center text-xs font-semibold"
                            placeholder="等级"
                          />
                          <Input
                            type="number"
                            value={g.minScore}
                            onChange={(e) => {
                              const newGm = gm.map((x) =>
                                x.id === g.id
                                  ? { ...x, minScore: parseInt(e.target.value) || 0 }
                                  : x,
                              )
                              updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                            }}
                            className="w-16 h-7 text-center text-xs"
                            min={0}
                            max={100}
                          />
                          <span className="text-gray-500 text-xs">-</span>
                          <Input
                            type="number"
                            value={g.maxScore}
                            onChange={(e) => {
                              const newGm = gm.map((x) =>
                                x.id === g.id
                                  ? { ...x, maxScore: parseInt(e.target.value) || 0 }
                                  : x,
                              )
                              updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                            }}
                            className="w-16 h-7 text-center text-xs"
                            min={0}
                            max={100}
                          />
                          <span className="text-xs text-gray-500">分</span>
                        </div>
                        <Input
                          value={g.remark || ''}
                          onChange={(e) => {
                            const newGm = gm.map((x) =>
                              x.id === g.id ? { ...x, remark: e.target.value } : x,
                            )
                            updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                          }}
                          className="h-7 text-xs"
                          placeholder="等级描述"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => {
                          const newGm = gm.filter((x) => x.id !== g.id)
                          updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      const colors = [
                        'bg-green-500',
                        'bg-blue-500',
                        'bg-yellow-500',
                        'bg-red-500',
                        'bg-purple-500',
                        'bg-orange-500',
                      ]
                      const newId = `grade-${Date.now()}`
                      const newGm = [
                        ...gm,
                        {
                          id: newId,
                          grade: '新等级',
                          minScore: 0,
                          maxScore: 100,
                          color: colors[gm.length % colors.length],
                          remark: '',
                        },
                      ]
                      updateEvalPoint(info.field, ep.id, { gradeMapping: newGm })
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    新增等级
                  </Button>
                </div>
              )
            })()}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setGradeMappingDialogOpen(false)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">选择评价标准方案</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => enterEdit(null)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加评价标准
          </Button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          value={schemeSearch}
          onChange={(e) => setSchemeSearch(e.target.value)}
          placeholder="搜索方案名称"
          className="pl-8 h-8 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-3">
        {rubricLibrary
          .filter((scheme) => !scheme.isDeleted || currentRubricId === scheme.id)
          .filter((scheme) => methodKey !== 'homework' || scheme.mode === 'score_rule')
          .filter(
            (scheme) =>
              !schemeSearch.trim() ||
              scheme.name.toLowerCase().includes(schemeSearch.trim().toLowerCase()),
          )
          .map((scheme) => {
            const isSelected = currentRubricId === scheme.id
            return (
              <div
                key={scheme.id}
                className={cn(
                  'p-4 rounded-xl border transition-all cursor-pointer',
                  isSelected
                    ? 'border-primary bg-white ring-1 ring-primary/20 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-primary/40 hover:shadow-sm',
                )}
                onClick={() => {
                  if (isSelected) {
                    updateState({
                      [rubricIdField]: null,
                      methodResourceConfigs: {
                        ...state.methodResourceConfigs,
                        [methodKey]: {
                          ...state.methodResourceConfigs[methodKey],
                          scoreRuleItems: [],
                        },
                      },
                    } as any)
                    setEvalPoints(info.field, [])
                  } else {
                    applyScheme(scheme.id)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-semibold">{scheme.name}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          scheme.mode === 'rubric'
                            ? 'bg-purple-50 text-purple-600 border-purple-200'
                            : 'bg-blue-50 text-blue-600 border-blue-200',
                        )}
                      >
                        {scheme.mode === 'rubric' ? '评价量规' : '评分规则'}
                      </Badge>
                      {isSelected && (
                        <div className="flex items-center gap-1 text-primary text-xs font-medium bg-primary/5 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          已选用
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{scheme.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {scheme.types.map((type) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className={cn('text-[10px]', evalSubTypeColors[type])}
                        >
                          {evalSubTypeLabels[type]}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {scheme.mode === 'rubric'
                        ? `${scheme.points.length} 个评价点`
                        : `${scheme.scoreRuleItems?.length || 0} 个评价项`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <Button
                      size="sm"
                      variant={isSelected ? 'outline' : 'default'}
                      className="h-7 text-[11px] px-2.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isSelected) {
                          updateState({
                            [rubricIdField]: null,
                            methodResourceConfigs: {
                              ...state.methodResourceConfigs,
                              [methodKey]: {
                                ...state.methodResourceConfigs[methodKey],
                                scoreRuleItems: [],
                              },
                            },
                          } as any)
                          setEvalPoints(info.field, [])
                        } else {
                          applyScheme(scheme.id)
                        }
                      }}
                    >
                      {isSelected ? '取消选用' : '选用'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewRuleScheme(scheme)
                      }}
                    >
                      查看规则
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        cloneScheme(scheme.id)
                      }}
                    >
                      克隆
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
      </div>
      {!currentRubricId && (
        <div className="text-center text-gray-400 py-6">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">尚未选用评价标准</p>
          <p className="text-xs mt-1">请从上方列表中选用一个评价标准方案</p>
        </div>
      )}
      <Dialog open={!!viewRuleScheme} onOpenChange={(v) => !v && setViewRuleScheme(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>查看规则</DialogTitle>
            <DialogDescription>
              {viewRuleScheme?.name}
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] ml-2',
                  viewRuleScheme?.mode === 'rubric'
                    ? 'bg-purple-50 text-purple-600 border-purple-200'
                    : 'bg-blue-50 text-blue-600 border-blue-200',
                )}
              >
                {viewRuleScheme?.mode === 'rubric' ? '评价量规' : '评分规则'}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          {viewRuleScheme?.mode === 'rubric' ? (
            <div className="space-y-2">
              {viewRuleScheme.points.length === 0 && (
                <p className="text-sm text-gray-400">暂无评价点</p>
              )}
              {viewRuleScheme.points.map((p, idx) => (
                <div key={p.id} className="p-3 rounded-lg border bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{idx + 1}.</span>
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">权重 {p.weight || 0}%</span>
                  </div>
                  {p.desc && <p className="text-xs text-gray-500 mb-1">{p.desc}</p>}
                  {p.gradeMapping && p.gradeMapping.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.gradeMapping.map((gm) => (
                        <Badge key={gm.id} variant="outline" className="text-[10px]">
                          {gm.grade} ({gm.minScore}-{gm.maxScore}分)
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(viewRuleScheme?.scoreRuleItems || []).length === 0 && (
                <p className="text-sm text-gray-400">暂无评价项</p>
              )}
              {(viewRuleScheme?.scoreRuleItems || []).map((it, idx) => (
                <div key={it.id} className="p-3 rounded-lg border bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{idx + 1}.</span>
                    <span className="text-sm font-medium">{it.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">分值 {it.weight || 0}</span>
                  </div>
                  {it.desc && <p className="text-xs text-gray-500 mb-1">{it.desc}</p>}
                  {it.rule && <p className="text-xs text-gray-500">规则：{it.rule}</p>}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button size="sm" onClick={() => setViewRuleScheme(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
