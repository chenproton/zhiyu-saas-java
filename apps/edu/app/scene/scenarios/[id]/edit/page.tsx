'use client'

import { Star, X } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import { MultiSelect } from '@/components/ui/multi-select'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { cn } from '@/lib/utils'
import {
  positionApi,
  industryApi,
  sceneBatchApi,
  userManagementApi,
  scenarioApi,
  fileApi,
  majorApi,
} from '@/lib/api'
import type { User } from '@/lib/api'
import type { CareerPosition } from '@/lib/types/job'
import type { Industry, Major } from '@/lib/types/backend'
import type { SceneBatch } from '@/lib/types/scene'
import { toast } from '@zhiyu/ui'
import { useAuth } from '@/components/auth-provider'
import { UserSelector } from '@/components/shared/user-selector'
import { EditorShell } from '@/components/shared/editor-shell'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { reportError } from '@/lib/error-handling'

export default function ScenarioEditPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scenarioId = params.id as string
  const hasSavedRef = useRef(false)
  const isNewScenario = searchParams.get('new') === 'true'
  const { tenantId } = useAuth()

  const [allPositions, setAllPositions] = useState<CareerPosition[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [batches, setBatches] = useState<SceneBatch[]>([])
  const [, setUsers] = useState<User[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [scenarioName, setScenarioName] = useState('')
  const [positionId, setPositionId] = useState('')
  const [professionIds, setProfessionIds] = useState<string[]>([])
  const [batchId, setBatchId] = useState('')
  const [industryIds, setIndustryIds] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<number>(3)
  const [background, setBackground] = useState('')
  const [creatorName] = useState('当前用户')
  const [creatorId, setCreatorId] = useState<string>('')
  const [coBuilderIds, setCoBuilderIds] = useState<string[]>([])
  const [version, setVersion] = useState('v1.0')
  const [coverImage, setCoverImage] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [scenarioStatus, setScenarioStatus] = useState<string>('draft')

  const [isPreviewConfirmOpen, setIsPreviewConfirmOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true)
      try {
        const [posRes, indRes, batchRes, userRes, majRes, scenario] = await Promise.all([
          positionApi.list({ limit: 1000 }),
          industryApi.list({ limit: 1000 }),
          sceneBatchApi.list({ limit: 1000 }),
          userManagementApi.list({ limit: 1000 }),
          majorApi.list({ limit: 1000 }),
          scenarioApi.get(scenarioId),
        ])
        setAllPositions(posRes.items)
        setIndustries(indRes.items)
        setBatches(batchRes.items)
        setUsers(userRes.items)
        setMajors(majRes.items.filter((m) => m.enabled))

        setScenarioName(scenario.name || '')
        setPositionId(scenario.careerPositionId || '')
        setProfessionIds(scenario.professionIds || [])
        setBatchId(scenario.batchId || '')
        setIndustryIds(scenario.industryIds || [])
        setDifficulty(scenario.difficulty || 3)
        setBackground(scenario.background || '')
        setCreatorId(scenario.creatorId || '')
        setCoBuilderIds((scenario.coBuilderIds || []).filter((id) => id !== scenario.creatorId))
        setVersion(scenario.version || 'v1.0')
        setCoverImage(scenario.coverImage || '')
        setScenarioStatus(scenario.status || 'draft')
      } catch (err: any) {
        reportError(err, '加载场景表单数据')
        toast({ title: err.message || '请刷新页面重试', variant: 'destructive' })
      } finally {
        setDataLoading(false)
      }
    }
    loadData()
  }, [scenarioId])

  const positioningGroups = useMemo(() => {
    const groups: Record<string, CareerPosition[]> = {}
    allPositions.forEach((p) => {
      const key = industries.find((i) => i.id === p.industryId)?.name || '其他'
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return groups
  }, [allPositions, industries])

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
      toast({ title: '保存成功' })
      router.push(`/scene/scenarios/${scenarioId}/edit/tasks`)
    } catch (err: any) {
      toast({ title: err.message || '请稍后重试', variant: 'destructive' })
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
      toast({ title: '草稿已保存' })
    } catch (err: any) {
      toast({ title: err.message || '请稍后重试', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      setCoverImage(res.url)
      toast({ title: '封面上传成功' })
    } catch (err: any) {
      reportError(err, '上传封面')
      toast({ title: err?.message || '请稍后重试', variant: 'destructive' })
    } finally {
      setCoverUploading(false)
    }
  }

  return (
    <EditorShell
      mode="fullscreen"
      backText="取消"
      onBack={async () => {
        if (isNewScenario && !hasSavedRef.current) {
          try {
            await scenarioApi.delete(scenarioId)
          } catch (err) {
            reportError(err, '删除未保存的场景草稿')
          }
        }
        router.push('/scene')
      }}
      step={1}
      stepLabel="基础信息编辑"
      onSaveDraft={handleSaveDraft}
      isSaving={isSaving}
      saveDisabled={!scenarioName}
      onPreview={() => setIsPreviewConfirmOpen(true)}
      onNext={handleProceed}
      nextText={isSaving ? '保存中...' : '下一步'}
      nextDisabled={!scenarioName}
      title="编辑实践场景"
      subtitle="填写场景基础信息，完成后进入任务链配置"
    >
      {dataLoading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardContent className="pt-6 space-y-5">
                <FormFieldRow label="场景名称" required htmlFor="name">
                  <Input
                    id="name"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="请输入场景名称"
                  />
                </FormFieldRow>

                <FormFieldGrid cols={2}>
                  <FormFieldRow label="面向行业">
                    <MultiSelect
                      options={industries.map((i) => ({ label: i.name, value: i.id }))}
                      value={industryIds}
                      onChange={setIndustryIds}
                      placeholder="选择行业"
                    />
                  </FormFieldRow>
                  <FormFieldRow label="适用专业">
                    <MultiSelect
                      options={majors.map((m) => ({
                        label: `${m.name}${m.code ? ` (${m.code})` : ''}`,
                        value: m.id,
                      }))}
                      value={professionIds}
                      onChange={setProfessionIds}
                      placeholder="选择适用专业"
                    />
                  </FormFieldRow>
                </FormFieldGrid>

                <div className="grid gap-2">
                  <Label>难度等级</Label>
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
                      {difficulty === 1 && '入门'}
                      {difficulty === 2 && '基础'}
                      {difficulty === 3 && '中级'}
                      {difficulty === 4 && '高级'}
                      {difficulty === 5 && '专家'}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="background" className="block">
                    场景介绍
                  </Label>
                  <div className="border rounded-lg">
                    <Textarea
                      id="background"
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      placeholder="描述该场景的背景、意义和学习目标..."
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
                  label="场景封面"
                  alt="场景封面"
                  onUpload={handleCoverUpload}
                  onRemove={() => setCoverImage('')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="position" className="block">
                    目标岗位
                  </Label>
                  <div className="relative">
                    <Select value={positionId} onValueChange={setPositionId}>
                      <SelectTrigger id="position" className={positionId ? 'pr-8' : ''}>
                        <SelectValue placeholder="请选择岗位" />
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
                    所属批次
                  </Label>
                  <div className="relative">
                    <Select value={batchId} onValueChange={setBatchId}>
                      <SelectTrigger id="batch" className={batchId ? 'pr-8' : ''}>
                        <SelectValue placeholder="请选择批次" />
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
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="block text-gray-500 text-xs">创建人</Label>
                  <p className="font-medium text-gray-800 mt-1">{creatorName}</p>
                </div>

                <div>
                  <Label className="block mb-2">共建人/共建部门</Label>
                  <UserSelector
                    value={coBuilderIds}
                    onChange={(ids) => setCoBuilderIds(ids.filter((id) => id !== creatorId))}
                    multiple
                    placeholder="点击选择共建人"
                    tenantId={tenantId}
                    excludeUserIds={creatorId ? [creatorId] : undefined}
                  />
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <Label className="block text-gray-500 text-xs">当前版本号</Label>
                  <p className="font-medium text-gray-800 mt-1">{version}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={isPreviewConfirmOpen}
        onOpenChange={setIsPreviewConfirmOpen}
        title="即将离开当前页面"
        description="请确认是否已经保存数据"
        confirmText="跳转预览"
        cancelText="取消"
        onConfirm={() => router.push(`/scene/landing/${scenarioId}`)}
      />
    </EditorShell>
  )
}
