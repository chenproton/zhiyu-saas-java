'use client'

import { Suspense, useState, useEffect, use, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { Loader2 } from 'lucide-react'
import { StepBasicInfo } from '@/components/job/position-builder/step-basic-info'
import { StepAbilityModeling } from '@/components/job/position-builder/step-ability-modeling'
import { Step3ResultTable } from '@/components/job/position-builder/ai-assisted-2/step3-result-table'
import { UserSelector } from '@/components/shared/user-selector'
import type { Position } from '@/lib/types/job-source'
import {
  positionApi,
  batchApi,
  abilityApi,
  positionResponsibilityApi,
  positionCertificateApi,
  fileApi,
} from '@/lib/api'
import { fetchAllPages } from '@/lib/fetch-all'
import {
  convertCareerPositionToPosition,
  convertApiResponsibilityToLocal,
  convertApiCertificateToLocal,
  convertApiAbilityBindingToLocal,
  convertApiAbilityDomainToLocal,
  convertApiAbilityToLocal,
} from '@/lib/converters/job-converters'
import { toast } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import { EditorShell } from '@/components/shared/editor-shell'
import { BatchSelector } from '@/components/shared/batch-selector'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

interface PageProps {
  params: Promise<{ id: string }>
}

function PositionEditPageContent({ params }: PageProps) {
  const t = useT()
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, tenantId } = useAuth()
  const currentUser = user
    ? { id: user.id, name: user.name || user.username || user.id }
    : { id: '', name: '' }
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [isPreviewConfirmOpen, setIsPreviewConfirmOpen] = useState(false)
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const hasSavedRef = useRef(false)
  const isNewPosition = searchParams.get('new') === 'true'

  const collaboratorIds = useMemo(
    () => position?.collaborators.filter((id) => id !== position.createdBy) || [],
    [position],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const posList = await fetchAllPages((page, pageSize) =>
          positionApi.list({ limit: pageSize, offset: page * pageSize }),
        )
        if (cancelled) return
        setPositions(posList.map(convertCareerPositionToPosition))
      } catch (err: any) {
        if (!cancelled) toast({ title: err?.message || t('请稍后重试'), variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    ;(async () => {
      const found = positions.find((p) => p.id === id)
      if (found && !position) {
        setPosition({ ...found })
      }
    })()
  }, [id, positions, position])

  useEffect(() => {
    if (!position || detailsLoaded) return
    let cancelled = false
    ;(async () => {
      setDetailsLoading(true)
      try {
        const [respRes, certRes, bindingRes, domainRes, abilityRes] = await Promise.all([
          positionResponsibilityApi.list({ careerPositionId: position.id, limit: 1000 }),
          positionCertificateApi.list({ careerPositionId: position.id, limit: 1000 }),
          abilityApi.listBindings({ careerPositionId: position.id }),
          abilityApi.listDomains(position.id),
          abilityApi.list({ limit: 1000 }),
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
          // 绑定接口已 JOIN 返回能力点名称；列表未命中时补充描述等详情
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
  }, [position, detailsLoaded, t])

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
      await positionApi.saveFull(position.id, {
        batchId: position.batchId,
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
      if (position.status !== 'draft') {
        await positionApi.saveDraft(position.id)
      }
      hasSavedRef.current = true
      const savedPosition = { ...position, status: 'draft' as const }
      setPosition(savedPosition)
      setPositions((prev) => prev.map((p) => (p.id === position.id ? savedPosition : p)))
      toast({ title: t('草稿已保存') })
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
      router.push('/job/positions')
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
      mode="fullscreen"
      backText={t('取消')}
      onBack={async () => {
        if (isNewPosition && !hasSavedRef.current) {
          try {
            await positionApi.delete(position.id)
          } catch (err) {
            reportError(err, '删除未保存的岗位草稿')
          }
        }
        router.push('/job/positions')
      }}
      step={currentStepIndex + 1}
      stepLabel={currentStep.label}
      onSaveDraft={handleSave}
      isSaving={isSaving}
      onPreview={() => setIsPreviewConfirmOpen(true)}
      onPrev={canGoPrev ? handlePrev : undefined}
      onNext={canGoNext ? handleNext : undefined}
      onSubmit={!canGoNext ? handleFinish : undefined}
      submitText={t('完成配置')}
      loadingText={detailsLoading ? t('加载详情中') : undefined}
      title={position.name}
    >
      {activeStep === 'basic' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StepBasicInfo position={position} onUpdate={updatePositionData} />
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
                <BatchSelector
                  value={position.batchId || ''}
                  onChange={(v) => updatePositionData({ batchId: v })}
                  batchApi={batchApi}
                  emptyLabel={t('未选择批次')}
                />
                <div>
                  <Label className="text-gray-500 text-xs">{t('创建人')}</Label>
                  <p className="font-medium text-gray-800 mt-1">{currentUser.name}</p>
                </div>

                <div>
                  <Label className="text-gray-500 text-xs">{t('共建人')}</Label>
                  <UserSelector
                    value={collaboratorIds}
                    onChange={(ids) =>
                      updatePositionData({
                        collaborators: ids.filter((id) => id !== position.createdBy),
                      })
                    }
                    multiple
                    placeholder={t('点击选择共建人')}
                    tenantId={tenantId}
                    excludeUserIds={position.createdBy ? [position.createdBy] : undefined}
                  />
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <Label className="text-gray-500 text-xs">{t('当前版本号')}</Label>
                  <p className="font-medium text-gray-800 mt-1">{position.version}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {activeStep === 'ability' && (
            <StepAbilityModeling position={position} onUpdate={updatePositionData} />
          )}
          {activeStep === 'competency' && (
            <Step3ResultTable position={position} onUpdate={updatePositionData} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={isPreviewConfirmOpen}
        onOpenChange={setIsPreviewConfirmOpen}
        title={t('即将离开当前页面')}
        description={t('请确认是否已经保存数据')}
        confirmText={t('跳转预览')}
        cancelText={t('取消')}
        onConfirm={() => router.push(`/job/landing/${id}`)}
      />
    </EditorShell>
  )
}

export default function PositionEditPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PositionEditPageContent {...props} />
    </Suspense>
  )
}
