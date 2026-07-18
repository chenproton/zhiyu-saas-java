'use client'

import { Suspense, useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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
import { X, Save, Eye, ArrowRight, ArrowLeft, Check, ImagePlus } from 'lucide-react'
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
import { positionApi, batchApi, approvalApi, majorApi, abilityApi, positionResponsibilityApi, positionCertificateApi } from '@/lib/api'
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
import { useAuth } from '@/components/auth-provider'




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
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

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
    if (!position || position.responsibilities.length > 0 || position.certificates.length > 0 || position.abilityBindings.length > 0) return
    let cancelled = false
    Promise.all([
      positionResponsibilityApi.list({ careerPositionId: position.id, limit: 1000 }),
      positionCertificateApi.list({ careerPositionId: position.id, limit: 1000 }),
      abilityApi.listBindings({ careerPositionId: position.id }),
      abilityApi.listDomains(position.id),
      abilityApi.list({ limit: 1000 }),
    ])
      .then(([respRes, certRes, bindingRes, domainRes, abilityRes]) => {
        if (cancelled) return
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
        setPosition((prev) => (prev ? { ...prev, responsibilities, certificates, abilityBindings, abilityDomains } : null))
      })
      .catch((err: any) => {
        if (!cancelled) {
          console.error('Failed to load position details:', err)
          toast({ variant: 'destructive', title: '加载详情失败', description: err?.message || '请稍后重试' })
        }
      })
    return () => { cancelled = true }
  }, [position, toast])

  useEffect(() => {
    const stepParam = searchParams.get('step')
    if (stepParam === '2') {
      setActiveStep('ability')
    } else if (stepParam === '3') {
      setActiveStep('competency')
    }
  }, [searchParams])

  useEffect(() => {
    majorApi.list({ limit: 1000 }).then((res) => {
      const map = new Map<string, string>()
      res.items.forEach((m) => map.set(m.id, m.name))
      setMajorMap(map)
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
      setPositions((prev) => prev.map((p) => (p.id === position.id ? { ...position } : p)))
      toast({ title: '保存成功', description: '岗位完整数据已保存' })
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
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/job/positions')}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">
                步骤 {currentStepIndex + 1}
              </Badge>
              <span className="text-sm font-medium text-gray-800">{currentStep.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? '保存中...' : '保存草稿'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open('/student.html', '_blank')}>
              <Eye className="mr-2 h-4 w-4" />
              预览
            </Button>
            {canGoPrev && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                上一步
              </Button>
            )}
            {canGoNext ? (
              <Button size="sm" onClick={handleNext}>
                下一步
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              position.status === 'draft' && (
                <Button size="sm" onClick={handleSubmit}>
                  <Check className="mr-2 h-4 w-4" />
                  提交审批
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">{position.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {batch?.department} - {majorMap.get(batch?.majorId || "") || batch?.major || batch?.majorId} | 版本 {position.version}
          </p>
        </div>

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
                    onClick={() => !position.coverImage && updatePositionData({ coverImage: '/placeholder.svg?height=200&width=300' })}
                  >
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
                              updatePositionData({ coverImage: '/placeholder.svg?height=200&width=300' })
                            }}
                          >
                            更换封面
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/90 text-gray-800 border-white hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              updatePositionData({ coverImage: '' })
                            }}
                          >
                            移除封面
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <ImagePlus className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">点击设置封面图片</p>
                        <p className="text-xs text-gray-400 mt-1">建议尺寸 320x200</p>
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
                onSave={handleSave}
                showAiFill={false}
              />
            )}
          </div>
        )}
      </div>

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
                <p className="font-medium text-sm">{position.industry || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">适用专业</p>
                <p className="font-medium text-sm">{position.majors.join('、') || '-'}</p>
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
    </div>
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
