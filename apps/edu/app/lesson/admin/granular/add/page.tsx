"use client"

import Image from "next/image"
import { useEffect, useState, useRef, Suspense, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Star,
  BookOpen,
  GraduationCap,
  ImageUp,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { EvalMethodConfigPanel } from "@/components/shared/eval-method-config-panel"
import { TaskInfoCard } from "@/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card"
import type { EvalRuleConfig } from "@/lib/types/evaluation"
import { TaskDescriptionCard } from "@/app/scene/scenarios/[id]/edit/tasks/_components/task-description-card"
import { RichTextEditor } from "../../_components/common/rich-text-editor"
import PublishCheckPanel from "../../system/add/_components/PublishCheckPanel"
import { EditorShell } from "@/components/shared/editor-shell"
import { BatchSelector } from "@/components/shared/batch-selector"

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
  const [code, setCode] = useState("")
  const [hours, setHours] = useState("")
  const [learningGoal, setLearningGoal] = useState("")
  const [detailedDescription, setDetailedDescription] = useState("")
  const [background, setBackground] = useState("")
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

  /* module 4: assessment */
  const [evalRuleConfig, setEvalRuleConfig] = useState<EvalRuleConfig | undefined>(undefined)
  const evalMethods = useMemo(() => evalRuleConfig?.evaluationMethods || [], [evalRuleConfig?.evaluationMethods])

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [kpRes] = await Promise.all([
          knowledgeApi.list({ limit: 1000 }),
        ])
        const pool = kpRes.items.map((k) => ({
          id: k.id,
          name: k.name,
          code: k.code,
          description: k.description,
          linked: k.linked,
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
          setMajor(c.majorName || "")
          setMajorId(c.majorId || "")
          setDifficulty(c.difficulty || 0)
          setCoverImage(c.coverImage || "")
          if (c.batchId) setBatchId(c.batchId)

          const selectedKpIds = new Set((c.knowledgePointIds || []).filter((id): id is string => !!id))
          setKnowledgePoints(
            pool
              .filter((k) => selectedKpIds.has(k.id))
              .map((k) => ({ ...k, linked: true }))
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

          const evalData = (c.evalData || {}) as Record<string, any>
          setEvalRuleConfig(evalData.evalRuleConfig as EvalRuleConfig | undefined)
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
      code: code || undefined,
      order: 1,
      type: "normal",
      status: "draft" as const,
      teachingGoals: learningGoal,
      detailedDescription: detailedDescription || undefined,
      background: background || undefined,
      estimatedHours: parseInt(estimatedHours) || undefined,
      duration: parseInt(hours) || 0,
      knowledgePoints: kpForCheck,
      resources: resForCheck,
      quizzes: [],
      homeworks: [],
      evalData: { methods: evalMethods },
    }
  }, [editId, courseName, code, hours, learningGoal, detailedDescription, background, estimatedHours, knowledgePoints, selectedResourceIds, resourcePool, evalMethods])

  const handleSave = async () => {
    if (!courseName) {
      toast.error("请输入课程名称")
      return
    }
    setSaving(true)
    try {
      const description = learningGoal || undefined
      const knowledgePointIds = knowledgePoints
        .map((kp) => kp.id)
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
        code: code || undefined,
        description,
        detailedDescription: detailedDescription || undefined,
        background: background || undefined,
        estimatedHours: parseInt(estimatedHours) || 0,
        evalData: {
          learningGoal: learningGoal || undefined,
          knowledgePointIds,
          methods: evalMethods,
          evalRuleConfig,
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
                    <Label className="text-xs">课程编码</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入课程编码" className="h-9 text-sm" />
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
                      difficulty={difficulty}
                      onDifficultyChange={setDifficulty}
                      hours={parseInt(hours) || 0}
                      onHoursChange={v => setHours(String(v))}
                      background={background}
                      onBackgroundChange={setBackground}
                      showBackground={true}
                      showName={false}
                      hoursLabel="课时数"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">预计学时</Label>
                    <Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="预计完成学时" className="h-9 text-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs">学习目标</Label>
                    <RichTextEditor value={learningGoal} onChange={setLearningGoal} minHeight={280} />
                  </div>
                  <div className="md:col-span-2">
                    <TaskDescriptionCard
                      description={detailedDescription}
                      onDescriptionChange={setDetailedDescription}
                      descriptionPdf={null}
                      onDescriptionPdfChange={() => {}}
                      toast={(o) => { if (o.variant === "destructive") toast.error(o.title || ""); else toast.success(o.title || ""); }}
                    />
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
                    const newKp: KnowledgePointItem = {
                      id: `kp-custom-${Date.now()}`,
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
                <ResourceSelector
                  pool={resourcePool}
                  selectedIds={selectedResourceIds}
                  onChange={setSelectedResourceIds}
                  onUpload={(r) => setResourcePool((prev) => [...prev, r])}
                  courseId={editId || undefined}
                />
              </CardContent>
            </Card>

            {/* Module 4: Assessment & Evaluation */}
            <EvalMethodConfigPanel
              value={evalRuleConfig}
              onChange={setEvalRuleConfig}
              knowledgePoints={knowledgePoints}
            />

            <div className="h-12" />
          </main>

          <PublishCheckPanel node={currentCheckNode} />
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
