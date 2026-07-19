"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  X,
  ArrowDownFromLine,
  ArrowUpFromLine,
  Archive,
} from "lucide-react"
import { PageHeaderCard } from "@/components/shared/page-header-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { courseApi, lessonBatchApi, importExportApi, approvalApi } from "@/lib/api"
import { CourseList } from "./course-list"
import type { Course, CourseStatus, CourseType } from "@/lib/types/lesson-source"
import type { Course as BackendCourse, LessonBatch } from "@/lib/types/lesson"
import { useAuth } from "@/components/auth-provider"

function displayCreatorName(creatorId: string, currentUserId?: string): string {
  return currentUserId && creatorId === currentUserId ? "杭州知与未来科技有限公司" : creatorId
}

function convertBackendCourse(c: BackendCourse, currentUserId?: string): Course {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type as CourseType,
    category: c.category,
    major: c.majorName || "",
    teacher: c.teacherId || "",
    industry: c.industryName || "",
    version: c.version || "V1.0",
    updateDate: c.updatedAt,
    nodeCount: c.nodeCount,
    lessonCount: 0,
    resourceCount: c.resourceCount,
    studyCount: c.studyCount,
    status: c.status as CourseStatus,
    coverColor: c.coverColor || undefined,
    coverImage: c.coverImage || undefined,
    courseTag: c.courseTag || undefined,
    creator: displayCreatorName(c.creatorId, currentUserId),
    creatorId: c.creatorId,
    createDate: c.createdAt,
    coCreator: c.coCreatorIds?.length ? c.coCreatorIds.join(", ") : undefined,
    coCreatorIds: c.coCreatorIds,
    batchId: c.batchId || undefined,
    batchName: c.batchName || undefined,
    onlineHours: c.onlineHours,
    offlineHours: c.offlineHours,
    onlineWeight: c.onlineWeight,
    offlineWeight: c.offlineWeight,
    semester: c.semester || undefined,
    className: c.className || undefined,
  }
}

type TabType = "my" | "collab" | "public"
type ViewMode = "list" | "group"

interface CourseAdminPageProps {
  title: string
  subtitle: string
  courseType: CourseType
  addHref: string
}

export function CourseAdminPage({ title, subtitle, courseType, addHref }: CourseAdminPageProps) {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const currentUserId = user?.id ?? ""
  const [activeTab, setActiveTab] = useState<TabType>("my")
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<CourseStatus | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<LessonBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedBatches, setExpandedBatches] = useState<string[]>([])

  // Dialogs
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isResourceImportDialogOpen, setIsResourceImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isBatchMoveDialogOpen, setIsBatchMoveDialogOpen] = useState(false)
  const [moveTargetBatchId, setMoveTargetBatchId] = useState("")

  const [isCloneRenameDialogOpen, setIsCloneRenameDialogOpen] = useState(false)
  const [cloneRenameValue, setCloneRenameValue] = useState("")
  const [cloneTargetCourse, setCloneTargetCourse] = useState<Course | null>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [coursesResp, batchesResp] = await Promise.all([
        courseApi.list({ type: courseType, limit: 1000 }),
        lessonBatchApi.list({ limit: 1000 }),
      ])
      setCourses(coursesResp.items.map((c) => convertBackendCourse(c, currentUserId)))
      setBatches(batchesResp.items)
      setExpandedBatches(batchesResp.items.map((b) => b.id))
    } catch (err) {
      console.error("Failed to load lesson data:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [courseType])

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    )
  }

  const tabFilteredCourses = useMemo(() => {
    switch (activeTab) {
      case "my":
        return courses.filter((c) => c.creatorId === currentUserId)
      case "collab":
        return courses.filter((c) => c.coCreatorIds?.includes(currentUserId))
      case "public":
      default:
        return courses.filter((c) => c.status === "published")
    }
  }, [courses, activeTab, currentUserId])

  const filteredCourses = useMemo(() => {
    let result = tabFilteredCourses
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      )
    }
    if (selectedBatchId) {
      result = result.filter((c) => c.batchId === selectedBatchId)
    }
    if (selectedStatus) {
      result = result.filter((c) => c.status === selectedStatus)
    } else {
      result = result.filter((c) => c.status !== "archived")
    }
    return result
  }, [tabFilteredCourses, searchQuery, selectedBatchId, selectedStatus])

  const stats = useMemo(() => {
    const total = filteredCourses.length
    const draft = filteredCourses.filter((c) => c.status === "draft").length
    const pending = filteredCourses.filter((c) => c.status === "pending").length
    const rejected = filteredCourses.filter((c) => c.status === "rejected").length
    const published = filteredCourses.filter((c) => c.status === "published").length
    return { total, draft, pending, rejected, published }
  }, [filteredCourses])

  const coursesByBatch = useMemo(() => {
    if (viewMode !== "group") return null
    const groups: Record<string, Course[]> = {}
    filteredCourses.forEach((c) => {
      if (!c.batchId) return
      if (!groups[c.batchId]) groups[c.batchId] = []
      groups[c.batchId].push(c)
    })
    return groups
  }, [filteredCourses, viewMode])

  const uncategorizedCourses = useMemo(
    () => filteredCourses.filter((c) => !c.batchId && c.status === "draft"),
    [filteredCourses]
  )

  const handleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((sid) => sid !== id)))
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredCourses.map((c) => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const selectedCourses = courses.filter((c) => selectedIds.includes(c.id))
  const hasSelected = selectedIds.length > 0

  const canBatchSubmit = selectedCourses.some((c) => c.status === "draft" || c.status === "rejected")
  const canBatchWithdraw = selectedCourses.some((c) => c.status === "pending")
  const canBatchUnpublish = selectedCourses.some((c) => c.status === "published")
  const canBatchDelete = selectedCourses.some((c) => c.status === "draft" || c.status === "rejected")
  const canBatchArchive = selectedCourses.some((c) => ["draft", "rejected", "approved", "published"].includes(c.status))

  const handleBatchSubmitApproval = async () => {
    for (const id of selectedIds) {
      const course = courses.find((c) => c.id === id)
      if (course && (course.status === "draft" || course.status === "rejected") && course.batchId) {
        const batch = batches.find((b) => b.id === course.batchId)
        await courseApi.submit(id)
        await approvalApi.create({ targetType: "course", targetId: id, workflowId: batch?.workflowId })
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchWithdrawApproval = async () => {
    for (const id of selectedIds) {
      const course = courses.find((c) => c.id === id)
      if (course && course.status === "pending") {
        await courseApi.withdraw(id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchUnpublish = async () => {
    for (const id of selectedIds) {
      const course = courses.find((c) => c.id === id)
      if (course && course.status === "published") {
        await courseApi.unpublish(id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchPublish = async () => {
    for (const id of selectedIds) {
      await courseApi.publish(id)
    }
    setSelectedIds([])
    await loadData()
  }

  const handleArchive = async (course: Course) => {
    if (!confirm(`确定要归档课程「${course.name}」吗？归档后可在课程历史档案库中查看。`)) return
    await courseApi.archive(course.id)
    await loadData()
  }

  const handleBatchArchive = async () => {
    for (const id of selectedIds) {
      const course = courses.find((c) => c.id === id)
      if (course && ["draft", "rejected", "approved", "published"].includes(course.status)) {
        await courseApi.archive(course.id)
      }
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      await courseApi.delete(id)
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchClone = async () => {
    const toClone = courses.filter((c) => selectedIds.includes(c.id))
    for (const course of toClone) {
      await courseApi.create({
        code: `${course.code}-clone-${Date.now()}`,
        name: `${course.name} (克隆)`,
        type: course.type,
        category: course.category,
          majorId: undefined,
        teacherId: course.teacher || undefined,
          industryId: undefined,
        version: course.version,
        status: "draft",
        creatorId: currentUserId || "",
        coCreatorIds: [],
        batchId: course.batchId,
      })
    }
    setSelectedIds([])
    await loadData()
  }

  const handleBatchExport = async () => {
    const res = await importExportApi.export("courses")
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const disposition = res.headers.get("content-disposition")
    const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || "courses-export.csv"
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
    setIsExportDialogOpen(false)
    setSelectedIds([])
  }

  const handleBatchMove = () => {
    setIsBatchMoveDialogOpen(true)
  }

  const handleConfirmMove = async () => {
    if (!moveTargetBatchId) return
    for (const id of selectedIds) {
      await courseApi.update(id, { batchId: moveTargetBatchId })
    }
    setSelectedIds([])
    setIsBatchMoveDialogOpen(false)
    setMoveTargetBatchId("")
    await loadData()
  }

  const handleClone = (course: Course) => {
    setCloneTargetCourse(course)
    setCloneRenameValue(`${course.name} (克隆)`)
    setIsCloneRenameDialogOpen(true)
  }

  const handleConfirmClone = async () => {
    if (!cloneTargetCourse) return
    await courseApi.create({
      code: `${cloneTargetCourse.code}-clone-${Date.now()}`,
      name: cloneRenameValue,
      type: cloneTargetCourse.type,
      category: cloneTargetCourse.category,
      majorId: undefined,
      teacherId: cloneTargetCourse.teacher || undefined,
      industryId: undefined,
      version: cloneTargetCourse.version,
      status: "draft",
      creatorId: currentUserId,
      coCreatorIds: [],
      batchId: cloneTargetCourse.batchId,
    })
    setIsCloneRenameDialogOpen(false)
    setCloneTargetCourse(null)
    setCloneRenameValue("")
    await loadData()
  }

  const handleDelete = async (course: Course) => {
    if (confirm(`确定要删除课程「${course.name}」吗？`)) {
      await courseApi.delete(course.id)
      await loadData()
    }
  }

  const handleSubmitApproval = async (course: Course) => {
    if (!course.batchId) {
      alert("该课程未关联批次，无法提交审批")
      return
    }
    const batch = batches.find((b) => b.id === course.batchId)
    await courseApi.submit(course.id)
    await approvalApi.create({ targetType: "course", targetId: course.id, workflowId: batch?.workflowId })
    await loadData()
  }

  const handleWithdrawApproval = async (course: Course) => {
    await courseApi.withdraw(course.id)
    await loadData()
  }

  const handleApprove = async (course: Course) => {
    const records = await approvalApi.list({ targetType: "course", targetId: course.id, status: "pending", limit: 1 })
    if (records.items.length === 0) {
      alert("未找到审批记录")
      return
    }
    await approvalApi.review(records.items[0].id, { status: "approved" })
    await loadData()
  }

  const handleReject = async (course: Course) => {
    const records = await approvalApi.list({ targetType: "course", targetId: course.id, status: "pending", limit: 1 })
    if (records.items.length === 0) {
      alert("未找到审批记录")
      return
    }
    await approvalApi.review(records.items[0].id, { status: "rejected" })
    await loadData()
  }

  const handlePublish = async (course: Course) => {
    await courseApi.publish(course.id)
    await loadData()
  }

  const handleUnpublish = async (course: Course) => {
    await courseApi.unpublish(course.id)
    await loadData()
  }

  const handleInviteCoBuild = async (course: Course) => {
    const userId = window.prompt(`请输入要邀请共建「${course.name}」的用户 ID`)
    if (!userId) return
    await courseApi.invite(course.id, userId)
    await loadData()
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setSelectedBatchId(null)
    setSelectedStatus(null)
  }

  const handleImportFileSelect = (files: FileList | null) => {
    const file = files?.[0]
    if (file) setImportFile(file)
  }

  const handleImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const result = await importExportApi.import("courses", importFile)
      alert(`导入完成：成功 ${result.created} 条，失败 ${result.failed} 条`)
      setImportFile(null)
      setIsImportDialogOpen(false)
      await loadData()
    } catch (err: any) {
      alert(err.message || "导入失败")
    } finally {
      setIsImporting(false)
    }
  }

  const handleExport = async () => {
    const res = await importExportApi.export("courses")
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const disposition = res.headers.get("content-disposition")
    const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] || "courses-export.csv"
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleCreate = async () => {
    try {
      const newCourse = await courseApi.create({
        code: `${courseType.toUpperCase()}-${Date.now()}`,
        name: `新建${typeLabel}`,
        type: courseType,
        category: "default",
        status: "draft",
        creatorId: currentUserId || "",
        coCreatorIds: [],
      })
      router.push(`${addHref}?id=${newCourse.id}&new=true`)
    } catch (err: any) {
      console.error("Failed to create course:", err)
      alert(err.message || "创建失败")
    }
  }
  const typeLabel = courseType === "system" ? "体系课" : courseType === "granular" ? "颗粒课" : "混合课"

  return (
    <div className="space-y-6">
      {/* ===== Part 1: Top Title Card ===== */}
      <PageHeaderCard
        title={title}
        description={subtitle}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsResourceImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              导入资源包
            </Button>

            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增{typeLabel}
            </Button>
          </>
        }
        stats={
          activeTab !== "public"
            ? [
                {
                  label: `${typeLabel}总数`,
                  value: stats.total,
                  icon: <SlidersHorizontal className="h-3 w-3 text-blue-500" />,
                  iconClassName: "bg-blue-50",
                },
                {
                  label: "未提交",
                  value: stats.draft,
                  icon: <RotateCcw className="h-3 w-3 text-gray-500" />,
                  iconClassName: "bg-gray-50",
                },
                {
                  label: "审批中",
                  value: stats.pending,
                  icon: <GitBranch className="h-3 w-3 text-yellow-500" />,
                  iconClassName: "bg-yellow-50",
                },
                {
                  label: "已驳回",
                  value: stats.rejected,
                  icon: <X className="h-3 w-3 text-red-500" />,
                  iconClassName: "bg-red-50",
                },
                {
                  label: "已发布",
                  value: stats.published,
                  icon: <ArrowUpFromLine className="h-3 w-3 text-green-500" />,
                  iconClassName: "bg-green-50",
                },
              ]
            : undefined
        }
      />

      {/* ===== Part 2: View Switch Area ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabType); setSelectedIds([]); setSelectedBatchId(null) }}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="my" className="w-full">我的{typeLabel}</TabsTrigger>
            <TabsTrigger value="collab" className="w-full">共建{typeLabel}</TabsTrigger>
            <TabsTrigger value="public" className="w-full">公共{typeLabel}</TabsTrigger>
          </TabsList>
        </Tabs>

        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
          <ToggleGroupItem value="list" aria-label="资源列表">
            <List className="h-4 w-4" />
            <span className="ml-1.5">资源列表</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="group" aria-label="批次分组">
            <LayoutGrid className="h-4 w-4" />
            <span className="ml-1.5">批次分组</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* ===== Part 3: Data List Area ===== */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          {/* Search + Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 w-full">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  placeholder={`搜索${typeLabel}名称 / 编码`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-sm flex-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedBatchId || "__all__"} onValueChange={(v) => setSelectedBatchId(v === "__all__" ? null : v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue placeholder="按批次筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部批次</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      <span className="flex items-center gap-2">
                        {batch.name}
                        <span className="text-xs text-gray-400">({batch.id.slice(0, 8)})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus || "__all__"} onValueChange={(v) => setSelectedStatus(v === "__all__" ? null : v as CourseStatus)}>
                <SelectTrigger className="h-9 text-sm w-36">
                  <SelectValue placeholder="按状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="pending">审批中</SelectItem>
                  <SelectItem value="rejected">已驳回</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={handleResetFilters}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              重置
            </Button>
          </div>

          {/* Quick actions - linked with checkboxes */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className={cn("text-xs mr-1", hasSelected ? "text-slate-700 font-medium" : "text-slate-400")}>
              {hasSelected ? `已选择 ${selectedIds.length} 项：` : "请选择课程："}
            </span>
            {hasPermission("lesson", "courses", "submit_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchSubmit} onClick={handleBatchSubmitApproval}>
                <Send className="mr-1 h-3 w-3" />
                提交审批
              </Button>
            )}
            {hasPermission("lesson", "courses", "withdraw_approval") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchWithdraw} onClick={handleBatchWithdrawApproval}>
                <Undo2 className="mr-1 h-3 w-3" />
                撤回审批
              </Button>
            )}
            {hasPermission("lesson", "courses", "publish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchPublish}>
                <ArrowUpFromLine className="mr-1 h-3 w-3" />
                发布
              </Button>
            )}
            {hasPermission("lesson", "courses", "unpublish") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchUnpublish} onClick={handleBatchUnpublish}>
                <ArrowDownFromLine className="mr-1 h-3 w-3" />
                取消发布
              </Button>
            )}
            {hasPermission("lesson", "courses", "archive") && (
              <Button variant="outline" size="sm" className="h-8 text-xs text-purple-600 hover:text-purple-700" disabled={!hasSelected || !canBatchArchive} onClick={handleBatchArchive}>
                <Archive className="mr-1 h-3 w-3" />
                归档
              </Button>
            )}
            {hasPermission("lesson", "courses", "delete") && (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected || !canBatchDelete} onClick={handleBatchDelete}>
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchClone}>
              <Copy className="mr-1 h-3 w-3" />
              克隆
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchMove}>
              <FolderKanban className="mr-1 h-3 w-3" />
              调整批次分组
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!hasSelected} onClick={handleBatchExport}>
              <Download className="mr-1 h-3 w-3" />
              导出
            </Button>
          </div>
        </CardContent>

        {/* Course list - merged into the same Card */}
        {!isLoading && filteredCourses.length > 0 && viewMode !== "group" && (
          <CardContent className="pt-0">
            <CourseList
              courses={filteredCourses}
              courseType={courseType}
              selectedIds={selectedIds}
              onSelectId={handleSelectId}
              onSelectAll={handleSelectAll}
              onClone={handleClone}
              onDelete={handleDelete}
              onSubmitApproval={handleSubmitApproval}
              onWithdrawApproval={handleWithdrawApproval}
              onApprove={handleApprove}
              onReject={handleReject}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onArchive={handleArchive}
              onInviteCoBuild={handleInviteCoBuild}
              onExport={handleExport}
              className="border-0 rounded-none"
            />
          </CardContent>
        )}
      </Card>

      {/* Course list - group view remains outside the card */}
      {!isLoading && filteredCourses.length > 0 && viewMode === "group" && coursesByBatch && (
        <div className="space-y-4">
          {Object.entries(coursesByBatch).map(([batchId, batchCourses]) => {
            const batch = batches.find((b) => b.id === batchId)
            if (!batch) return null
            const isExpanded = expandedBatches.includes(batchId)

            return (
              <Collapsible key={batchId} open={isExpanded} onOpenChange={() => toggleBatch(batchId)}>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-800">{batch.name}</span>
                        {batch.majorName && (
                          <span className="text-xs text-gray-400">({batch.majorName})</span>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {batchCourses.length} 个{typeLabel}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      <CourseList
                        courses={batchCourses}
                        courseType={courseType}
                        selectedIds={selectedIds}
                        onSelectId={handleSelectId}
                        onSelectAll={handleSelectAll}
                        onClone={handleClone}
                        onDelete={handleDelete}
                        onSubmitApproval={handleSubmitApproval}
                        onWithdrawApproval={handleWithdrawApproval}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onPublish={handlePublish}
                        onUnpublish={handleUnpublish}
                        onArchive={handleArchive}
                        onInviteCoBuild={handleInviteCoBuild}
                        onExport={handleExport}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
          {uncategorizedCourses.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">未分类</span>
                  <Badge variant="secondary" className="text-xs">
                    {uncategorizedCourses.length} 个{typeLabel}
                  </Badge>
                </div>
              </div>
              <div className="p-4 pt-0">
                <CourseList
                  courses={uncategorizedCourses}
                  courseType={courseType}
                  selectedIds={selectedIds}
                  onSelectId={handleSelectId}
                  onSelectAll={handleSelectAll}
                  onClone={handleClone}
                  onDelete={handleDelete}
                  onSubmitApproval={handleSubmitApproval}
                  onWithdrawApproval={handleWithdrawApproval}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  onArchive={handleArchive}
                  onInviteCoBuild={handleInviteCoBuild}
                  onExport={handleExport}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && filteredCourses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">暂无{typeLabel}</h3>
          <p className="mb-4 text-sm text-slate-500">当前筛选条件下没有课程数据</p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增{typeLabel}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入{typeLabel}</DialogTitle>
            <DialogDescription>上传 CSV 文件批量导入课程数据（需包含 name 列）</DialogDescription>
          </DialogHeader>
          <div className="py-8">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                {importFile ? importFile.name : "点击选择 CSV 文件"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleImportFileSelect(e.target.files)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>取消</Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting}>
              {isImporting ? "导入中..." : "开始导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Import Dialog */}
      <Dialog open={isResourceImportDialogOpen} onOpenChange={setIsResourceImportDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>资源包导入</DialogTitle>
            <DialogDescription>导入包含课程、知识点和资源的完整资源包</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center">
              <Upload className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-600 font-medium">点击或拖拽资源包到此处上传</p>
              <p className="text-xs text-slate-400 mt-1">支持 .zip, .rar 格式</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResourceImportDialogOpen(false)}>取消</Button>
            <Button disabled>开始导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>导出{typeLabel}</DialogTitle>
            <DialogDescription>将选中的课程数据导出为文件</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">已选择 {selectedIds.length} 个{typeLabel}</p>
            <div className="grid gap-2">
              <Label>导出格式</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Excel (.xlsx)</Button>
                <Button variant="outline" size="sm" className="flex-1">CSV (.csv)</Button>
                <Button variant="outline" size="sm" className="flex-1">JSON (.json)</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchExport}>确认导出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Move Dialog */}
      <Dialog open={isBatchMoveDialogOpen} onOpenChange={setIsBatchMoveDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>调整批次分组</DialogTitle>
            <DialogDescription>将选中的 {selectedIds.length} 个{typeLabel}移动到指定批次</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={moveTargetBatchId} onValueChange={setMoveTargetBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标批次" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchMoveDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmMove} disabled={!moveTargetBatchId}>确认移动</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Rename Dialog */}
      <Dialog open={isCloneRenameDialogOpen} onOpenChange={setIsCloneRenameDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>克隆{typeLabel}</DialogTitle>
            <DialogDescription>为克隆的课程命名</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={cloneRenameValue}
              onChange={(e) => setCloneRenameValue(e.target.value)}
              placeholder="输入新课程名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneRenameDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmClone} disabled={!cloneRenameValue.trim()}>确认克隆</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
