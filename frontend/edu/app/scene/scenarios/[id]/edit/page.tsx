'use client'

import { Star, X, Sparkles, Undo2, Loader2 } from 'lucide-react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { cn } from '@/lib/utils'
import {
  positionApi,
  industryApi,
  sceneBatchApi,
  scenarioApi,
  fileApi,
  majorApi,
  scenarioAiAssist,
} from '@/lib/api'
import type { AIScenarioAssistResponse, AIScenarioSuggestion } from '@/lib/api'
import type { CareerPosition } from '@/lib/types/job'
import type { Industry, Major } from '@/lib/types/backend'
import type { SceneBatch } from '@/lib/types/scene'
import { toast, ComboboxSelect } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import { UserSelector } from '@/components/shared/user-selector'
import { EditorShell } from '@/components/shared/editor-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
import { AiAssistProgressDialog } from '@/components/job/position-builder/ai-assist-progress-dialog'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import {
  useAiNotConfigured,
  useAiFieldWriter,
  useAiPipeline,
} from '@/lib/ai/use-ai-assist'

/** AI 辅助编写一键流程的步骤（与字段顺序一一对应） */
const AI_ASSIST_STEPS = ['阅读场景基础信息', '生成场景基础信息']

/** AI 可直接写入的字段键（3 个文本/枚举字段 + 2 个字典建议字段 + 目标岗位），各含 1 级撤销历史 */
type AiWriteKey = 'name' | 'background' | 'difficulty' | 'industry' | 'profession' | 'position'

const AI_WRITE_KEYS: AiWriteKey[] = ['name', 'background', 'difficulty', 'industry', 'profession', 'position']

/** 基础信息中可由 AI 单独填充的字段（polish 一次返回 3 个，按目标字段单独应用） */
type PolishFieldKey = 'name' | 'background' | 'difficulty'

/** AI 写入分发的草稿快照（与页面分散 useState 对应的聚合视图） */
interface ScenarioDraft {
  name: string
  background: string
  difficulty: number
  industryIds: string[]
  professionIds: string[]
  positionId: string
}

export default function ScenarioEditPage() {
  const t = useT()
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scenarioId = params.id as string
  const hasSavedRef = useRef(false)
  const isNewScenario = searchParams.get('new') === 'true'
  const { tenantId } = useAuth()

  const [allPositions, setAllPositions] = useState<CareerPosition[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [batches, setBatches] = useState<SceneBatch[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [scenarioName, setScenarioName] = useState('')
  const [positionId, setPositionId] = useState('')
  const [professionIds, setProfessionIds] = useState<string[]>([])
  const [batchId, setBatchId] = useState('')
  const [industryIds, setIndustryIds] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<number>(3)
  const [background, setBackground] = useState('')
  // 从后端回填真实创建人姓名；新建场景（无 creatorName）回退展示「当前用户」
  const [creatorName, setCreatorName] = useState('')
  const [creatorId, setCreatorId] = useState<string>('')
  const [coBuilderIds, setCoBuilderIds] = useState<string[]>([])
  const [version, setVersion] = useState('V1.0')
  const [coverImage, setCoverImage] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [scenarioStatus, setScenarioStatus] = useState<string>('draft')

  const [isPreviewConfirmOpen, setIsPreviewConfirmOpen] = useState(false)

  // ===== AI 辅助编写状态（公共 hook：未配置引导 / 字段级写入保护 / 串行流水线） =====
  // 最新草稿快照：AI 回调时读取，避免闭包内拿到过期值
  const formRef = useRef<ScenarioDraft>({
    name: '',
    background: '',
    difficulty: 3,
    industryIds: [],
    professionIds: [],
    positionId: '',
  })
  useEffect(() => {
    formRef.current = {
      name: scenarioName,
      background,
      difficulty,
      industryIds,
      professionIds,
      positionId,
    }
  }, [scenarioName, background, difficulty, industryIds, professionIds, positionId])

  /** 某字段被 AI 覆盖前的快照（1 级历史用） */
  const snapshotField = (key: AiWriteKey): Partial<ScenarioDraft> => {
    const cur = formRef.current
    switch (key) {
      case 'name':
        return { name: cur.name }
      case 'background':
        return { background: cur.background }
      case 'difficulty':
        return { difficulty: cur.difficulty }
      case 'industry':
        return { industryIds: cur.industryIds }
      case 'profession':
        return { professionIds: cur.professionIds }
      case 'position':
        return { positionId: cur.positionId }
    }
  }

  /** AI 写入分发：Partial<ScenarioDraft> → 页面分散 setter */
  const applyAiUpdate = (data: Partial<ScenarioDraft>) => {
    if (data.name !== undefined) setScenarioName(data.name)
    if (data.background !== undefined) setBackground(data.background)
    if (data.difficulty !== undefined) setDifficulty(data.difficulty)
    if (data.industryIds !== undefined) setIndustryIds(data.industryIds)
    if (data.professionIds !== undefined) setProfessionIds(data.professionIds)
    if (data.positionId !== undefined) setPositionId(data.positionId)
  }

  const ai = useAiNotConfigured()
  const writer = useAiFieldWriter<AiWriteKey, Partial<ScenarioDraft>>(
    AI_WRITE_KEYS,
    applyAiUpdate,
    snapshotField,
  )
  const pipeline = useAiPipeline<unknown, AIScenarioAssistResponse>({
    steps: AI_ASSIST_STEPS,
    request: (_task, signal) =>
      scenarioAiAssist(
        {
          field: 'polish',
          scenario: {
            name: formRef.current.name,
            background: formRef.current.background,
            difficulty: formRef.current.difficulty,
            industryNames: resolveIndustryNames(formRef.current.industryIds),
            professionNames: resolveMajorNames(formRef.current.professionIds),
            positionId,
            positionName: positionId
              ? allPositions.find((p) => p.id === positionId)?.name || ''
              : '',
            taskName: '',
            taskBackground: '',
            taskDescription: '',
            taskDifficulty: 0,
            existingTasks: [],
            intention: '',
          },
        },
        signal,
      ),
    onError: (err) => {
      if (ai.markNotConfigured(err)) return true
      toast({
        title: t('AI 生成失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
      return true
    },
  })
  const { aiHistories, flashKey, writeField, restoreField, restoreAll, updatedCount } = writer

  const [quickFillOpen, setQuickFillOpen] = useState(false)
  const [quickFill, setQuickFill] = useState({ name: '', background: '' })
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true)
      try {
        const [posRes, indRes, batchRes, majRes, scenario] = await Promise.all([
          positionApi.list({ limit: 1000 }),
          industryApi.list({ limit: 1000 }),
          sceneBatchApi.list({ limit: 1000 }),
          majorApi.list({ limit: 1000 }),
          scenarioApi.get(scenarioId),
        ])
        setAllPositions(posRes.items)
        setIndustries(indRes.items)
        setBatches(batchRes.items)
        setMajors(majRes.items.filter((m) => m.enabled))

        setScenarioName(scenario.name || '')
        setPositionId(scenario.careerPositionId || '')
        setProfessionIds(scenario.professionIds || [])
        setBatchId(scenario.batchId || '')
        setIndustryIds(scenario.industryIds || [])
        setDifficulty(scenario.difficulty || 3)
        setBackground(scenario.background || '')
        setCreatorId(scenario.creatorId || '')
        setCreatorName(scenario.creatorName || '')
        setCoBuilderIds((scenario.coBuilderIds || []).filter((id) => id !== scenario.creatorId))
        setVersion(scenario.version || 'V1.0')
        setCoverImage(scenario.coverImage || '')
        setScenarioStatus(scenario.status || 'draft')
      } catch (err: any) {
        reportError(err, '加载场景表单数据')
        toast({ title: err.message || t('请刷新页面重试'), variant: 'destructive' })
      } finally {
        setDataLoading(false)
      }
    }
    loadData()
  }, [scenarioId, t])

  const positioningGroups = useMemo(() => {
    const groups: Record<string, CareerPosition[]> = {}
    allPositions.forEach((p) => {
      const key = industries.find((i) => i.id === p.industryId)?.name || t('其他')
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return groups
  }, [allPositions, industries, t])

  const buildPayload = () => {
    return {
      name: scenarioName.trim(),
      careerPositionId: positionId || null,
      batchId: batchId || null,
      industryIds: industryIds.length > 0 ? industryIds : null,
      professionIds: professionIds.length > 0 ? professionIds : null,
      difficulty,
      background: background || null,
      version,
      coBuilderIds,
      coverImage: coverImage || null,
    }
  }

  const handleProceed = async () => {
    if (!scenarioName.trim()) return
    setIsSaving(true)
    try {
      await scenarioApi.update(scenarioId, buildPayload() as any)
      hasSavedRef.current = true
      toast({ title: t('保存成功') })
      navigate(`/scene/scenarios/${scenarioId}/edit/tasks`)
    } catch (err: any) {
      toast({ title: err.message || t('请稍后重试'), variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!scenarioName.trim()) return
    setIsSaving(true)
    try {
      await scenarioApi.update(scenarioId, buildPayload() as any)
      hasSavedRef.current = true
      if (scenarioStatus !== 'draft') {
        await scenarioApi.saveDraft(scenarioId)
        setScenarioStatus('draft')
      }
      toast({ title: t('草稿已保存') })
    } catch (err: any) {
      toast({ title: err.message || t('请稍后重试'), variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      setCoverImage(res.url)
      toast({ title: t('封面上传成功') })
    } catch (err: any) {
      reportError(err, '上传封面')
      toast({ title: err?.message || t('请稍后重试'), variant: 'destructive' })
    } finally {
      setCoverUploading(false)
    }
  }

  // ===== AI 辅助编写逻辑 =====

  const resolveIndustryNames = (ids: string[]) =>
    ids.map((id) => industries.find((i) => i.id === id)?.name || '').filter(Boolean)

  const resolveMajorNames = (ids: string[]) =>
    ids.map((id) => majors.find((m) => m.id === id)?.name || '').filter(Boolean)

  const polishFieldLabel = (key: PolishFieldKey) =>
    ({ name: t('场景名称'), background: t('场景介绍'), difficulty: t('难度等级') })[key]

  /** 追加去重写入字典建议（引用优先：仅 matchedId 命中项写入） */
  const applyDictSuggestions = (
    key: 'industry' | 'profession',
    suggestions: AIScenarioAssistResponse['industrySuggestions'],
    currentIds: string[],
  ) => {
    if (!suggestions || suggestions.length === 0) return
    const matched = suggestions.filter((s) => s.matchedId)
    const unmatched = suggestions.filter((s) => !s.matchedId)
    if (matched.length > 0) {
      const next = [...currentIds]
      for (const s of matched) {
        if (!next.includes(s.matchedId!)) next.push(s.matchedId!)
      }
      writeField(key, key === 'industry' ? { industryIds: next } : { professionIds: next })
    }
    if (unmatched.length > 0) {
      toast({
        title: t('以下{what}未在字典中找到，请手动选择', {
          what: key === 'industry' ? t('行业') : t('专业'),
        }),
        description: unmatched.map((s) => s.name).join('、'),
      })
    }
  }

  /** 目标岗位建议：命中系统已有岗位则自动选中（计入 AI 更新历史，可恢复上版）；未命中仅提示不写入 */
  const applyPositionSuggestion = (suggestion?: AIScenarioSuggestion) => {
    if (!suggestion) return
    if (suggestion.matchedId) {
      writeField('position', { positionId: suggestion.matchedId })
      return
    }
    toast({
      title: t('AI 建议的目标岗位「{name}」未在系统中找到，请手动选择', { name: suggestion.name }),
    })
  }

  /** 应用 polish 结果：3 个字段逐项写入（各自独立历史/高亮）；未生成项提示保留原值 */
  const applyPolish = (res: AIScenarioAssistResponse) => {
    const p = res.polish
    if (!p) return
    const skipped: string[] = []
    if (p.name.trim()) writeField('name', { name: p.name.trim() })
    else skipped.push(polishFieldLabel('name'))
    if (p.background.trim()) writeField('background', { background: p.background.trim() })
    else skipped.push(polishFieldLabel('background'))
    if (p.difficulty >= 1 && p.difficulty <= 5) writeField('difficulty', { difficulty: p.difficulty })
    else skipped.push(polishFieldLabel('difficulty'))
    if (skipped.length > 0) {
      toast({ title: t('AI 未生成：{fields}，已保留原内容', { fields: skipped.join('、') }) })
    }
    applyDictSuggestions('industry', res.industrySuggestions, formRef.current.industryIds)
    applyDictSuggestions('profession', res.professionSuggestions, formRef.current.professionIds)
    applyPositionSuggestion(res.positionSuggestion)
  }

  /** 基础信息单字段生成：调 polish 一次，仅应用目标字段 */
  const handlePolishField = (target: PolishFieldKey) => {
    pipeline.run(
      [
        {
          id: 'polish',
          meta: undefined,
          apply: (res) => {
            const p = res.polish
            if (!p) return
            if (target === 'name' && p.name.trim()) {
              writeField('name', { name: p.name.trim() })
              return
            }
            if (target === 'background' && p.background.trim()) {
              writeField('background', { background: p.background.trim() })
              return
            }
            if (target === 'difficulty' && p.difficulty >= 1 && p.difficulty <= 5) {
              writeField('difficulty', { difficulty: p.difficulty })
              return
            }
            toast({ title: t('AI 未生成{field}，已保留原内容', { field: polishFieldLabel(target) }) })
          },
        },
      ],
      { showDialog: false },
    )
  }

  const getMissingFields = () => {
    const missing: string[] = []
    if (!scenarioName.trim()) missing.push(t('场景名称'))
    if (!background.trim()) missing.push(t('场景介绍'))
    return missing
  }

  const openQuickFill = () => {
    setQuickFill({ name: scenarioName, background })
    setQuickFillOpen(true)
  }

  const confirmQuickFillAndStartAi = () => {
    if (quickFill.name.trim()) setScenarioName(quickFill.name.trim())
    if (quickFill.background.trim()) setBackground(quickFill.background.trim())
    // formRef 由 useEffect 在渲染提交后才同步，同一次点击内仍持有旧值；
    // AI 请求（pipeline.request）同步读取 formRef.current，先写入补全值，
    // 避免 runAiAssist 携带旧 name/background 发起请求、随后用旧上下文覆盖刚确认的补全内容
    formRef.current = {
      ...formRef.current,
      name: quickFill.name.trim() || formRef.current.name,
      background: quickFill.background.trim() || formRef.current.background,
    }
    setQuickFillOpen(false)
    runAiAssist()
  }

  /** 一键流程：polish 一次生成全部可写字段（3 文本字段 + 行业/专业建议），进度弹窗展示 */
  const runAiAssist = () => {
    ai.resetNotConfigured()
    pipeline.run([{ id: 'polish', meta: undefined, apply: applyPolish }])
  }

  const startAiAssist = () => {
    if (getMissingFields().length > 0) {
      openQuickFill()
      return
    }
    // 每次点击均先弹确认，明确"将重新生成全部内容"的意图
    setConfirmRegenOpen(true)
  }

  const confirmRegenAndRun = () => {
    setConfirmRegenOpen(false)
    runAiAssist()
  }

  const handleRestoreAll = () => {
    restoreAll(() => toast({ title: t('已全部恢复 AI 覆盖前的内容') }))
  }

  /** 基础信息单字段 AI 控件：生成按钮 + 已更新标记/恢复上版 */
  const renderFieldAiControls = (key: PolishFieldKey) => (
    <span className="flex items-center gap-1.5">
      {aiHistories[key] !== undefined && (
        <>
          <Badge
            variant="outline"
            className="h-4 px-1.5 text-[10px] leading-none border-purple-200 text-purple-700 bg-purple-50/50 shrink-0"
          >
            {t('已更新')}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-purple-700 hover:bg-purple-50"
            onClick={() => restoreField(key)}
          >
            <Undo2 className="h-3 w-3 mr-0.5" />
            {t('恢复上版')}
          </Button>
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-purple-600 hover:bg-purple-50 hover:text-purple-800"
        onClick={() => handlePolishField(key)}
        disabled={pipeline.isRunning}
        title={t('AI 生成')}
      >
        {pipeline.isRunning && pipeline.runningId === 'polish' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </Button>
    </span>
  )

  return (
    <EditorShell
      mode="fullscreen"
      backText={t('取消')}
      onBack={async () => {
        if (isNewScenario && !hasSavedRef.current) {
          try {
            await scenarioApi.delete(scenarioId)
          } catch (err) {
            reportError(err, '删除未保存的场景草稿')
          }
        }
        navigate('/scene')
      }}
      step={1}
      stepLabel={t('基础信息编辑')}
      onSaveDraft={handleSaveDraft}
      isSaving={isSaving}
      saveDisabled={!scenarioName}
      onPreview={() => setIsPreviewConfirmOpen(true)}
      onNext={handleProceed}
      nextText={isSaving ? t('保存中...') : t('下一步')}
      nextDisabled={!scenarioName}
      title={t('编辑实践场景')}
      subtitle={t('填写场景基础信息，完成后进入任务链配置')}
    >
      {dataLoading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">{t('加载中...')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6 lg:col-span-2">
            {/* AI 辅助编写入口 */}
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                {t('填写基础信息后，点击「AI 辅助编写」让大模型帮您润色与补齐')}
              </p>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
                onClick={startAiAssist}
                disabled={pipeline.isRunning}
              >
                <Sparkles className="h-4 w-4" />
                {t('AI 辅助编写')}
              </Button>
            </div>

            {/* AI 覆盖内容常驻撤销横幅 */}
            {updatedCount > 0 && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-purple-200 bg-purple-50/50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-purple-900 min-w-0">
                  <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="truncate">
                    {t('AI 已更新 {count} 项内容，可逐项恢复上版或全部撤销', { count: updatedCount })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                    onClick={handleRestoreAll}
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    {t('全部撤销')}
                  </Button>
                </div>
              </div>
            )}

            <Card className={flashKey && ['name', 'background', 'difficulty'].includes(flashKey) ? 'ai-write-flash' : undefined}>
              <CardContent className="pt-6 space-y-5">
                <FormFieldRow
                  label={
                    <span className="flex items-center gap-2">
                      {t('场景名称')}
                      {renderFieldAiControls('name')}
                    </span>
                  }
                  required
                  htmlFor="name"
                  className={flashKey === 'name' ? 'ai-write-flash' : undefined}
                >
                  <Input
                    id="name"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder={t('请输入场景名称')}
                  />
                </FormFieldRow>

                <FormFieldGrid cols={2}>
                  <FormFieldRow
                    label={
                      <span className="flex items-center gap-2">
                        {t('面向行业')}
                        {aiHistories.industry !== undefined && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 text-[10px] leading-none border-purple-200 text-purple-700 bg-purple-50/50 shrink-0"
                          >
                            {t('已更新')}
                          </Badge>
                        )}
                      </span>
                    }
                    className={flashKey === 'industry' ? 'ai-write-flash' : undefined}
                  >
                    <ComboboxSelect
                      multiple
                      className="w-full"
                      options={industries.map((i) => ({ label: i.name, value: i.id }))}
                      value={industryIds}
                      onChange={setIndustryIds}
                      placeholder={t('选择行业')}
                    />
                  </FormFieldRow>
                  <FormFieldRow
                    label={
                      <span className="flex items-center gap-2">
                        {t('适用专业')}
                        {aiHistories.profession !== undefined && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 text-[10px] leading-none border-purple-200 text-purple-700 bg-purple-50/50 shrink-0"
                          >
                            {t('已更新')}
                          </Badge>
                        )}
                      </span>
                    }
                    className={flashKey === 'profession' ? 'ai-write-flash' : undefined}
                  >
                    <ComboboxSelect
                      multiple
                      className="w-full"
                      options={majors.map((m) => ({
                        label: `${m.name}${m.code ? ` (${m.code})` : ''}`,
                        value: m.id,
                      }))}
                      value={professionIds}
                      onChange={setProfessionIds}
                      placeholder={t('选择适用专业')}
                    />
                  </FormFieldRow>
                </FormFieldGrid>

                <div className={`grid gap-2 ${flashKey === 'difficulty' ? 'ai-write-flash' : ''}`}>
                  <Label className="flex items-center gap-2">
                    {t('难度等级')}
                    {renderFieldAiControls('difficulty')}
                  </Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDifficulty(level)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={cn(
                            'h-6 w-6 transition-colors',
                            level <= difficulty
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-gray-200 text-gray-200 hover:fill-amber-200 hover:text-amber-200',
                          )}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-gray-500">
                      {difficulty === 1 && t('入门')}
                      {difficulty === 2 && t('基础')}
                      {difficulty === 3 && t('中级')}
                      {difficulty === 4 && t('高级')}
                      {difficulty === 5 && t('专家')}
                    </span>
                  </div>
                </div>

                <div className={`grid gap-2 ${flashKey === 'background' ? 'ai-write-flash' : ''}`}>
                  <Label htmlFor="background" className="flex items-center gap-2">
                    {t('场景介绍')}
                    {renderFieldAiControls('background')}
                  </Label>
                  <div className="border rounded-lg">
                    <Textarea
                      id="background"
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      placeholder={t('描述该场景的背景、意义和学习目标...')}
                      className="border-0 min-h-[200px] focus-visible:ring-0 rounded-t-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <CoverImageUpload
                  imageUrl={coverImage}
                  uploading={coverUploading}
                  label={t('场景封面')}
                  alt={t('场景封面')}
                  onUpload={handleCoverUpload}
                  onRemove={() => setCoverImage('')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className={`grid gap-2 ${flashKey === 'position' ? 'ai-write-flash' : ''}`}>
                  <Label htmlFor="position" className="flex items-center gap-2">
                    {t('目标岗位')}
                    {aiHistories.position !== undefined && (
                      <>
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[10px] leading-none border-purple-200 text-purple-700 bg-purple-50/50 shrink-0"
                        >
                          {t('已更新')}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px] text-purple-700 hover:bg-purple-50"
                          onClick={() => restoreField('position')}
                        >
                          <Undo2 className="h-3 w-3 mr-0.5" />
                          {t('恢复上版')}
                        </Button>
                      </>
                    )}
                  </Label>
                  <div className="relative">
                    <Select value={positionId} onValueChange={setPositionId}>
                      <SelectTrigger id="position" className={positionId ? 'pr-8' : ''}>
                        <SelectValue placeholder={t('请选择岗位')} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(positioningGroups).map(([group, positions]) => (
                          <div key={group}>
                            <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">
                              {group}
                            </div>
                            {positions.map((pos) => (
                              <SelectItem key={pos.id} value={pos.id}>
                                {pos.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    {positionId && (
                      <button
                        type="button"
                        onClick={() => setPositionId('')}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="batch" className="block">
                    {t('所属批次')}
                  </Label>
                  <div className="relative">
                    <Select value={batchId} onValueChange={setBatchId}>
                      <SelectTrigger id="batch" className={batchId ? 'pr-8' : ''}>
                        <SelectValue placeholder={t('请选择批次')} />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {batchId && (
                      <button
                        type="button"
                        onClick={() => setBatchId('')}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="block text-gray-500 text-xs">{t('创建人')}</Label>
                  <p className="font-medium text-gray-800 mt-1">{creatorName || t('当前用户')}</p>
                </div>

                <div>
                  <Label className="block mb-2">{t('共建人/共建部门')}</Label>
                  <UserSelector
                    value={coBuilderIds}
                    onChange={(ids) => setCoBuilderIds(ids.filter((id) => id !== creatorId))}
                    multiple
                    placeholder={t('点击选择共建人')}
                    tenantId={tenantId}
                    excludeUserIds={creatorId ? [creatorId] : undefined}
                    showEnterpriseExperts
                  />
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <Label className="block text-gray-500 text-xs">{t('当前版本号')}</Label>
                  <p className="font-medium text-gray-800 mt-1">{version}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* AI 辅助编写进度弹窗；运行中关闭弹窗视为取消流水线 */}
      <AiAssistProgressDialog
        open={pipeline.open}
        onOpenChange={pipeline.handleOpenChange}
        title={t('AI 辅助编写')}
        description={t('大模型正在阅读场景信息并生成润色与补齐结果')}
        steps={AI_ASSIST_STEPS}
        currentStep={pipeline.phase}
        progress={pipeline.progress}
      />

      {/* 快速补全必填信息弹窗 */}
      <Dialog open={quickFillOpen} onOpenChange={setQuickFillOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl border-gray-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-800">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('快速补全必填信息')}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {t('以下必填字段尚未填写，请补充后继续使用 AI 辅助编写。')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!scenarioName.trim() && (
              <div className="space-y-1.5">
                <Label>
                  {t('场景名称')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={quickFill.name}
                  onChange={(e) => setQuickFill({ ...quickFill, name: e.target.value })}
                  placeholder={t('例如：电商平台全栈开发实战')}
                  className="h-9"
                />
              </div>
            )}

            {!background.trim() && (
              <div className="space-y-1.5">
                <Label>
                  {t('场景介绍')} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={quickFill.background}
                  onChange={(e) => setQuickFill({ ...quickFill, background: e.target.value })}
                  placeholder={t('一句话描述该场景的背景与目标...')}
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuickFillOpen(false)}>
              {t('取消')}
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 gap-1"
              disabled={
                (!scenarioName.trim() && !quickFill.name.trim()) ||
                (!background.trim() && !quickFill.background.trim())
              }
              onClick={confirmQuickFillAndStartAi}
            >
              <Sparkles className="h-4 w-4" />
              {t('开始 AI 辅助编写')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 未配置引导弹窗 */}
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />

      {/* 每次 AI 辅助编写前的意图确认弹窗 */}
      <Dialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('确认重新生成全部内容？')}
            </DialogTitle>
            <DialogDescription>
              {t('AI 将基于当前填写的场景信息重新生成并直接覆盖：场景名称、场景介绍、难度等级，并建议面向行业与适用专业（命中的字典项直接选中）。每个字段均可单独「恢复上版」，也可全部撤销。')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmRegenOpen(false)}>
              {t('取消')}
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 gap-1" onClick={confirmRegenAndRun}>
              <Sparkles className="h-4 w-4" />
              {t('确认生成')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isPreviewConfirmOpen}
        onOpenChange={setIsPreviewConfirmOpen}
        title={t('即将离开当前页面')}
        description={t('请确认是否已经保存数据')}
        confirmText={t('跳转预览')}
        cancelText={t('取消')}
        onConfirm={() => navigate(`/scene/landing/${scenarioId}`)}
      />
    </EditorShell>
  )
}
