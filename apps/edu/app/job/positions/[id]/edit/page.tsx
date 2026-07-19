'use client'

import { Suspense, useState, useEffect, use, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ImagePlus } from 'lucide-react'
import { StepBasicInfo } from '@/components/job/position-builder/step-basic-info'
import { StepAbilityModeling } from '@/components/job/position-builder/step-ability-modeling'
import { Step3ResultTable } from '@/components/job/position-builder/ai-assisted-2/step3-result-table'
import { CoBuilderSelector } from '@/components/job/position-builder/co-builder-selector'
import type { Position, Batch } from '@/lib/types/job-source'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { positionApi, batchApi, approvalApi, majorApi, industryApi, abilityApi, positionResponsibilityApi, positionCertificateApi, fileApi } from '@/lib/api'
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
  convertApiResponsibilityToLocal,
  convertApiCertificateToLocal,
  convertApiAbilityBindingToLocal,
  convertApiAbilityDomainToLocal,
  convertApiAbilityToLocal,
} from '@/lib/stores/job-converters'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/components/auth-provider'
import { EditorShell } from '@/components/shared/editor-shell'




interface PageProps {
  params: Promise<{ id: string }>
}

function PositionEditPageContent({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuth()
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
  const [detailsLoaded, setDetailsLoaded] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const hasSavedRef = useRef(false)
  const isNewPosition = searchParams.get('new') === 'true'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      positionApi.list({ limit: 1000 }),
      batchApi.list({ limit: 1000 }),
    ])
      .then(([posRes, batchRes]) => {
        if (cancelled) return
        const posList = posRes.items.map(convertCareerPositionToPosition)
        setPositions(posList)
        setBatches(batchRes.items.map(convertJobBatchToBatch))
      })
      .catch((err: any) => {
        if (!cancelled) toast({ variant: 'destructive', title: '加载失败', description: err?.message || '请稍后重试' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [toast])

  useEffect(() => {
    const found = positions.find((p) => p.id === id)
    if (found && !position) {
      setPosition({ ...found })
    }
  }, [id, positions, position])

  useEffect(() => {
    if (!position || detailsLoaded) return
    setDetailsLoading(true)
    let cancelled = false
    Promise.all([
      positionResponsibilityApi.list({ careerPositionId: position.id, limit: 1000 }),
      positionCertificateApi.list({ careerPositionId: position.id, limit: 1000 }),
      abilityApi.listBindings({ careerPositionId: position.id }),
      abilityApi.listDomains(position.id),
      abilityApi.list({ limit: 1000 }),
    ])
      .then(([respRes, certRes, bindingRes, domainRes, abilityRes]) => {
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
      })
      .catch((err: any) => {
        setDetailsLoading(false)
        if (!cancelled) {
          console.error('Failed to load position details:', err)
          toast({ variant: 'destructive', title: '加载详情失败', description: err?.message || '请稍后重试' })
        }
      })
    return () => { cancelled = true }
  }, [position, detailsLoaded, toast])

  useEffect(() => {
    const stepParam = searchParams.get('step')
    if (stepParam === '2') {
      setActiveStep('ability')
    } else if (stepParam === '3') {
      setActiveStep('competency')
    }
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
      if (position.status === 'approved' || position.status === 'published') {
        await positionApi.saveDraft(position.id)
      }
      hasSavedRef.current = true
      setPositions((prev) => prev.map((p) => (p.id === position.id ? { ...position, status: 'draft' as const } : p)))
      toast({ title: '保存成功', description: '岗位完整数据已保存为草稿' })
    } catch (err: any) {
      console.error('Save position failed:', err)
      toast({ variant: 'destructive', title: '保存失败', description: err?.message || '请稍后重试' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!batch || !position) {
      toast({ variant: 'destructive', title: '无法提交', description: '该岗位未关联批次，无法提交审批' })
      return
    }
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
      await positionApi.submit(position.id)
      hasSavedRef.current = true
      await approvalApi.create({
        targetType: 'career_position',
        targetId: position.id,
        workflowId: batch.workflowId,
      } as any)
      router.push('/job/positions')
    } catch (err: any) {
      console.error('Submit position failed:', err)
      toast({ variant: 'destructive', title: '提交失败', description: err?.message || '请稍后重试' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      updatePositionData({ coverImage: res.url })
      toast({ title: '封面上传成功' })
    } catch (err: any) {
      console.error('Cover upload failed:', err)
      toast({ variant: 'destructive', title: '封面上传失败', description: err?.message || '请稍后重试' })
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
    { id: 'competency', label: '胜任力配置', description: '设置达标要求' },
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
      onPreview={() => window.open('/student.html', '_blank')}
      onPrev={canGoPrev ? handlePrev : undefined}
      onNext={canGoNext ? handleNext : undefined}
      onSubmit={(!canGoNext && position.status === 'draft') ? handleSubmit : undefined}
      loadingText={detailsLoading ? "加载详情中" : undefined}
      title={position.name}
      subtitle={`${batch?.department} - ${majorMap.get(batch?.majorId || "") || batch?.major || batch?.majorId} | 版本 ${position.version}`}
    >
      {activeStep === 'basic' ? (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <StepBasicInfo position={position} onUpdate={updatePositionData} />
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <Label className="mb-3 block">岗位封面</Label>
                  <div
                    className="aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative group"
                    onClick={triggerCoverUpload}
                  >
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleCoverUpload(file)
                        e.target.value = ''
                      }}
                    />
                    {position.coverImage ? (
                      <>
                        <img
                          src={position.coverImage}
                          alt="岗位封面"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/90 text-gray-800 border-white hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              triggerCoverUpload()
                            }}
                            disabled={coverUploading}
                          >
                            {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '更换封面'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/90 text-gray-800 border-white hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              updatePositionData({ coverImage: '' })
                            }}
                            disabled={coverUploading}
                          >
                            移除封面
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        {coverUploading ? (
                          <Loader2 className="h-8 w-8 text-gray-400 mb-2 animate-spin" />
                        ) : (
                          <ImagePlus className="h-8 w-8 text-gray-400 mb-2" />
                        )}
                        <p className="text-sm text-gray-500">{coverUploading ? '上传中...' : '点击上传封面图片'}</p>
                        <p className="text-xs text-gray-400 mt-1">建议尺寸 320x200，支持 jpg/png/webp</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label className="text-gray-500 text-xs">所属批次</Label>
                    <div className="mt-1">
                      <Select
                        value={position.batchId || '__none__'}
                        onValueChange={(v) => updatePositionData({ batchId: v === '__none__' ? '' : v })}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="选择批次" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">未选择批次</SelectItem>
                          {batches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-500 text-xs">创建人</Label>
                    <p className="font-medium text-gray-800 mt-1">{currentUser.name}</p>
                  </div>

                  <div>
                    <Label className="text-gray-500 text-xs">共建人</Label>
                    <CoBuilderSelector
                      selectedIds={position.collaborators}
                      onChange={(ids) => updatePositionData({ collaborators: ids })}
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

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>岗位信息预览</DialogTitle>
            <DialogDescription>预览当前填写的岗位信息</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">岗位名称</p>
                <p className="font-medium text-sm">{position.name}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">所属批次</p>
                <p className="font-medium text-sm">{batch?.name || '未关联'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">面向行业</p>
                <p className="font-medium text-sm">{industryMap.get(position.industry) || position.industry || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">适用专业</p>
                <p className="font-medium text-sm">{position.majors.map((id) => majorMap.get(id) || id).join('、') || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">薪资范围</p>
                <p className="font-medium text-sm">{position.salaryRange[0]} - {position.salaryRange[1]}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">当前版本</p>
                <p className="font-medium text-sm">{position.version}</p>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">岗位描述</p>
              <p className="text-sm">{position.description || '暂无描述'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">工作职责 ({position.responsibilities.length})</p>
              <ul className="text-sm space-y-1 mt-1">
                {position.responsibilities.map((r) => (
                  <li key={r.id}>• {r.name}</li>
                ))}
              </ul>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">能力绑定 ({position.abilityBindings.length})</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {position.abilityBindings.map((b) => (
                  <Badge key={b.id} variant="secondary" className="text-xs">{b.name}</Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
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
