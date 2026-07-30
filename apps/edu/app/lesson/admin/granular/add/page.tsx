"use client"

import Image from "next/image"
import { useEffect, useState, useRef, Suspense, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Star,
  BookOpen,
  GraduationCap,
  ImageUp,
  Plus,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { SystemCourseNode, NodeResource } from "@/lib/types/lesson-source"
import type { Course, KnowledgePointItem } from "@/lib/types/lesson"
import { courseApi, knowledgeApi, fileApi, approvalApi, majorApi, lessonBatchApi, courseResourceApi } from "@/lib/api"

import { KnowledgeSelector } from "../../_components/knowledge/knowledge-selector"
import { ResourceSelector, type ResourceItem } from "../../_components/resources/resource-selector"
import { TaskInfoCard } from "@/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card"
import { RichTextEditor } from "../../_components/common/rich-text-editor"
import PublishCheckPanel from "../../system/add/_components/PublishCheckPanel"
import { EditorShell } from "@/components/shared/editor-shell"
import { BatchSelector } from "@/components/shared/batch-selector"

const customKnowledgePointIds = new Set<string>()

function AddGranularPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("id")
  const hasSavedRef = useRef(false)
  const isNewCourse = searchParams.get("new") === "true"

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [course, setCourse] = useState<Course | null>(null)

  /* module 1: basic info */
  const [courseName, setCourseName] = useState("")
  const [hours, setHours] = useState("")
  const [learningGoal, setLearningGoal] = useState("")
  const [detailedDescription, setDetailedDescription] = useState("")
  const [background, setBackground] = useState("")
  const [learningGoalPdf, setLearningGoalPdf] = useState<string | null>(null)
  const [estimatedHours, setEstimatedHours] = useState("")
  const [major, setMajor] = useState("")
  const [majorId, setMajorId] = useState("")
  const [majorNames, setMajorNames] = useState<string[]>([])
  const majorMapRef = useRef<Map<string, string>>(new Map())
  const [difficulty, setDifficulty] = useState<number>(0)
  const [coverImage, setCoverImage] = useState("")
  const [batchId, setBatchId] = useState("")

  /* module 2: knowledge points */
  const [knowledgePool, setKnowledgePool] = useState<KnowledgePointItem[]>([])
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePointItem[]>([])

  /* module 3: resources */
  const [resourcePool, setResourcePool] = useState<ResourceItem[]>([])
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [kpRes] = await Promise.all([
          knowledgeApi.list({ limit: 1000 }),
        ])
        customKnowledgePointIds.clear()
        ;(kpRes.items || []).forEach((k) => {
          if (k.sourceType === "course" && k.sourceId === editId) {
            customKnowledgePointIds.add(k.id)
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

        if (editId) {
          const [c, resRes] = await Promise.all([
            courseApi.get(editId),
            courseResourceApi.list({ courseId: editId, limit: 200 }),
          ])
          setCourse(c)
          setCourseName(c.name)
          setHours(String(c.onlineHours ?? c.offlineHours ?? ""))
          setLearningGoal(c.description || "")
          setLearningGoalPdf(((c as any).evalData?.descriptionPdf) || null)
          setMajor(c.majorName || "")
          setMajorId(c.majorId || "")
          setDifficulty(c.difficulty || 0)
          setCoverImage(c.coverImage || "")
          if (c.batchId) setBatchId(c.batchId)

          const selectedKpIds = new Set((c.knowledgePointIds || []).filter((id): id is string => !!id))
          setKnowledgePoints(
            pool.filter((k) => selectedKpIds.has(k.id))
          )

          const resources = (resRes.items || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            url: r.url || r.URL,
            description: r.description,
            size: r.size,
            uploadedBy: r.uploadedBy,
            uploadedAt: r.uploadedAt,
          }))
          setResourcePool(resources)
          setSelectedResourceIds((c.resourceIds || []).filter((id): id is string => !!id))
        }
      } catch (err: any) {
        toast.error(err.message || "加载失败")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [editId])

  useEffect(() => {
    majorApi.list({ limit: 1000 }).then((res) => {
      const enabled = res.items.filter((m) => m.enabled)
      setMajorNames(enabled.map((m) => m.name))
      const map = new Map<string, string>()
      enabled.forEach((m) => map.set(m.name, m.id))
      majorMapRef.current = map
    }).catch(() => {})
  }, [])

  const currentCheckNode: SystemCourseNode | undefined = useMemo(() => {
    const kpForCheck = knowledgePoints.map((kp) => ({
      id: kp.id,
      name: kp.name,
      linked: kp.linked ?? false,
    }))

    const resForCheck: NodeResource[] = selectedResourceIds
      .map((id) => {
        const r = resourcePool.find((x) => x.id === id)
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
      id: "granular-current",
      courseId: editId || "granular-new",
      parentId: null,
      name: courseName || "未命名",
      order: 1,
      type: "normal",
      status: "draft" as const,
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
  }, [editId, courseName, hours, learningGoal, detailedDescription, background, estimatedHours, knowledgePoints, selectedResourceIds, resourcePool])

  const handleSave = async () => {
    if (!courseName) {
      toast.error("请输入课程名称")
      return
    }
    setSaving(true)
    try {
      const kpIdMapping: Record<string, string> = {}
      for (const kp of knowledgePoints) {
        const isNew = kp.id.startsWith("kp-custom-")
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
              sourceType: "course",
              sourceId: editId,
            } as any)
            kpIdMapping[kp.id] = created.id
            customKnowledgePointIds.add(created.id)
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
          toast.error(`知识点「${kp.name}」保存失败: ${err.message}`)
          setSaving(false)
          return
        }
      }
      const description = learningGoal || undefined
      const knowledgePointIds = knowledgePoints
        .map((kp) => kpIdMapping[kp.id] || kp.id)
        .filter((id) => !id.startsWith("kp-custom-"))
      const payload: Partial<Omit<Course, "id" | "createdAt" | "updatedAt" | "nodeCount" | "resourceCount" | "studyCount" | "viewCount">> = {
        name: courseName,
        type: "granular",
        category: course?.category || "专业基础",
        majorId: majorId || course?.majorId || undefined,
        majorName: major || course?.majorName || undefined,
        onlineHours: parseInt(hours) || 0,
        offlineHours: 0,
        coverImage: coverImage || undefined,
        batchId: batchId || undefined,
        status: course?.status || "draft",
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
        resourceIds: selectedResourceIds,
      } as any
      if (editId) {
        await courseApi.update(editId, payload)
        hasSavedRef.current = true
        if (course?.status !== "draft") {
          await courseApi.saveDraft(editId)
          setCourse((prev) => (prev ? { ...prev, status: "draft" as const } : prev))
        }
        toast.success("草稿已保存")
        if (Object.keys(kpIdMapping).length > 0) {
          setKnowledgePoints((prev) => prev.map((kp) => kpIdMapping[kp.id] ? { ...kp, id: kpIdMapping[kp.id] } : kp))
        }
      } else {
        const c = await courseApi.create(payload as Omit<Course, "id" | "nodeCount" | "resourceCount" | "studyCount" | "createdAt" | "updatedAt">)
        router.replace(`/lesson/admin/granular/add?id=${c.id}`)
        toast.success("草稿已保存")
      }
    } catch (err: any) {
      toast.error(err.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = async () => {
    await handleSave()
    router.push("/lesson/admin/granular")
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
          try { await courseApi.delete(editId) } catch {}
        }
        router.push("/lesson/admin/granular")
      }}
      onSaveDraft={handleSave}
      isSaving={saving}
      onSubmit={handleFinish}
      submitText="完成配置"
      title={editId ? "编辑颗粒课" : "新建颗粒课"}
    >
      <div className="grid grid-cols-[1fr_260px] gap-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">课程名称</Label>
                    <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="请输入课程名称" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">所属专业</Label>
                    <Select value={major} onValueChange={(v) => { setMajor(v); setMajorId(majorMapRef.current.get(v) || "") }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="请选择适用专业" />
                      </SelectTrigger>
                      <SelectContent>
                        {majorNames.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <BatchSelector value={batchId} onChange={setBatchId} batchApi={lessonBatchApi} />
                  <div className="md:col-span-2">
                    <TaskInfoCard
                      name=""
                      onNameChange={() => {}}
                      type="training"
                      onTypeChange={() => {}}
                      difficulty={difficulty}
                      onDifficultyChange={setDifficulty}
                      hours={parseInt(hours) || 0}
                      onHoursChange={v => setHours(String(v))}
                      showBackground={false}
                      showName={false}
                      showType={false}
                      hoursLabel="课时数"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs">学习目标</Label>
                    <RichTextEditor value={learningGoal} onChange={setLearningGoal} minHeight={280} pdfUrl={learningGoalPdf} onPdfChange={setLearningGoalPdf} toast={toast} />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs">封面图片</Label>
                    <div className="flex items-start gap-4">
                      {coverImage ? (
                        <div className="relative w-[200px] h-[120px] rounded-lg overflow-hidden border border-gray-200">
                          <Image src={coverImage} alt="封面预览" fill className="object-cover" />
                          <button
                            onClick={() => setCoverImage("")}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                          >✕</button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="w-[200px] h-[120px] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                        >
                          <ImageUp className="w-8 h-8 text-gray-400" />
                          <span className="text-xs text-gray-400 mt-1">点击上传封面</span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            try {
                              const res = await fileApi.upload(file)
                              setCoverImage(res.url)
                            } catch (err: any) {
                              toast.error(err.message || "封面上传失败")
                            }
                          }
                        }}
                      />
                    </div>
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
                     customKnowledgePointIds.add(newId)
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
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full border-dashed">
                      <Plus className="mr-2 h-4 w-4" />
                      添加课程资源
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>添加课程资源</DialogTitle>
                      <DialogDescription>从资源库中选择或上传新资源</DialogDescription>
                    </DialogHeader>
                    <ResourceSelector
                      standalone={false}
                      pool={resourcePool}
                      selectedIds={selectedResourceIds}
                      onChange={setSelectedResourceIds}
                      onUpload={(r) => setResourcePool((prev) => [...prev, r])}
                      courseId={editId || undefined}
                    />
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">关闭</Button>
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
        <Toaster />
      </EditorShell>
  )
}

export default function AddGranularPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center text-gray-400">加载中...</div>}>
      <AddGranularPageInner />
    </Suspense>
  )
}
