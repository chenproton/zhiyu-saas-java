"use client"

import { useState } from "react"
import { Lightbulb, Plus, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"
import { KnowledgePointFormDialog } from "@/components/shared/knowledge-point-form-dialog"
import { GranularLessonSelectDialog } from "@/components/shared/granular-lesson-select-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { courseApi } from "@/lib/api"

const knowledgePoints: any[] = []
const granularLessons: any[] = []
const customKnowledgePointIds = new Set<string>()

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

interface TaskState {
  knowledgePoints: string[]
  descriptionPdf?: string | null
  description?: string
}

interface TaskKnowledgeCardProps {
  state: TaskState
  updateState: (u: Partial<TaskState>) => void
  kpSearch: string
  setKpSearch: (v: string) => void
  kpDetailOpen: boolean
  setKpDetailOpen: (v: boolean) => void
  selectedKpForDetail: string | null
  setSelectedKpForDetail: (v: string | null) => void
  kpFormOpen: boolean
  setKpFormOpen: (v: boolean) => void
  kpFormMode: "add" | "clone" | "edit"
  setKpFormMode: (v: "add" | "clone" | "edit") => void
  kpFormTarget: (typeof knowledgePoints)[0] | null
  setKpFormTarget: (v: (typeof knowledgePoints)[0] | null) => void
  kpFormInitial: { name: string; description: string; code: string; granularLessonIds: string[] }
  setKpFormInitial: (v: { name: string; description: string; code: string; granularLessonIds: string[] } | ((prev: { name: string; description: string; code: string; granularLessonIds: string[] }) => { name: string; description: string; code: string; granularLessonIds: string[] })) => void
  glSelectOpen: boolean
  setGlSelectOpen: (v: boolean) => void
  glSelectTargetKp: string | null
  setGlSelectTargetKp: (v: string | null) => void
}

export function TaskKnowledgeCard({
  state,
  updateState,
  kpSearch,
  setKpSearch,
  kpDetailOpen,
  setKpDetailOpen,
  selectedKpForDetail,
  setSelectedKpForDetail,
  kpFormOpen,
  setKpFormOpen,
  kpFormMode,
  setKpFormMode,
  kpFormTarget,
  setKpFormTarget,
  kpFormInitial,
  setKpFormInitial,
  glSelectOpen,
  setGlSelectOpen,
  glSelectTargetKp,
  setGlSelectTargetKp,
}: TaskKnowledgeCardProps) {
  const [granularConfirm, setGranularConfirm] = useState<{ open: boolean; courseId: string }>({ open: false, courseId: "" })

  const filteredKp = knowledgePoints.filter(k => !kpSearch || (k.name || "").includes(kpSearch) || (k.description || "").includes(kpSearch) || (k.code || "").includes(kpSearch))
  const hasResults = kpSearch ? filteredKp.length > 0 : false

  const generateKpCode = () => `KP-${Date.now().toString().slice(-6)}`

  const handleReferenceKp = (kpId: string) => {
    if (state.knowledgePoints.includes(kpId)) return
    updateState({ knowledgePoints: [...state.knowledgePoints, kpId] })
  }

  const handleRemoveKp = (kpId: string) => {
    updateState({ knowledgePoints: state.knowledgePoints.filter(x => x !== kpId) })
  }

  const openAddKp = () => {
    setKpFormMode("add")
    setKpFormTarget(null)
    setKpFormInitial({ name: kpSearch, description: "", code: generateKpCode(), granularLessonIds: [] })
    setKpFormOpen(true)
  }

  const openCloneKp = (kp: (typeof knowledgePoints)[0]) => {
    setKpFormMode("clone")
    setKpFormTarget(kp)
    setKpFormInitial({ name: `${kp.name}（克隆）`, description: kp.description || "", code: generateKpCode(), granularLessonIds: kp.granularLessons || [] })
    setKpFormOpen(true)
  }

  const openEditKp = (kp: (typeof knowledgePoints)[0]) => {
    setKpFormMode("edit")
    setKpFormTarget(kp)
    setKpFormInitial({ name: kp.name, description: kp.description || "", code: kp.code || generateKpCode(), granularLessonIds: kp.granularLessons || [] })
    setKpFormOpen(true)
  }

  const handleSaveKp = (values: { name: string; description: string; code: string; granularLessonIds: string[] }) => {
    if (kpFormMode === "edit" && kpFormTarget) {
      const kp = knowledgePoints.find(k => k.id === kpFormTarget.id)
      if (kp) {
        kp.name = values.name.trim()
        kp.description = values.description.trim()
        kp.code = values.code
        kp.granularLessons = values.granularLessonIds
      }
      setKpFormOpen(false)
      return
    }
    const newId = generateUUID()
    const newKp = {
      id: newId,
      name: values.name.trim(),
      description: values.description.trim(),
      code: values.code,
      granularLessons: values.granularLessonIds,
    }
    knowledgePoints.push(newKp as any)
    customKnowledgePointIds.add(newId)
    updateState({ knowledgePoints: [...state.knowledgePoints, newId] })
    setKpFormOpen(false)
    setKpSearch("")
  }

  const handleCreateGranularLesson = async (): Promise<string | undefined> => {
    const baseName = kpFormInitial.name || "新建颗粒课"
    try {
      const created = await courseApi.create({
        name: `基于「${baseName}」的颗粒课`,
        type: "granular",
        category: "专业基础",
      } as any)
      const newCourseId = created.id
      granularLessons.push({ id: newCourseId, name: created.name, code: created.code, description: created.description })
      setKpFormInitial(prev => ({ ...prev, granularLessonIds: [...prev.granularLessonIds, newCourseId] }))
      if (kpFormMode === "edit" && kpFormTarget) {
        const kp = knowledgePoints.find(k => k.id === kpFormTarget.id)
        if (kp) {
          kp.granularLessons = [...(kp.granularLessons || []), newCourseId]
          updateState({ knowledgePoints: [...state.knowledgePoints] })
        }
      }
      setGranularConfirm({ open: true, courseId: newCourseId })
      return newCourseId
    } catch (err: any) {
      return undefined
    }
  }

  const openGlSelect = (kpId: string) => {
    setGlSelectTargetKp(kpId)
    setGlSelectOpen(true)
  }

  const handleToggleGlForKp = (glIds: string[]) => {
    const kp = knowledgePoints.find(k => k.id === glSelectTargetKp)
    if (!kp) return
    kp.granularLessons = glIds
    updateState({ knowledgePoints: [...state.knowledgePoints] })
  }

  const detailKp = selectedKpForDetail ? knowledgePoints.find(k => k.id === selectedKpForDetail) : null
  const detailGranularLessons = detailKp?.granularLessons?.map((gid: any) => granularLessons.find((g: any) => g.id === gid)).filter(Boolean) || []

  const glTargetKp = glSelectTargetKp ? knowledgePoints.find(k => k.id === glSelectTargetKp) : null
  const glSelectedIds = glTargetKp?.granularLessons || []

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={kpSearch}
            onChange={e => setKpSearch(e.target.value)}
            placeholder="搜索知识点名称、描述或编码..."
            className="pl-9"
          />
        </div>
        <Button onClick={openAddKp}>
          <Plus className="h-4 w-4 mr-1" />新增知识点
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Search Results */}
        <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
          <p className="text-sm font-medium mb-3 text-gray-700">
            {kpSearch ? `搜索结果 (${filteredKp.length})` : "全部知识点"}
          </p>
          <div className="flex-1 overflow-y-auto pr-1">
            {!kpSearch && filteredKp.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">请输入关键词搜索知识点</p>
              </div>
            )}
            {kpSearch && !hasResults && (
              <div className="p-6 text-center text-gray-500 text-sm border border-dashed rounded-lg">
                <p className="mb-2">未找到 &quot;{kpSearch}&quot; 相关的知识点</p>
                <Button variant="outline" size="sm" onClick={openAddKp}>
                  <Plus className="h-3 w-3 mr-1" />新增此知识点
                </Button>
              </div>
            )}
            {filteredKp.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[28%]">知识点名称</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[18%]">知识点编码</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[34%]">知识点描述</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredKp.map(kp => {
                    const isSelected = state.knowledgePoints.includes(kp.id)
                    return (
                      <tr key={kp.id} className={cn("hover:bg-gray-50 transition-colors", isSelected ? "bg-primary/[0.03]" : "")}>
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium text-gray-800">{kp.name}</span>
                        </td>
                        <td className="px-3 py-2">
                          {kp.code ? (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{kp.code}</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-xs text-gray-500 line-clamp-1" title={kp.description}>{kp.description}</p>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <PrdAnnotation data={getAnnotation("kp-action-detail")}>
                              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary" onClick={() => { setSelectedKpForDetail(kp.id); setKpDetailOpen(true) }}>
                                详情
                              </Button>
                            </PrdAnnotation>
                            {isSelected ? (
                              <PrdAnnotation data={getAnnotation("kp-action-cancel")}>
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => handleRemoveKp(kp.id)}>
                                  取消
                                </Button>
                              </PrdAnnotation>
                            ) : (
                              <>
                                <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => handleReferenceKp(kp.id)}>
                                  引用
                                </Button>
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => openCloneKp(kp)}>
                                  克隆
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Selected Knowledge Points - Compact Grid */}
        <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
          <p className="text-sm font-medium mb-3 text-gray-700">已选择知识点 ({state.knowledgePoints.length})</p>
          <div className="flex-1 overflow-y-auto">
            {state.knowledgePoints.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">从左侧搜索并选择知识点</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {state.knowledgePoints.map(kpId => {
                  const kp = knowledgePoints.find(k => k.id === kpId)
                  if (!kp) return null
                  const isReference = !customKnowledgePointIds.has(kpId)
                  const kpGlNames = kp.granularLessons?.map((gid: any) => granularLessons.find((g: any) => g.id === gid)?.name).filter(Boolean) || []
                  return (
                    <div key={kpId} className={cn(
                      "p-2 rounded-lg border cursor-pointer transition-colors relative overflow-hidden",
                      isReference
                        ? "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        : "border-primary/20 bg-primary/5 hover:bg-primary/10"
                    )} onClick={() => {
                      if (isReference) {
                        setSelectedKpForDetail(kp.id)
                        setKpDetailOpen(true)
                      } else {
                        openEditKp(kp)
                      }
                    }}>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-medium flex-1 truncate">{kp.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 -mr-1 -mt-1" onClick={(e) => { e.stopPropagation(); handleRemoveKp(kpId) }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-1 mb-1">{kp.description}</p>
                      {kpGlNames.length > 0 && (
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {kpGlNames.slice(0, 2).map((name: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px] font-normal px-1 py-0 h-4">{name}</Badge>
                          ))}
                          {kpGlNames.length > 2 && <span className="text-[9px] text-gray-400">+{kpGlNames.length - 2}</span>}
                        </div>
                      )}
                      {isReference && (
                        <div className="absolute bottom-0 right-0">
                          <div className="bg-gray-200 text-gray-600 text-[9px] px-1.5 py-0.5 rounded-tl-md border-t border-l border-white/80">
                            引用
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <KnowledgePointFormDialog
        open={kpFormOpen}
        onOpenChange={setKpFormOpen}
        mode={kpFormMode}
        initialValues={kpFormInitial}
        granularCourses={granularLessons}
        onSave={handleSaveKp}
        onCreateGranularLesson={handleCreateGranularLesson}
      />

      <GranularLessonSelectDialog
        open={glSelectOpen}
        onOpenChange={setGlSelectOpen}
        title={glTargetKp ? `为「${glTargetKp.name}」选择颗粒课` : "选择颗粒课"}
        granularCourses={granularLessons}
        selectedIds={glSelectedIds}
        onChange={handleToggleGlForKp}
      />

      {/* Knowledge Point Detail Dialog */}
      <Dialog open={kpDetailOpen} onOpenChange={setKpDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <PrdAnnotation data={getAnnotation("dialog-knowledge-detail")}>
              <DialogTitle>知识点详情</DialogTitle>
            </PrdAnnotation>
          </DialogHeader>
          {detailKp && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500">知识点名称</Label>
                {!customKnowledgePointIds.has(detailKp.id) && (
                  <Badge variant="secondary" className="text-[10px] h-5">引用（不可编辑）</Badge>
                )}
                {customKnowledgePointIds.has(detailKp.id) && (
                  <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">自定义（可编辑）</Badge>
                )}
              </div>
              <p className="text-sm font-medium">{detailKp.name}</p>
              <div>
                <Label className="text-xs text-gray-500">知识点描述</Label>
                <p className="text-sm text-gray-700 mt-1">{detailKp.description}</p>
              </div>
              {detailKp.code && (
                <div>
                  <Label className="text-xs text-gray-500">编码</Label>
                  <p className="text-sm text-gray-700 mt-1">{detailKp.code}</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500">关联颗粒课</Label>
                  {customKnowledgePointIds.has(detailKp.id) && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 text-primary" onClick={() => { setKpDetailOpen(false); openGlSelect(detailKp.id) }}>
                        引用颗粒课
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 text-primary" onClick={async () => {
                        try {
                          const created = await courseApi.create({
                            name: `基于「${detailKp.name}」的颗粒课`,
                            type: "granular",
                            category: "专业基础",
                          } as any)
                          const newCourseId = created.id
                          granularLessons.push({ id: newCourseId, name: created.name, code: created.code, description: created.description })
                          const kp = knowledgePoints.find(k => k.id === detailKp.id)
                          if (kp) {
                            kp.granularLessons = [...(kp.granularLessons || []), newCourseId]
                            updateState({ knowledgePoints: [...state.knowledgePoints] })
                          }
                          setGranularConfirm({ open: true, courseId: newCourseId })
                        } catch (err: any) {
                        }
                      }}>
                        新增颗粒课
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detailGranularLessons.length > 0 ? detailGranularLessons.map((gl: any) => (
                    <Badge key={gl!.id} variant="outline" className="text-xs">{gl!.name}</Badge>
                  )) : <p className="text-sm text-gray-400">暂无关联颗粒课</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={granularConfirm.open}
        onOpenChange={(open) => setGranularConfirm(prev => ({ ...prev, open }))}
        title="前往完善颗粒课"
        description="占位颗粒课已创建并关联，是否立即前往完善？"
        onConfirm={() => {
          window.open(`/lesson/admin/granular/add?id=${granularConfirm.courseId}`, "_blank")
          setGranularConfirm(prev => ({ ...prev, open: false }))
        }}
      />
    </div>
  )
}
