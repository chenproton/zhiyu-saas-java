'use client'

// 复制自 portal 岗位编辑页 apps/edu/app/job/positions/[id]/edit/page.tsx（方案A：复制胶水页 + 组件层复用）。
// 裁剪点（共通 bug 修复时需双向检查）：
// - useAuth → usePartnerAuth；positionApi → partnerCobuildPositionApi（保存走 save-full，无 saveDraft）；
//   详情子表（职责/证书/能力绑定/能力域）走 partnerCobuildPositionApi.list* 4 个只读端点（形状同 portal 对应 api），
//   能力池走 partnerCobuildSchoolApi.abilities(schoolTenantId)
// - EditorShell mode='inline'（fullscreen 会内嵌 portal TopNav）
// - 删除 portal 专属：批次选择器、共建人 UserSelector、预览跳转（/job/landing）、收藏、发布/归档
// - 行业/专业字典、证书库、能力点编辑删除均无 partner 端点：StepBasicInfo 传 showIndustryMajor/certificateLibraryEnabled=false，
//   StepAbilityModeling 注入 abilityPoolSource（学校能力只读）
// - 按 status 控制：draft/rejected 可编辑+提交审核，pending 可编辑+撤回，approved/published/archived 整页只读
import { Suspense, useState, useEffect, use, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { Loader2, Send, Undo2 } from 'lucide-react'
import { StepBasicInfo } from '@/components/job/position-builder/step-basic-info'
import { StepAbilityModeling } from '@/components/job/position-builder/step-ability-modeling'
import { Step3ResultTable } from '@/components/job/position-builder/ai-assisted-2/step3-result-table'
import { StatusBadge } from '@/components/shared/status-badge'
import type { Position } from '@/lib/types/job-source'
import { partnerCobuildPositionApi, partnerCobuildSchoolApi, fileApi } from '@/lib/api'
import type { CoBuildPosition, CoBuildStatus } from '@/lib/api'
import {
  convertCareerPositionToPosition,
  convertApiResponsibilityToLocal,
  convertApiCertificateToLocal,
  convertApiAbilityBindingToLocal,
  convertApiAbilityDomainToLocal,
  convertApiAbilityToLocal,
} from '@/lib/converters/job-converters'
import { toast } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { EditorShell } from '@/components/shared/editor-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

// 可编辑状态：draft/rejected 可编辑+提交审核，pending 可编辑+撤回；其余整页只读（后端同样强制）
const EDITABLE_STATUSES: CoBuildStatus[] = ['draft', 'pending', 'rejected']

// 共建岗位主表：get 端点返回岗位主表字段（tenantId 为学校租户）；详情子表走 list* 端点单独加载
type CoBuildPositionDetail = CoBuildPosition & { tenantId?: string }

interface PageProps {
  params: Promise<{ id: string }>
}

function PartnerPositionEditPageContent({ params }: PageProps) {
  const t = useT()
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = usePartnerAuth()
  const currentUser = user
    ? { id: user.id, name: user.name || user.username || user.id }
    : { id: '', name: '' }
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [schoolTenantId, setSchoolTenantId] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'submit' | 'withdraw' | null>(null)
  const hasSavedRef = useRef(false)
  const isNewPosition = searchParams.get('new') === 'true'

  const readOnly = !!position && !EDITABLE_STATUSES.includes(position.status as CoBuildStatus)

  // 能力点库数据源：学校能力只读列表（partner token 调不通 portal 公共能力库）
  const abilityPoolSource = useMemo(
    () =>
      schoolTenantId
        ? {
            readOnly: true,
            loadAbilities: async () => {
              const res = await partnerCobuildSchoolApi.abilities(schoolTenantId)
              return (res.items || []).map((a) => ({
                id: a.id,
                name: a.name,
                code: a.code,
                description: a.description ?? '',
                attributes: a.attributes || [],
                isPublic: a.isPublic ?? false,
                createdAt: a.createdAt,
              }))
            },
          }
        : undefined,
    [schoolTenantId],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const detail = (await partnerCobuildPositionApi.get(id)) as CoBuildPositionDetail
        if (cancelled) return
        setSchoolTenantId(detail.schoolTenantId || detail.tenantId || '')
        setSchoolName(detail.schoolName || '')
        setPosition(convertCareerPositionToPosition(detail))
      } catch (err: any) {
        if (!cancelled) {
          reportError(err, '加载岗位详情')
          toast({ title: err?.message || t('请稍后重试'), variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  // 详情子表（职责/证书/能力绑定/能力域 + 学校能力点池）单独加载：
  // detailsLoaded 前不应用空默认值，避免"刷新后已保存数据被空草稿覆盖、再 save-full 清空"
  useEffect(() => {
    if (!position || !schoolTenantId || detailsLoaded) return
    let cancelled = false
    ;(async () => {
      setDetailsLoading(true)
      try {
        const [respRes, certRes, bindingRes, domainRes, abilityRes] = await Promise.all([
          partnerCobuildPositionApi.listResponsibilities(position.id),
          partnerCobuildPositionApi.listCertificates(position.id),
          partnerCobuildPositionApi.listAbilityBindings(position.id),
          partnerCobuildPositionApi.listAbilityDomains(position.id),
          partnerCobuildSchoolApi.abilities(schoolTenantId),
        ])
        if (cancelled) {
          setDetailsLoading(false)
          return
        }
        const abilityMap = new Map(abilityRes.items.map((a) => [a.id, convertApiAbilityToLocal(a)]))
        const responsibilities = respRes.items.map(convertApiResponsibilityToLocal)
        const certificates = certRes.items.map(convertApiCertificateToLocal)
        const abilityBindings = bindingRes.items.map((b) => {
          const local = convertApiAbilityBindingToLocal(b)
          // 绑定接口已 JOIN 返回能力点名称；学校能力点列表未命中时补充描述等详情
          const ability = abilityMap.get(b.abilityPointId)
          if (ability) {
            if (!local.name) local.name = ability.name
            if (!local.description) local.description = ability.description
          }
          return local
        })
        const abilityDomains = domainRes.items.map(convertApiAbilityDomainToLocal)
        setPosition((prev) => {
          if (!prev) return null
          const next: Position = {
            ...prev,
            responsibilities,
            certificates,
            abilityBindings,
            abilityDomains,
          }
          if (next.responsibilities.length === 0) {
            next.responsibilities = [{ id: `resp-${Date.now()}`, name: '', description: '' }]
          }
          if (next.requirements.length === 0) {
            next.requirements = ['']
          }
          return next
        })
        setDetailsLoaded(true)
        setDetailsLoading(false)
      } catch (err: any) {
        setDetailsLoading(false)
        if (!cancelled) {
          reportError(err, '加载岗位详情')
          toast({ title: err?.message || t('请稍后重试'), variant: 'destructive' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [position, schoolTenantId, detailsLoaded, t])

  useEffect(() => {
    ;(async () => {
      const stepParam = searchParams.get('step')
      if (stepParam === '2') {
        setActiveStep('ability')
      } else if (stepParam === '3') {
        setActiveStep('competency')
      }
    })()
  }, [searchParams])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!position) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t('岗位不存在')}</p>
      </div>
    )
  }

  const handleSave = async (): Promise<boolean> => {
    if (!position) return false
    setIsSaving(true)
    try {
      const res = await partnerCobuildPositionApi.saveFull(position.id, {
        batchId: position.batchId || '',
        name: position.name,
        shortName: position.shortName,
        industry: position.industry,
        majors: position.majors,
        positionType: position.positionType,
        salaryRange: position.salaryRange,
        coverImage: position.coverImage,
        description: position.description,
        requirements: position.requirements,
        careerPath: position.careerPath,
        version: position.version,
        collaborators: position.collaborators,
        responsibilities: position.responsibilities,
        certificates: position.certificates,
        abilityBindings: position.abilityBindings,
        abilityDomains: position.abilityDomains,
      })
      hasSavedRef.current = true
      if (res.position?.status && res.position.status !== position.status) {
        setPosition((prev) =>
          prev ? { ...prev, status: res.position.status as Position['status'] } : prev,
        )
      }
      toast({ title: t('已保存') })
      return true
    } catch (err: any) {
      reportError(err, '保存岗位')
      toast({ title: err?.message || t('请稍后重试'), variant: 'destructive' })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinish = async () => {
    const ok = await handleSave()
    if (ok) {
      router.push('/partner/co-build/positions')
    }
  }

  const handleTransition = async () => {
    if (!confirmAction || !position) return
    setActing(true)
    try {
      const updated =
        confirmAction === 'submit'
          ? await partnerCobuildPositionApi.submit(position.id)
          : await partnerCobuildPositionApi.withdraw(position.id)
      setPosition((prev) =>
        prev ? { ...prev, status: (updated.status || prev.status) as Position['status'] } : prev,
      )
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
      updatePositionData({ coverImage: res.url })
      toast({ title: t('封面上传成功') })
    } catch (err: any) {
      reportError(err, '上传封面')
      toast({ title: err?.message || t('请稍后重试'), variant: 'destructive' })
    } finally {
      setCoverUploading(false)
    }
  }

  const updatePositionData = (data: Partial<Position>) => {
    setPosition((prev) => (prev ? { ...prev, ...data } : null))
  }

  const steps = [
    { id: 'basic', label: t('基础信息'), description: t('填写岗位基本信息') },
    { id: 'ability', label: t('能力建模'), description: t('构建能力图谱') },
    { id: 'competency', label: t('能力模型汇总'), description: t('设置达标要求') },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === activeStep)
  const currentStep = steps[currentStepIndex]

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) setActiveStep(steps[nextIndex].id)
  }

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setActiveStep(steps[prevIndex].id)
  }

  const canGoNext = currentStepIndex < steps.length - 1
  const canGoPrev = currentStepIndex > 0

  return (
    <EditorShell
      mode="inline"
      backText={t('返回')}
      onBack={async () => {
        if (isNewPosition && !hasSavedRef.current) {
          try {
            await partnerCobuildPositionApi.delete(position.id)
          } catch (err) {
            reportError(err, '删除未保存的岗位草稿')
          }
        }
        router.push('/partner/co-build/positions')
      }}
      step={currentStepIndex + 1}
      stepLabel={currentStep.label}
      onSaveDraft={readOnly ? undefined : handleSave}
      isSaving={isSaving}
      saveText={t('保存')}
      // 详情子表未加载完禁止保存：避免刷新后在空详情状态下 save-full 清空已保存数据
      saveDisabled={!detailsLoaded}
      onPrev={!readOnly && canGoPrev ? handlePrev : undefined}
      onNext={!readOnly && canGoNext ? handleNext : undefined}
      onSubmit={!readOnly && !canGoNext ? handleFinish : undefined}
      submitText={t('完成配置')}
      submitDisabled={!detailsLoaded}
      loadingText={detailsLoading ? t('加载详情中') : undefined}
      title={position.name}
    >
      <fieldset disabled={readOnly} className="contents">
        {activeStep === 'basic' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <StepBasicInfo
                position={position}
                onUpdate={updatePositionData}
                showIndustryMajor={false}
                certificateLibraryEnabled={false}
              />
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <CoverImageUpload
                    imageUrl={position.coverImage || ''}
                    uploading={coverUploading}
                    label={t('岗位封面')}
                    alt={t('岗位封面')}
                    onUpload={handleCoverUpload}
                    onRemove={() => updatePositionData({ coverImage: '' })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label className="text-gray-500 text-xs">{t('当前状态')}</Label>
                    <div className="mt-1">
                      <StatusBadge status={position.status} />
                    </div>
                  </div>
                  {schoolName && (
                    <div>
                      <Label className="text-gray-500 text-xs">{t('合作学校')}</Label>
                      <p className="font-medium text-gray-800 mt-1">{schoolName}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-500 text-xs">{t('创建人')}</Label>
                    <p className="font-medium text-gray-800 mt-1">{currentUser.name}</p>
                  </div>
                  <div className="pt-3 border-t border-gray-100">
                    <Label className="text-gray-500 text-xs">{t('当前版本号')}</Label>
                    <p className="font-medium text-gray-800 mt-1">{position.version}</p>
                  </div>
                  {(position.status === 'draft' || position.status === 'rejected') && (
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
                  {position.status === 'pending' && (
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
        ) : (
          <div className="space-y-6">
            {activeStep === 'ability' && (
              <StepAbilityModeling
                position={position}
                onUpdate={updatePositionData}
                abilityPoolSource={abilityPoolSource}
              />
            )}
            {activeStep === 'competency' && (
              <Step3ResultTable position={position} onUpdate={updatePositionData} />
            )}
          </div>
        )}
      </fieldset>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction === 'submit' ? t('提交审核') : t('撤回审核')}
        description={
          confirmAction === 'submit'
            ? t('提交后由合作学校审批，审批期间可撤回。确认提交？')
            : t('撤回后岗位将退回草稿状态，可继续编辑。确认撤回？')
        }
        confirmText={confirmAction === 'submit' ? t('确认提交') : t('确认撤回')}
        cancelText={t('取消')}
        onConfirm={handleTransition}
      />
    </EditorShell>
  )
}

export default function PartnerPositionEditPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PartnerPositionEditPageContent {...props} />
    </Suspense>
  )
}
