"use client"

import { useEffect, useState, useRef, Suspense, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Send,
  Star,
  BookOpen,
  GraduationCap,
  ImageUp,
} from "lucide-react"
import { toast, Toaster } from "sonner"

import { Button } from "@/components/ui/button"
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
import type { Course } from "@/lib/types/lesson"
import { courseApi, knowledgeApi, fileApi, approvalApi, majorApi } from "@/lib/api"

import { KnowledgeSelector } from "../../_components/knowledge/knowledge-selector"
import { ResourceSelector, type ResourceItem } from "../../_components/resources/resource-selector"
import { RichTextEditor } from "../../_components/common/rich-text-editor"
import PublishCheckPanel from "../../system/add/_components/PublishCheckPanel"

interface KnowledgePointItem {
  id: string
  name: string
  code?: string
  description?: string
  linked: boolean
}


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
  const [courseCode, setCourseCode] = useState("")
  const [hours, setHours] = useState("")
  const [learningGoal, setLearningGoal] = useState("")
  const [major, setMajor] = useState("")
  const [majorId, setMajorId] = useState("")
  const [majorNames, setMajorNames] = useState<string[]>([])
  const majorMapRef = useRef<Map<string, string>>(new Map())
  const [difficulty, setDifficulty] = useState<number>(0)
  const [coverImage, setCoverImage] = useState("")

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
        setKnowledgePool(
          kpRes.items.map((k) => ({
            id: k.id,
            name: k.name,
            code: k.code,
            description: k.description,
            linked: false,
          }))
        )

        if (editId) {
          const c = await courseApi.get(editId)
          setCourse(c)
          setCourseName(c.name)
          setCourseCode(c.code)
          setHours(String(c.onlineHours ?? c.offlineHours ?? ""))
          setLearningGoal("") // course 表无学习目标字段
          setMajor(c.majorName || "")
          setMajorId(c.majorId || "")
          setDifficulty(0)
          setCoverImage(c.coverImage || "")
        } else {
          setCourseCode(`GRA-${Date.now().toString(36).toUpperCase()}`)
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
      duration: parseInt(hours) || 0,
      knowledgePoints: kpForCheck,
      resources: resForCheck,
      quizzes: [],
      homeworks: [],
    }
  }, [editId, courseName, hours, learningGoal, knowledgePoints, selectedResourceIds, resourcePool])

  const handleSave = async () => {
    if (!courseName) {
      toast.error("请输入课程名称")
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Omit<Course, "id" | "createdAt" | "updatedAt">> = {
        name: courseName,
        code: courseCode,
        type: "granular",
        category: course?.category || "专业基础",
        majorId: majorId || course?.majorId || undefined,
        majorName: major || course?.majorName || undefined,
        onlineHours: parseInt(hours) || 0,
        offlineHours: 0,
        coverImage: coverImage || undefined,
        status: course?.status || "draft",
        creatorId: course?.creatorId || undefined,
        coCreatorIds: course?.coCreatorIds ?? [],
      }
      if (editId) {
        await courseApi.update(editId, payload)
        hasSavedRef.current = true
        if (course?.status === "approved" || course?.status === "published") {
          await courseApi.saveDraft(editId)
          setCourse((prev) => (prev ? { ...prev, status: "draft" as const } : prev))
          toast.success("颗粒课已保存，课程已退回草稿状态")
        } else {
          toast.success("颗粒课已保存")
        }
      } else {
        const c = await courseApi.create(payload as Omit<Course, "id" | "nodeCount" | "resourceCount" | "studyCount" | "createdAt" | "updatedAt">)
        router.replace(`/lesson/admin/granular/add?id=${c.id}`)
        toast.success("颗粒课已创建")
      }
    } catch (err: any) {
      toast.error(err.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!editId) {
      toast.error("请先保存草稿")
      return
    }
    setSaving(true)
    try {
      await courseApi.submit(editId)
      hasSavedRef.current = true
      await approvalApi.create({ targetType: "course", targetId: editId })
      toast.success("颗粒课已提交审批")
    } catch (err: any) {
      toast.error(err.message || "提交失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center text-gray-400">
        加载中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={async () => {
                if (isNewCourse && editId && !hasSavedRef.current) {
                  try { await courseApi.delete(editId) } catch {}
                }
                router.push("/lesson/admin/granular")
              }}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回列表
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">
                {editId ? "编辑颗粒课" : "新建颗粒课"}
                {courseName && <span className="text-gray-400 font-normal ml-2">- {courseName}</span>}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                保存草稿
              </Button>
              <Button size="sm" className="gap-1 bg-[#1890ff] hover:bg-[#40a9ff]" onClick={handleSubmit} disabled={saving}>
                <Send className="h-4 w-4" />
                提交
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
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
                    <Input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} className="h-9 text-sm bg-gray-50 text-gray-500" />
                    <p className="text-[10px] text-gray-400">建议保持系统自动生成编码</p>
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
                  <div className="space-y-1.5">
                    <Label className="text-xs">预计课时</Label>
                    <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="请输入课时数" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">难度等级</Label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setDifficulty(star)}
                          className="p-1 transition-colors"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= difficulty
                                ? "text-amber-400 fill-amber-400"
                                : "text-gray-200"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs text-gray-400 ml-2">
                        {difficulty > 0 ? `${difficulty} 星` : "请选择难度"}
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs">学习目标</Label>
                    <RichTextEditor
                      value={learningGoal}
                      onChange={setLearningGoal}
                      minHeight={280}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs">封面图片</Label>
                    <div className="flex items-start gap-4">
                      {coverImage ? (
                        <div className="relative w-[200px] h-[120px] rounded-lg overflow-hidden border border-gray-200">
                          <img src={coverImage} alt="封面预览" className="w-full h-full object-cover" />
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
                />
              </CardContent>
            </Card>

            <div className="h-12" />
          </main>

          <PublishCheckPanel node={currentCheckNode} />
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default function AddGranularPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center text-gray-400">加载中...</div>}>
      <AddGranularPageInner />
    </Suspense>
  )
}
