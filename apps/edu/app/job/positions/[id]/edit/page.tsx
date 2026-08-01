'use client'

import { Suspense, useState, useEffect, use, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { StepBasicInfo } from '@/components/job/position-builder/step-basic-info'
import { StepAbilityModeling } from '@/components/job/position-builder/step-ability-modeling'
import { Step3ResultTable } from '@/components/job/position-builder/ai-assisted-2/step3-result-table'
import { UserSelector } from '@/components/shared/user-selector'
import type { Position, Batch } from '@/lib/types/job-source'
import { positionApi, batchApi, majorApi, industryApi, abilityApi, positionResponsibilityApi, positionCertificateApi, fileApi } from '@/lib/api'
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
  convertApiResponsibilityToLocal,
  convertApiCertificateToLocal,
  convertApiAbilityBindingToLocal,
  convertApiAbilityDomainToLocal,
  convertApiAbilityToLocal,
} from '@/lib/converters/job-converters'
import { toast } from "@zhiyu/ui"
import { useAuth } from '@/components/auth-provider'
import { EditorShell } from '@/components/shared/editor-shell'
import { BatchSelector } from '@/components/shared/batch-selector'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'




interface PageProps {
  params: Promise<{ id: string }>
}

function PositionEditPageContent({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, tenantId } = useAuth()
  const currentUser = user ? { id: user.id, name: user.name || user.username || user.id } : { id: '', name: '' }
  const [positions, setPositions] = useState<Position[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [majorMap, setMajorMap] = useState<Map<string, string>>(new Map())
  const [industryMap, setIndustryMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPreviewConfirmOpen, setIsPreviewConfirmOpen] = useState(false)
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
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
        const [posRes, batchRes] = await Promise.all([
          positionApi.list({ limit: 1000 }),
          batchApi.list({ limit: 1000 }),
        ])
        if (cancelled) return
        const posList = posRes.items.map(convertCareerPositionToPosition)
        setPositions(posList)
        setBatches(batchRes.items.map(convertJobBatchToBatch))
      } catch (err: any) {
        if (!cancelled) toast({ title: err?.message || '请稍后重试', variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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
          const ability = abilityMap.get(b.abilityPointId)
          if (ability) {
            local.name = ability.name
            local.category = ability.category
            local.description = ability.description
          } else if (b.source === 'custom') {
            // Try to fetch custom ability details if not in public list
          }
          return local
        })
        const abilityDomains = domainRes.items.map(convertApiAbilityDomainToLocal)
        setPosition((prev) => {
          if (!prev) return null
          const next: Position = { ...prev, responsibilities, certificates, abilityBindings, abilityDomains }
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
          console.error('Failed to load position details:', err)
          toast({ title: err?.message || '请稍后重试', variant: "destructive" })
        }
      }
    })()
    return () => { cancelled = true }
  }, [position, detailsLoaded])

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

  useEffect(() => {
    Promise.all([
      majorApi.list({ limit: 1000 }),
      industryApi.list({ limit: 1000 }),
    ]).then(([majorRes, industryRes]) => {
      const majorMap = new Map<string, string>()
      majorRes.items.forEach((m) => majorMap.set(m.id, m.name))
      setMajorMap(majorMap)
      const industryMap = new Map<string, string>()
      industryRes.items.forEach((i) => industryMap.set(i.id, i.name))
      setIndustryMap(industryMap)
    }).catch(() => {})
  }, [])

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
        <p className="text-muted-foreground">岗位不存在</p>
      </div>
    )
  }

  const batch = batches.find((b) => b.id === position.batchId)

  const handleSave = async () => {
    if (!position) return
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
      toast({ title: '草稿已保存' })
    } catch (err: any) {
      console.error('Save position failed:', err)
      toast({ title: err?.message || '请稍后重试', variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinish = async () => {
    await handleSave()
    router.push('/job/positions')
  }

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      updatePositionData({ coverImage: res.url })
      toast({ title: '封面上传成功' })
    } catch (err: any) {
      console.error('Cover upload failed:', err)
      toast({ title: err?.message || '请稍后重试', variant: "destructive" })
    } finally {
      setCoverUploading(false)
    }
  }

  const triggerCoverUpload = () => {
    coverInputRef.current?.click()
  }

  const updatePositionData = (data: Partial<Position>) => {
    setPosition((prev) => (prev ? { ...prev, ...data } : null))
  }

  const steps = [
    { id: 'basic', label: '基础信息', description: '填写岗位基本信息' },
    { id: 'ability', label: '能力建模', description: '构建能力图谱' },
    { id: 'competency', label: '能力模型汇总', description: '设置达标要求' },
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
      backText="取消"
      onBack={async () => {
        if (isNewPosition && !hasSavedRef.current) {
          try { await positionApi.delete(position.id) } catch {}
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
      submitText="完成配置"
      loadingText={detailsLoading ? "加载详情中" : undefined}
      title={position.name}
    >
      {activeStep === 'basic' ? (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <StepBasicInfo position={position} onUpdate={updatePositionData} />
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <CoverImageUpload
                    imageUrl={position.coverImage || ""}
                    uploading={coverUploading}
                    label="岗位封面"
                    alt="岗位封面"
                    onUpload={handleCoverUpload}
                    onRemove={() => updatePositionData({ coverImage: "" })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <BatchSelector
                    value={position.batchId || ''}
                    onChange={(v) => updatePositionData({ batchId: v })}
                    batchApi={batchApi}
                    emptyLabel="未选择批次"
                  />
                  <div>
                    <Label className="text-gray-500 text-xs">创建人</Label>
                    <p className="font-medium text-gray-800 mt-1">{currentUser.name}</p>
                  </div>

                  <div>
                    <Label className="text-gray-500 text-xs">共建人</Label>
                    <UserSelector
                      value={collaboratorIds}
                      onChange={(ids) => updatePositionData({ collaborators: ids.filter((id) => id !== position.createdBy) })}
                      multiple
                      placeholder="点击选择共建人"
                      tenantId={tenantId}
                      excludeUserIds={position.createdBy ? [position.createdBy] : undefined}
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <Label className="text-gray-500 text-xs">当前版本号</Label>
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
              <Step3ResultTable
                position={position}
                onUpdate={updatePositionData}
                onPrev={handlePrev}
                showAiFill={false}
              />
            )}
          </div>
        )}

      <ConfirmDialog
        open={isPreviewConfirmOpen}
        onOpenChange={setIsPreviewConfirmOpen}
        title="即将离开当前页面"
        description="请确认是否已经保存数据"
        confirmText="跳转预览"
        cancelText="取消"
        onConfirm={() => router.push(`/job/student/${id}`)}
      />
    </EditorShell>
  )
}


export default function PositionEditPage(props: PageProps) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PositionEditPageContent {...props} />
    </Suspense>
  )
}
