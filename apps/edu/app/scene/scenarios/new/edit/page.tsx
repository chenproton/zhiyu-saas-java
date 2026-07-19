"use client"

import { ArrowRight, ChevronDown, ChevronRight, Eye, ImagePlus, List, ListOrdered, Loader2, Save, Search, Star, X, UserPlus } from "lucide-react"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { positionApi, industryApi, sceneBatchApi, userManagementApi, orgApi, scenarioApi, fileApi } from "@/lib/api"
import type { User } from "@/lib/api"
import type { CareerPosition } from "@/lib/types/job"
import type { Industry } from "@/lib/types/backend"
import type { SceneBatch } from "@/lib/types/scene"
import { useToast } from "@/hooks/use-toast"

interface PositionWithProfession extends CareerPosition {
  industryName?: string
}

function IndustryProfessionSelector({
  options,
  selectedIds,
  onChange,
  placeholder,
}: {
  options: { id: string; name: string }[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleOption = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id])
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-auto min-h-[36px] w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selectedIds.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map(id => {
              const opt = options.find(o => o.id === id)
              if (!opt) return null
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                >
                  {opt.name}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      toggleOption(id)
                    }}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
          <div className="p-2 max-h-[240px] overflow-y-auto">
            {options.map(opt => (
              <div
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50",
                  selectedIds.includes(opt.id) && "bg-primary/5 text-primary"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                  selectedIds.includes(opt.id) ? "bg-primary border-primary" : "border-gray-300"
                )}>
                  {selectedIds.includes(opt.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span>{opt.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DeptNode {
  id: string
  name: string
  children?: DeptNode[]
  users: User[]
}

function NewScenarioEditForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const positionIdFromQuery = searchParams.get("positionId")
  const batchIdFromQuery = searchParams.get("batchId")

  const [allPositions, setAllPositions] = useState<PositionWithProfession[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [batches, setBatches] = useState<SceneBatch[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [deptTree, setDeptTree] = useState<DeptNode[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [scenarioName, setScenarioName] = useState("")
  const [scenarioCode, setScenarioCode] = useState(`SC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`)
  const [positionId, setPositionId] = useState(positionIdFromQuery || "")
  const [batchId, setBatchId] = useState(batchIdFromQuery || "")
  const [industryIds, setIndustryIds] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<number>(3)
  const [background, setBackground] = useState("")
  const [creatorName, setCreatorName] = useState("当前用户")
  const [coBuilderIds, setCoBuilderIds] = useState<string[]>([])
  const [version] = useState("v1.0")
  const [coverImage, setCoverImage] = useState("")
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [expandedDepts, setExpandedDepts] = useState<string[]>([])
  const [coBuilderSearch, setCoBuilderSearch] = useState("")
  const [isCoBuilderDialogOpen, setIsCoBuilderDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true)
      try {
        const [posRes, indRes, batchRes, userRes, orgTreeRes] = await Promise.all([
          positionApi.list({ limit: 1000 }),
          industryApi.list({ limit: 1000 }),
          sceneBatchApi.list({ limit: 1000 }),
          userManagementApi.list({ limit: 1000 }),
          orgApi.tree({}),
        ])
        const posList = posRes.items
        const indList = indRes.items
        const batchList = batchRes.items
        const userList = userRes.items

        setPositions(posList)
        setIndustries(indList)
        setBatches(batchList)
        setUsers(userList)

        const orgNodes = orgTreeRes.items || []
        const flatOrgs = flattenOrgTree(orgNodes)
        const tree: DeptNode[] = orgNodes.map((n: any) => ({
          id: n.id,
          name: n.name,
          children: n.children?.map((c: any) => ({ id: c.id, name: c.name, children: [], users: [] })) || [],
          users: userList.filter((u: User) => u.orgNodeId === n.id || u.orgNodeId && n.children?.some((c: any) => c.id === u.orgNodeId)),
        }))
        const expanded = orgNodes.slice(0, 5).map((n: any) => n.name)
        setDeptTree(tree)
        setExpandedDepts(expanded)
      } catch (err) {
        console.error("Failed to load form data", err)
        toast({ variant: "destructive", title: "数据加载失败", description: "请刷新页面重试" })
      } finally {
        setDataLoading(false)
      }
    }
    loadData()
  }, [])

  const setPositions = useCallback((list: CareerPosition[]) => {
    setAllPositions(list.map(p => ({
      ...p,
      industryName: industries.find(i => i.id === p.industryId)?.name || "其他",
    })))
  }, [industries])

  useEffect(() => {
    if (industries.length > 0 && allPositions.length > 0) {
      const updated = allPositions.map(p => ({
        ...p,
        industryName: industries.find(i => i.id === p.industryId)?.name || "其他",
      }))
      setAllPositions(updated)
    }
  }, [industries])

  const positioningGroups = useMemo(() => {
    const groups: Record<string, PositionWithProfession[]> = {}
    allPositions.forEach(p => {
      const key = p.industryName || "其他"
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return groups
  }, [allPositions])

  const selectedPosition = allPositions.find(p => p.id === positionId)

  const filteredUsers = useMemo(() => {
    if (!coBuilderSearch) return users
    return users.filter(u =>
      u.name.toLowerCase().includes(coBuilderSearch.toLowerCase())
    )
  }, [coBuilderSearch, users])

  const selectedCoBuilders = users.filter(u => coBuilderIds.includes(u.id))

  const batch = batches.find(b => b.id === batchId)

  const handleProceed = async () => {
    if (!scenarioName.trim()) return
    setIsSaving(true)
    try {
      const payload = {
        name: scenarioName.trim(),
        code: scenarioCode,
        careerPositionId: positionId || undefined,
        batchId: batchId || undefined,
        industryId: industryIds[0] || undefined,
        difficulty,
        background: background || undefined,
        version,
        coBuilderIds,
        status: "draft" as const,
        coverImage: coverImage || undefined,
      }
      const created = await scenarioApi.create(payload as any)
      toast({ title: "创建成功" })
      router.push(`/scene/scenarios/${created.id}/edit/tasks`)
    } catch (err: any) {
      toast({ variant: "destructive", title: "创建失败", description: err.message || "请稍后重试" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!scenarioName.trim()) return
    setIsSaving(true)
    try {
      const payload = {
        name: scenarioName.trim(),
        code: scenarioCode,
        careerPositionId: positionId || undefined,
        batchId: batchId || undefined,
        industryId: industryIds[0] || undefined,
        difficulty,
        background: background || undefined,
        version,
        coBuilderIds,
        status: "draft" as const,
        coverImage: coverImage || undefined,
      }
      const created = await scenarioApi.create(payload as any)
      toast({ title: "草稿已保存" })
      router.push(`/scene/scenarios/${created.id}/edit`)
    } catch (err: any) {
      toast({ variant: "destructive", title: "保存失败", description: err.message || "请稍后重试" })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleCoBuilder = (userId: string) => {
    setCoBuilderIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleDept = (deptName: string) => {
    setExpandedDepts(prev =>
      prev.includes(deptName) ? prev.filter(d => d !== deptName) : [...prev, deptName]
    )
  }

  const handleSelectPosition = (posId: string) => {
    setPositionId(posId)
  }

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      setCoverImage(res.url)
      toast({ title: "封面上传成功" })
    } catch (err: any) {
      console.error("Cover upload failed:", err)
      toast({ variant: "destructive", title: "封面上传失败", description: err?.message || "请稍后重试" })
    } finally {
      setCoverUploading(false)
    }
  }

  const triggerCoverUpload = () => {
    coverInputRef.current?.click()
  }

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <PrdAnnotation data={getAnnotation("editor-step1-cancel")}>
              <Button variant="ghost" size="sm" onClick={() => router.push("/scene")}>
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
            </PrdAnnotation>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">步骤 1</Badge>
              <span className="text-sm font-medium text-gray-800">基础信息编辑</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PrdAnnotation data={getAnnotation("editor-step1-save")}>
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving || !scenarioName}>
                <Save className="mr-2 h-4 w-4" />
                保存草稿
              </Button>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("editor-step1-preview")}>
              <Button variant="outline" size="sm" onClick={() => setIsPreviewDialogOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                预览
              </Button>
            </PrdAnnotation>
            <PrdAnnotation data={getAnnotation("editor-step1-next")}>
              <Button
                onClick={handleProceed}
                disabled={!scenarioName || isSaving}
              >
                {isSaving ? "保存中..." : "下一步"}
                {!isSaving && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </PrdAnnotation>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">新建实践场景</h1>
          <p className="text-sm text-gray-500 mt-1">填写场景基础信息，完成后进入任务链配置</p>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              <Card>
                <CardContent className="pt-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <PrdAnnotation data={getAnnotation("editor-field-position")} className="block">
                        <Label htmlFor="position">目标岗位</Label>
                      </PrdAnnotation>
                      <div className="relative">
                        <Select value={positionId} onValueChange={handleSelectPosition}>
                          <SelectTrigger id="position" className={positionId ? "pr-8" : ""}>
                            <SelectValue placeholder="请选择岗位" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(positioningGroups).map(([group, positions]) => (
                              <div key={group}>
                                <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">{group}</div>
                                {positions.map((pos) => (
                                  <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                        {positionId && (
                          <button
                            type="button"
                            onClick={() => setPositionId("")}
                            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <PrdAnnotation data={getAnnotation("editor-field-batch")} className="block">
                        <Label htmlFor="batch">所属批次</Label>
                      </PrdAnnotation>
                      <div className="relative">
                        <Select value={batchId} onValueChange={setBatchId}>
                          <SelectTrigger id="batch" className={batchId ? "pr-8" : ""}>
                            <SelectValue placeholder="请选择批次" />
                          </SelectTrigger>
                          <SelectContent>
                            {batches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {batchId && (
                          <button
                            type="button"
                            onClick={() => setBatchId("")}
                            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <PrdAnnotation data={getAnnotation("editor-field-name")} className="block">
                      <Label htmlFor="name">场景名称 <span className="text-red-500">*</span></Label>
                    </PrdAnnotation>
                    <Input
                      id="name"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="请输入场景名称"
                    />
                  </div>

                  <div className="grid gap-2">
                    <PrdAnnotation data={getAnnotation("editor-field-code")} className="block">
                      <Label htmlFor="code">场景编码</Label>
                    </PrdAnnotation>
                    <Input
                      id="code"
                      value={scenarioCode}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-400">系统自动生成，不可修改</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>面向行业</Label>
                      <IndustryProfessionSelector
                        options={industries.map(i => ({ id: i.id, name: i.name }))}
                        selectedIds={industryIds}
                        onChange={setIndustryIds}
                        placeholder="选择行业"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>适用专业</Label>
                      <Select value={positionId ? allPositions.find(p => p.id === positionId)?.majorIds?.[0] || "" : ""} disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="根据岗位自动填充" />
                        </SelectTrigger>
                        <SelectContent>
                          {(allPositions.find(p => p.id === positionId)?.majorIds || []).map((mid: string) => (
                            <SelectItem key={mid} value={mid}>{mid}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

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
                              "h-6 w-6 transition-colors",
                              level <= difficulty
                                ? "fill-amber-400 text-amber-400"
                                : "fill-gray-200 text-gray-200 hover:fill-amber-200 hover:text-amber-200"
                            )}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-gray-500">
                        {difficulty === 1 && "入门"}
                        {difficulty === 2 && "基础"}
                        {difficulty === 3 && "中级"}
                        {difficulty === 4 && "高级"}
                        {difficulty === 5 && "专家"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <PrdAnnotation data={getAnnotation("editor-field-intro")} className="block">
                      <Label htmlFor="background">场景介绍</Label>
                    </PrdAnnotation>
                    <div className="border rounded-lg">
                      <div className="bg-gray-50 border-b px-3 py-2 flex gap-1 items-center">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold">B</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs italic">I</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs underline">U</Button>
                        <div className="w-px bg-gray-200 mx-1 h-5" />
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <List className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <ListOrdered className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
                  <PrdAnnotation data={getAnnotation("editor-sidebar-cover")} className="block">
                    <Label className="mb-3 block">场景封面</Label>
                  </PrdAnnotation>
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
                        e.target.value = ""
                      }}
                    />
                    {coverImage ? (
                      <>
                        <img
                          src={coverImage}
                          alt="场景封面"
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
                            {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "更换封面"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/90 text-gray-800 border-white hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCoverImage("")
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
                        <p className="text-sm text-gray-500">{coverUploading ? "上传中..." : "点击上传封面图片"}</p>
                        <p className="text-xs text-gray-400 mt-1">建议尺寸 320x200，支持 jpg/png/webp</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <PrdAnnotation data={getAnnotation("editor-sidebar-creator")} className="block">
                      <Label className="text-gray-500 text-xs">创建人</Label>
                    </PrdAnnotation>
                    <p className="font-medium text-gray-800 mt-1">{creatorName}</p>
                  </div>

                  <div>
                    <PrdAnnotation data={getAnnotation("editor-sidebar-cobuilders")} className="block">
                      <Label className="mb-2 block">共建人/共建部门</Label>
                    </PrdAnnotation>

                    <div
                      className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setIsCoBuilderDialogOpen(true)}
                    >
                      {selectedCoBuilders.length === 0 ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <UserPlus className="h-4 w-4" />
                          <span className="text-sm">点击选择共建人</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedCoBuilders.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
                            >
                              <span>{user.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleCoBuilder(user.id)
                                }}
                                className="hover:bg-primary/20 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <PrdAnnotation data={getAnnotation("editor-sidebar-version")} className="block">
                      <Label className="text-gray-500 text-xs">当前版本号</Label>
                    </PrdAnnotation>
                    <p className="font-medium text-gray-800 mt-1">{version}</p>
                  </div>
                </CardContent>
              </Card>

              <Dialog open={isCoBuilderDialogOpen} onOpenChange={setIsCoBuilderDialogOpen}>
                <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <PrdAnnotation data={getAnnotation("dialog-cobuilder-select")}>
                      <div>
                        <DialogTitle>选择共建人/共建部门</DialogTitle>
                        <DialogDescription>
                          从组织架构中选择共建人，选中的用户将参与该场景的建设
                        </DialogDescription>
                      </div>
                    </PrdAnnotation>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden py-4">
                    <div className="border rounded-lg overflow-hidden h-full">
                      <div className="p-3 border-b bg-gray-50">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="搜索用户..."
                            value={coBuilderSearch}
                            onChange={(e) => setCoBuilderSearch(e.target.value)}
                            className="h-9 pl-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 divide-x" style={{ minHeight: 400, maxHeight: 500 }}>
                        <div className="flex flex-col">
                          <div className="px-3 py-2.5 bg-gray-50 border-b text-sm font-medium text-gray-500">
                            用户列表
                          </div>
                          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
                            {filteredUsers.map((user) => (
                              <div
                                key={user.id}
                                onClick={() => toggleCoBuilder(user.id)}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50",
                                  coBuilderIds.includes(user.id) && "bg-primary/5 text-primary"
                                )}
                              >
                                <div className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                                  coBuilderIds.includes(user.id) ? "bg-primary border-primary" : "border-gray-300"
                                )}>
                                  {coBuilderIds.includes(user.id) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="truncate">{user.name}</span>
                                <span className="text-xs text-gray-400 ml-auto">{user.username}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <div className="px-3 py-2.5 bg-gray-50 border-b text-sm font-medium text-gray-500 flex items-center justify-between">
                            <span>已选共建人</span>
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{selectedCoBuilders.length}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {selectedCoBuilders.length === 0 && (
                              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <UserPlus className="h-8 w-8 mb-2" />
                                <span className="text-sm">从左侧面板选择共建人</span>
                              </div>
                            )}
                            {selectedCoBuilders.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center gap-2 px-2 py-2 rounded text-sm bg-primary/5 text-primary"
                              >
                                <span className="flex-1 truncate">{user.name}</span>
                                <button
                                  onClick={() => toggleCoBuilder(user.id)}
                                  className="ml-1 hover:bg-primary/10 rounded-full p-0.5"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCoBuilderDialogOpen(false)}>
                      完成
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>场景基础信息预览</DialogTitle>
            <DialogDescription>预览当前填写的基础信息</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              {coverImage ? (
                <img src={coverImage} alt="场景封面" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="h-12 w-12 text-gray-300" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">场景名称</p>
                <p className="font-medium text-sm">{scenarioName || "未填写"}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">场景编码</p>
                <p className="font-medium text-sm">{scenarioCode}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">所属岗位</p>
                <p className="font-medium text-sm">{selectedPosition?.name || "未选择"}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">所属批次</p>
                <p className="font-medium text-sm">{batch?.name || "未选择"}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">面向行业</p>
                <p className="font-medium text-sm">{industryIds.length > 0 ? industryIds.map(id => industries.find(i => i.id === id)?.name).filter(Boolean).join("、") : "未选择"}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">难度等级</p>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("h-4 w-4", i < difficulty ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">场景介绍</p>
              <p className="text-sm">{background || "暂无介绍"}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">创建人</p>
              <p className="font-medium text-sm">{creatorName}</p>
              {selectedCoBuilders.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">共建人</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedCoBuilders.map(t => (
                      <Badge key={t.id} variant="secondary" className="text-xs">{t.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function flattenOrgTree(nodes: any[]): any[] {
  const result: any[] = []
  function walk(list: any[]) {
    list.forEach(n => {
      result.push(n)
      if (n.children?.length) walk(n.children)
    })
  }
  walk(nodes)
  return result
}

export default function NewScenarioEditPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
      <NewScenarioEditForm />
    </Suspense>
  )
}
