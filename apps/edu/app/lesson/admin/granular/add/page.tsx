'use client'

import { useEffect, useState, useRef, Suspense, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BookOpen, GraduationCap, Plus, X } from 'lucide-react'
import { toast } from '@zhiyu/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { MajorSelect } from '@/components/shared/major-select'

import type { SystemCourseNode, NodeResource } from '@/lib/types/lesson-source'
import type { Course, KnowledgePointItem } from '@/lib/types/lesson'
import {
  courseApi,
  knowledgeApi,
  fileApi,
  lessonBatchApi,
  courseResourceApi,
  resourceLibraryApi,
} from '@/lib/api'

import { KnowledgeSelector } from '../../_components/knowledge/knowledge-selector'
import { ResourceSelector, type ResourceItem } from '../../_components/resources/resource-selector'
import { TaskInfoCard } from '@/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card'
import { RichTextEditor } from '../../_components/common/rich-text-editor'
import PublishCheckPanel from '../../system/add/_components/PublishCheckPanel'
import { EditorShell } from '@/components/shared/editor-shell'
import { BatchSelector } from '@/components/shared/batch-selector'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { usePreviewResources } from '@/components/shared/resource-preview-modal'
import { reportError } from '@/lib/error-handling'

function AddGranularPageInner() {
  // 组件内状态，避免模块级单例在多个编辑会话间串数据
  const [customKnowledgePointIds, setCustomKnowledgePointIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [courseResourcePool, setCourseResourcePool] = useState<ResourceItem[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const hasSavedRef = useRef(false)
  const isNewCourse = searchParams.get('new') === 'true'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [course, setCourse] = useState<Course | null>(null)

  /* module 1: basic info */
  const [courseName, setCourseName] = useState('')
  const [hours, setHours] = useState('')
  const [learningGoal, setLearningGoal] = useState('')
  const [detailedDescription] = useState('')
  const [background] = useState('')
  const [learningGoalPdf, setLearningGoalPdf] = useState<string | null>(null)
  const [estimatedHours] = useState('')
  const [major, setMajor] = useState('')
  const [majorId, setMajorId] = useState('')
  const [difficulty, setDifficulty] = useState<number>(0)
  const [coverImage, setCoverImage] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [batchId, setBatchId] = useState('')

  /* module 2: knowledge points */ const [knowledgePool, setKnowledgePool] = useState<
    KnowledgePointItem[]
  >([])
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePointItem[]>([])

  /* module 3: resources */
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [kpRes, libRes] = await Promise.all([
          knowledgeApi.list({ limit: 1000 }),
          resourceLibraryApi.list({ limit: 1000 }),
        ])
        setCustomKnowledgePointIds(new Set())
        ;(kpRes.items || []).forEach((k) => {
          if (k.sourceType === 'course' && k.sourceId === editId) {
            setCustomKnowledgePointIds((prev) => new Set(prev).add(k.id))
          }
        })
        const pool = kpRes.items.map((k) => ({
          id: k.id,
          name: k.name,
          code: k.code,
          description: k.description,
          linked: !customKnowledgePointIds.has(k.id),
          granularLessons: (k as any).granularLessonIds || [],
        }))
        setKnowledgePool(pool)

        const libItems = (libRes.items || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.resourceType || r.type,
          url: r.url,
          description: r.description,
          size: r.fileSize !== undefined ? r.fileSize : r.size,
        }))
        // 课程已绑定的资源（含本地上传后已入库的）并入资源池，保证刷新后选中项可解析
        const boundItems = editId
          ? ((await courseResourceApi.list({ courseId: editId, limit: 200 })).items || []).map(
              (r: any) => ({
                id: r.id,
                name: r.name,
                type: r.resourceType || r.type,
                url: r.url,
                description: r.description,
                size: r.size !== undefined ? r.size : r.fileSize,
              }),
            )
          : []
        const mergedPool: ResourceItem[] = [...libItems, ...boundItems].filter(
          (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i,
        )
        setCourseResourcePool(mergedPool)

        if (editId) {
          const c = await courseApi.get(editId)
          setCourse(c)
          setCourseName(c.name)
          setHours(String(c.onlineHours ?? c.offlineHours ?? ''))
          setLearningGoal(c.description || '')
          setLearningGoalPdf((c as any).evalData?.descriptionPdf || null)
          setMajor(c.majorName || '')
          setMajorId(c.majorId || '')
          setDifficulty(c.difficulty || 0)
          setCoverImage(c.coverImage || '')
          if (c.batchId) setBatchId(c.batchId)

          const selectedKpIds = new Set(
            (c.knowledgePointIds || []).filter((id): id is string => !!id),
          )
          setKnowledgePoints(pool.filter((k) => selectedKpIds.has(k.id)))

          const resIds = new Set((c.resourceIds || []).filter((id): id is string => !!id))
          setSelectedResourceIds(
            Array.from(resIds).filter((id) => mergedPool.some((r) => r.id === id)),
          )
        }
      } catch (err: any) {
        toast({ title: err.message || '加载失败', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  const currentCheckNode: SystemCourseNode | undefined = useMemo(() => {
    const kpForCheck = knowledgePoints.map((kp) => ({
      id: kp.id,
      name: kp.name,
      linked: kp.linked ?? false,
    }))

    const resForCheck: NodeResource[] = selectedResourceIds
      .map((id) => {
        const r = courseResourcePool.find((x) => x.id === id)
        if (!r) return null
        return {
          id: r.id,
          name: r.name,
          type: r.type,
          size: 0,
          url: r.url,
        }
      })
      .filter(Boolean) as NodeResource[]

    return {
      id: 'granular-current',
      courseId: editId || 'granular-new',
      parentId: null,
      name: courseName || '未命名',
      order: 1,
      type: 'normal',
      status: 'draft' as const,
      teachingGoals: learningGoal,
      detailedDescription: detailedDescription || undefined,
      background: background || undefined,
      estimatedHours: parseInt(estimatedHours) || undefined,
      descriptionPdf: learningGoalPdf || undefined,
      duration: parseInt(hours) || 0,
      knowledgePoints: kpForCheck,
      resources: resForCheck,
      quizzes: [],
      homeworks: [],
      evalData: {},
    }
  }, [
    editId,
    courseName,
    hours,
    learningGoal,
    detailedDescription,
    background,
    estimatedHours,
    learningGoalPdf,
    courseResourcePool,
    knowledgePoints,
    selectedResourceIds,
  ])

  // 本地上传资源（res- 临时 ID）入库并绑定课程，返回临时 ID → 真实 ID 映射。
  // 自定义文件上传只落在组件状态，刷新后无法解析，必须在保存时持久化到资源库。
  const persistLocalResources = async (courseId: string): Promise<Record<string, string>> => {
    const idMap: Record<string, string> = {}
    for (const rid of selectedResourceIds) {
      if (!rid.startsWith('res-')) continue
      const r = courseResourcePool.find((x) => x.id === rid)
      if (!r) continue
      try {
        const created = await courseResourceApi.create({
          courseId,
          name: r.name,
          type: r.type,
          url: r.url || '',
          description: r.description,
          size: r.size != null ? Number(r.size) : undefined,
        })
        idMap[rid] = created.id
        setCourseResourcePool((prev) => [
          ...prev.filter((x) => x.id !== rid),
          { ...r, id: created.id },
        ])
      } catch (err: any) {
        toast({ title: `资源「${r.name}」保存失败: ${err.message}`, variant: 'destructive' })
        throw err
      }
    }
    return idMap
  }

  const handleSave = async () => {
    if (!courseName) {
      toast({ title: '请输入课程名称', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const kpIdMapping: Record<string, string> = {}
      for (const kp of knowledgePoints) {
        const isNew = kp.id.startsWith('kp-custom-')
        const isCustom = isNew || customKnowledgePointIds.has(kp.id)
        if (!isCustom) continue
        try {
          if (isNew) {
            const created = await knowledgeApi.create({
              name: kp.name,
              code: kp.code,
              description: kp.description,
              linked: false,
              granularLessonIds: (kp as any).granularLessons || [],
              sourceType: 'course',
              sourceId: editId,
            } as any)
            kpIdMapping[kp.id] = created.id
            setCustomKnowledgePointIds((prev) => new Set(prev).add(created.id))
          } else {
            await knowledgeApi.update(kp.id, {
              name: kp.name,
              code: kp.code,
              description: kp.description,
              linked: false,
              granularLessonIds: (kp as any).granularLessons || [],
            } as any)
          }
        } catch (err: any) {
          toast({ title: `知识点「${kp.name}」保存失败: ${err.message}`, variant: 'destructive' })
          setSaving(false)
          return
        }
      }
      const description = learningGoal || undefined
      const knowledgePointIds = knowledgePoints
        .map((kp) => kpIdMapping[kp.id] || kp.id)
        .filter((id) => !id.startsWith('kp-custom-'))
      const tempResourceIds = selectedResourceIds.filter((id) => id.startsWith('res-'))
      const savedResourceIds = selectedResourceIds.filter((id) => !id.startsWith('res-'))
      const persistNewResources = async (courseId: string) => {
        if (tempResourceIds.length === 0) return savedResourceIds
        const idMap = await persistLocalResources(courseId)
        const realIds = [...savedResourceIds, ...Object.values(idMap)]
        setSelectedResourceIds(realIds)
        return realIds
      }
      const payload: Partial<
        Omit<
          Course,
          | 'id'
          | 'createdAt'
          | 'updatedAt'
          | 'nodeCount'
          | 'resourceCount'
          | 'studyCount'
          | 'viewCount'
        >
      > = {
        name: courseName,
        type: 'granular',
        category: course?.category || '专业基础',
        majorId: majorId || course?.majorId || undefined,
        majorName: major || course?.majorName || undefined,
        onlineHours: parseInt(hours) || 0,
        offlineHours: 0,
        coverImage: coverImage || undefined,
        batchId: batchId || undefined,
        status: course?.status || 'draft',
        creatorId: course?.creatorId || undefined,
        coCreatorIds: course?.coCreatorIds ?? [],
        difficulty: difficulty > 0 ? difficulty : undefined,
        description,
        detailedDescription: detailedDescription || undefined,
        background: background || undefined,
        estimatedHours: parseInt(estimatedHours) || 0,
        evalData: {
          learningGoal: learningGoal || undefined,
          knowledgePointIds,
          descriptionPdf: learningGoalPdf || undefined,
        },
        knowledgePointIds,
        resourceIds: savedResourceIds,
      } as any
      if (editId) {
        const realIds = await persistNewResources(editId)
        await courseApi.update(editId, { ...payload, resourceIds: realIds })
        hasSavedRef.current = true
        if (course?.status !== 'draft') {
          await courseApi.saveDraft(editId)
          setCourse((prev) => (prev ? { ...prev, status: 'draft' as const } : prev))
        }
        toast({ title: '草稿已保存' })
        if (Object.keys(kpIdMapping).length > 0) {
          setKnowledgePoints((prev) =>
            prev.map((kp) => (kpIdMapping[kp.id] ? { ...kp, id: kpIdMapping[kp.id] } : kp)),
          )
        }
      } else {
        const c = await courseApi.create(
          payload as Omit<
            Course,
            'id' | 'nodeCount' | 'resourceCount' | 'studyCount' | 'createdAt' | 'updatedAt'
          >,
        )
        if (tempResourceIds.length > 0) {
          const realIds = await persistNewResources(c.id)
          await courseApi.update(c.id, { resourceIds: realIds })
        }
        router.replace(`/lesson/admin/granular/add?id=${c.id}`)
        toast({ title: '草稿已保存' })
      }
    } catch (err: any) {
      toast({ title: err.message || '保存失败', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = async () => {
    await handleSave()
    if (!hasSavedRef.current) return
    router.push('/lesson/admin/granular')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center text-gray-400">
        加载中...
      </div>
    )
  }

  return (
    <EditorShell
      mode="fullscreen"
      backText="取消"
      onBack={async () => {
        if (isNewCourse && editId && !hasSavedRef.current) {
          try {
            await courseApi.delete(editId)
          } catch (err) {
            reportError(err, '删除未保存的课程草稿')
          }
        }
        router.push('/lesson/admin/granular')
      }}
      onSaveDraft={handleSave}
      isSaving={saving}
      onSubmit={handleFinish}
      submitText="完成配置"
      title={editId ? '编辑颗粒课' : '新建颗粒课'}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        <main className="space-y-5 min-w-0">
          {/* Module 1: Basic Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1890ff]" />
                基本信息配置
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* 左列：课程名称、所属批次、所属专业 */}
                <div className="space-y-4 min-w-0">
                  <FormFieldRow label="课程名称" labelClassName="text-xs">
                    <Input
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="请输入课程名称"
                      className="h-9 text-sm"
                    />
                  </FormFieldRow>
                  <BatchSelector value={batchId} onChange={setBatchId} batchApi={lessonBatchApi} />
                  <FormFieldRow label="所属专业" labelClassName="text-xs">
                    <MajorSelect
                      value={majorId}
                      onChange={(v, m) => {
                        setMajorId(v || '')
                        setMajor(m?.name || '')
                      }}
                      placeholder="请选择适用专业"
                    />
                  </FormFieldRow>
                </div>
                {/* 右列：封面图片（桌面端位于课程名称右侧，移动端单列排布） */}
                <div className="max-w-[400px]">
                  <CoverImageUpload
                    imageUrl={coverImage}
                    uploading={coverUploading}
                    label="课程封面"
                    alt="课程封面"
                    onUpload={async (file) => {
                      setCoverUploading(true)
                      try {
                        const res = await fileApi.upload(file)
                        setCoverImage(res.url)
                      } catch (err: any) {
                        toast({ title: err.message || '封面上传失败', variant: 'destructive' })
                      } finally {
                        setCoverUploading(false)
                      }
                    }}
                    onRemove={() => setCoverImage('')}
                  />
                </div>
                <div className="md:col-span-2">
                  <TaskInfoCard
                    name=""
                    onNameChange={() => {}}
                    type="training"
                    onTypeChange={() => {}}
                    difficulty={difficulty}
                    onDifficultyChange={setDifficulty}
                    hours={parseInt(hours) || 0}
                    onHoursChange={(v) => setHours(String(v))}
                    showBackground={false}
                    showName={false}
                    showType={false}
                    hoursLabel="课时数"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs">学习目标</Label>
                  <RichTextEditor
                    value={learningGoal}
                    onChange={setLearningGoal}
                    minHeight={280}
                    pdfUrl={learningGoalPdf}
                    onPdfChange={setLearningGoalPdf}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Module 2: Knowledge Points */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#1890ff]" />
                关联知识点
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <KnowledgeSelector
                selected={knowledgePoints}
                pool={knowledgePool}
                onChange={setKnowledgePoints}
                onAddCustom={(name, description) => {
                  const newId = `kp-custom-${Date.now()}`
                  setCustomKnowledgePointIds((prev) => new Set(prev).add(newId))
                  const newKp: KnowledgePointItem = {
                    id: newId,
                    name,
                    description,
                    linked: false,
                  }
                  setKnowledgePoints((prev) => [...prev, newKp])
                }}
              />
            </CardContent>
          </Card>

          {/* Module 3: Resources */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1890ff]" />
                配置课程资源
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {selectedResourceIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedResourceIds.map((rid) => {
                    const r = courseResourcePool.find((x) => x.id === rid)
                    return (
                      <Badge
                        key={rid}
                        variant="secondary"
                        className="px-2 py-0.5 text-xs gap-1 bg-primary/5 text-primary"
                      >
                        {r?.name || rid.slice(0, 8)}
                        <button
                          className="text-primary/70 hover:text-primary"
                          onClick={() =>
                            setSelectedResourceIds((prev) => prev.filter((id) => id !== rid))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="mr-2 h-4 w-4" />
                    添加课程资源
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="sm:max-w-5xl max-h-[90vh] overflow-y-auto"
                  onInteractOutside={(e) => {
                    e.preventDefault()
                    if (previewResources.length > 0) {
                      previewResources.forEach((r: any) => removePreviewResource(r.id))
                    }
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>添加课程资源</DialogTitle>
                    <DialogDescription>从资源库中选择或上传新资源</DialogDescription>
                  </DialogHeader>
                  <ResourceSelector
                    standalone={false}
                    pool={courseResourcePool}
                    selectedIds={selectedResourceIds}
                    onChange={setSelectedResourceIds}
                    onUpload={(r) => {
                      setCourseResourcePool((prev) =>
                        prev.some((x) => x.id === r.id) ? prev : [...prev, r],
                      )
                      setSelectedResourceIds((prev) => [...prev, r.id])
                    }}
                    previewResources={previewResources}
                    onAddPreviewResource={addPreviewResource}
                    onRemovePreviewResource={removePreviewResource}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button>确认</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <div className="h-12" />
        </main>

        <PublishCheckPanel node={currentCheckNode} hideEval hideDetailedDescription />
      </div>
    </EditorShell>
  )
}

export default function AddGranularPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center text-gray-400">
          加载中...
        </div>
      }
    >
      <AddGranularPageInner />
    </Suspense>
  )
}
