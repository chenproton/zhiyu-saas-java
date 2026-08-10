'use client'

// 复制自 portal 场景基础信息编辑页 apps/edu/app/scene/scenarios/[id]/edit/page.tsx（方案A：复制胶水页 + 组件层复用）。
// 裁剪点（共通 bug 修复时需双向检查）：
// - useAuth → usePartnerAuth；scenarioApi/positionApi → partnerCobuildScenarioApi/partnerCobuildPositionApi
// - EditorShell mode='inline'（fullscreen 会内嵌 portal TopNav）
// - 删除 portal 专属：所属批次 sceneBatchApi、共建人 UserSelector、预览跳转（/scene/landing）
// - 行业/专业无 partner 字典端点：改为只读展示已有值（更新时不携带对应字段，后端保留原值）
// - 目标岗位收窄为本企业共建岗位（partnerCobuildPositionApi.list({ schoolTenantId })）
// - 按 status 控制：draft/rejected 可编辑+提交审核，pending 可编辑+撤回，approved/published/archived 整页只读
import { Star, X, Send, Undo2 } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { cn } from '@/lib/utils'
import {
  partnerCobuildScenarioApi,
  partnerCobuildPositionApi,
  fileApi,
} from '@/lib/api'
import type { CoBuildPosition, CoBuildScenario, CoBuildStatus } from '@/lib/api'
import { toast } from '@zhiyu/ui'
import { StatusBadge } from '@/components/shared/status-badge'
import { EditorShell } from '@/components/shared/editor-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

// 可编辑状态：draft/rejected 可编辑+提交审核，pending 可编辑+撤回；其余整页只读（后端同样强制）
const EDITABLE_STATUSES: CoBuildStatus[] = ['draft', 'pending', 'rejected']

// get 端点当前只返回场景主表字段（tenantId 为学校租户）
type CoBuildScenarioDetail = CoBuildScenario & { tenantId?: string }

export default function PartnerScenarioEditPage() {
  const t = useT()
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scenarioId = params.id as string
  const hasSavedRef = useRef(false)
  const isNewScenario = searchParams.get('new') === 'true'

  const [coBuildPositions, setCoBuildPositions] = useState<CoBuildPosition[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [acting, setActing] = useState(false)

  const [scenarioName, setScenarioName] = useState('')
  const [positionId, setPositionId] = useState('')
  const [difficulty, setDifficulty] = useState<number>(3)
  const [background, setBackground] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [version, setVersion] = useState('v1.0')
  const [coverImage, setCoverImage] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [scenarioStatus, setScenarioStatus] = useState<string>('draft')
  const [industryNames, setIndustryNames] = useState<string[]>([])
  const [professionNames, setProfessionNames] = useState<string[]>([])

  const [confirmAction, setConfirmAction] = useState<'submit' | 'withdraw' | null>(null)

  const readOnly = !EDITABLE_STATUSES.includes(scenarioStatus as CoBuildStatus)

  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true)
      try {
        const scenario = (await partnerCobuildScenarioApi.get(scenarioId)) as CoBuildScenarioDetail
        const schoolTenantId = scenario.schoolTenantId || scenario.tenantId || ''
        // 目标岗位下拉：仅本企业在该学校的共建岗位
        const posRes = schoolTenantId
          ? await partnerCobuildPositionApi.list({ schoolTenantId, limit: 200 })
          : { items: [] as CoBuildPosition[] }
        setCoBuildPositions(posRes.items || [])

        setScenarioName(scenario.name || '')
        setPositionId(scenario.careerPositionId || '')
        setDifficulty(scenario.difficulty || 3)
        setBackground(scenario.background || '')
        setCreatorName(scenario.creatorName || '')
        setVersion(scenario.version || 'v1.0')
        setCoverImage(scenario.coverImage || '')
        setScenarioStatus(scenario.status || 'draft')
        setIndustryNames(scenario.industryNames || [])
        setProfessionNames(scenario.professionNames || [])
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
    const groups: Record<string, CoBuildPosition[]> = {}
    coBuildPositions.forEach((p) => {
      const key = t('共建岗位')
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return groups
  }, [coBuildPositions, t])

  // 行业/专业/批次/共建人无 partner 数据源：更新时不携带这些字段，后端保留原值
  const buildPayload = () => {
    return {
      name: scenarioName.trim(),
      careerPositionId: positionId || null,
      difficulty,
      background: background || null,
      version,
      coverImage: coverImage || null,
    }
  }

  const handleProceed = async () => {
    if (!scenarioName.trim()) return
    setIsSaving(true)
    try {
      await partnerCobuildScenarioApi.update(scenarioId, buildPayload() as any)
      hasSavedRef.current = true
      toast({ title: t('保存成功') })
      router.push(`/partner/co-build/scenes/${scenarioId}/edit/tasks`)
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
      const updated = await partnerCobuildScenarioApi.update(scenarioId, buildPayload() as any)
      hasSavedRef.current = true
      if (updated.status && updated.status !== scenarioStatus) {
        setScenarioStatus(updated.status)
      }
      toast({ title: t('已保存') })
    } catch (err: any) {
      toast({ title: err.message || t('请稍后重试'), variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTransition = async () => {
    if (!confirmAction) return
    setActing(true)
    try {
      const updated =
        confirmAction === 'submit'
          ? await partnerCobuildScenarioApi.submit(scenarioId)
          : await partnerCobuildScenarioApi.withdraw(scenarioId)
      setScenarioStatus(updated.status || scenarioStatus)
      toast({ title: confirmAction === 'submit' ? t('已提交审核') : t('已撤回') })
      setConfirmAction(null)
    } catch (err: any) {
      reportError(err, confirmAction === 'submit' ? '提交审核' : '撤回审核')
      toast({ title: err?.message || t('请稍后重试'), variant: 'destructive' })
    } finally {
      setActing(false)
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

  return (
    <EditorShell
      mode="inline"
      backText={t('返回')}
      onBack={async () => {
        if (isNewScenario && !hasSavedRef.current) {
          try {
            await partnerCobuildScenarioApi.delete(scenarioId)
          } catch (err) {
            reportError(err, '删除未保存的场景草稿')
          }
        }
        router.push('/partner/co-build/scenes')
      }}
      step={1}
      stepLabel={t('基础信息编辑')}
      onSaveDraft={readOnly ? undefined : handleSaveDraft}
      isSaving={isSaving}
      saveText={t('保存')}
      saveDisabled={!scenarioName}
      onNext={readOnly ? undefined : handleProceed}
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
        <fieldset disabled={readOnly} className="contents">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardContent className="pt-6 space-y-5">
                  <FormFieldRow label={t('场景名称')} required htmlFor="name">
                    <Input
                      id="name"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder={t('请输入场景名称')}
                    />
                  </FormFieldRow>

                  {(industryNames.length > 0 || professionNames.length > 0) && (
                    <FormFieldRow label={t('面向行业 / 适用专业')}>
                      <p className="text-sm text-gray-600">
                        {[...industryNames, ...professionNames].join('、') || '-'}
                      </p>
                    </FormFieldRow>
                  )}

                  <div className="grid gap-2">
                    <Label>{t('难度等级')}</Label>
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

                  <div className="grid gap-2">
                    <Label htmlFor="background" className="block">
                      {t('场景介绍')}
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
                  <div className="grid gap-2">
                    <Label htmlFor="position" className="block">
                      {t('目标岗位')}
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
                    <p className="text-xs text-muted-foreground">
                      {t('仅可选择本企业为该学校共建的岗位')}
                    </p>
                  </div>

                  <div>
                    <Label className="block text-gray-500 text-xs">{t('当前状态')}</Label>
                    <div className="mt-1">
                      <StatusBadge status={scenarioStatus} />
                    </div>
                  </div>

                  <div>
                    <Label className="block text-gray-500 text-xs">{t('创建人')}</Label>
                    <p className="font-medium text-gray-800 mt-1">{creatorName || t('当前用户')}</p>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <Label className="block text-gray-500 text-xs">{t('当前版本号')}</Label>
                    <p className="font-medium text-gray-800 mt-1">{version}</p>
                  </div>

                  {(scenarioStatus === 'draft' || scenarioStatus === 'rejected') && (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={acting}
                      onClick={() => setConfirmAction('submit')}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {t('提交审核')}
                    </Button>
                  )}
                  {scenarioStatus === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={acting}
                      onClick={() => setConfirmAction('withdraw')}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      {t('撤回')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </fieldset>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction === 'submit' ? t('提交审核') : t('撤回审核')}
        description={
          confirmAction === 'submit'
            ? t('提交后由合作学校审批，审批期间可撤回。确认提交？')
            : t('撤回后场景将退回草稿状态，可继续编辑。确认撤回？')
        }
        confirmText={confirmAction === 'submit' ? t('确认提交') : t('确认撤回')}
        cancelText={t('取消')}
        onConfirm={handleTransition}
      />
    </EditorShell>
  )
}
