'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, Plus, Search, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { courseApi } from '@/lib/api'
import type { Course, KnowledgePointItem } from '@/lib/types/lesson'

function generateKpCode() {
  return `KP-${Date.now().toString().slice(-6)}`
}

interface KnowledgeSelectorProps {
  selected: KnowledgePointItem[]
  pool: KnowledgePointItem[]
  onChange?: (selected: KnowledgePointItem[]) => void
  onAddCustom?: (name: string, description?: string) => void
  standalone?: boolean
}

const SCENES = [
  { id: 'all', name: '全部场景' },
  { id: 'web-security', name: 'Web安全实战' },
  { id: 'data-analysis', name: '数据分析项目' },
  { id: 'network-attack', name: '网络攻防演练' },
  { id: 'dev-standard', name: '软件开发规范' },
]

const SCENE_KNOWLEDGE_MAP: Record<string, string[]> = {
  'web-security': ['kp-1', 'kp-2', 'kp-3', 'kp-4', 'kp-5'],
  'data-analysis': ['kp-6', 'kp-7', 'kp-8'],
  'network-attack': ['kp-1', 'kp-5', 'kp-6', 'kp-10'],
  'dev-standard': ['kp-9', 'kp-10'],
}

const POSITIONS = [
  { id: 'all', name: '全部岗位' },
  { id: 'frontend', name: '前端开发工程师' },
  { id: 'backend', name: '后端开发工程师' },
  { id: 'security', name: '安全测试工程师' },
  { id: 'data', name: '数据分析师' },
]

const TASKS = [
  { id: 'all', name: '全部任务' },
  { id: 'task-sql-inject', name: 'SQL注入漏洞挖掘' },
  { id: 'task-xss', name: 'XSS攻击与防御' },
  { id: 'task-data-clean', name: '数据清洗与预处理' },
  { id: 'task-model-train', name: '回归模型训练' },
  { id: 'task-penetration', name: '渗透测试演练' },
  { id: 'task-code-review', name: '安全代码审查' },
  { id: 'task-visualize', name: '数据可视化报告' },
  { id: 'task-component', name: '业务组件封装' },
]

const TASK_SCENE_MAP: Record<string, string[]> = {
  'task-sql-inject': ['web-security', 'network-attack'],
  'task-xss': ['web-security'],
  'task-data-clean': ['data-analysis'],
  'task-model-train': ['data-analysis'],
  'task-penetration': ['network-attack', 'web-security'],
  'task-code-review': ['dev-standard', 'web-security'],
  'task-visualize': ['data-analysis'],
  'task-component': ['dev-standard'],
}

export function KnowledgeSelector({
  selected,
  pool,
  onChange,
  onAddCustom,
  standalone = true,
}: KnowledgeSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [kpSearch, setKpSearch] = useState('')
  const [sceneFilter, setSceneFilter] = useState('all')
  const [positionFilter, setPositionFilter] = useState('all')
  const [taskFilter, setTaskFilter] = useState('all')
  const [kpDetailOpen, setKpDetailOpen] = useState(false)
  const [selectedKpForDetail, setSelectedKpForDetail] = useState<string | null>(null)

  const [kpActionOpen, setKpActionOpen] = useState(false)
  const [kpActionMode, setKpActionMode] = useState<'add' | 'clone' | 'edit' | null>(null)
  const [kpActionTarget, setKpActionTarget] = useState<KnowledgePointItem | null>(null)
  const [newKpForm, setNewKpForm] = useState<{
    name: string
    description: string
    code: string
    granularLessons: string[]
  }>({ name: '', description: '', code: '', granularLessons: [] })

  const [glSelectOpen, setGlSelectOpen] = useState(false)
  const [glSelectTargetKp, setGlSelectTargetKp] = useState<string | null>(null)
  const [glSearch, setGlSearch] = useState('')
  const [granularCourses, setGranularCourses] = useState<Course[]>([])

  useEffect(() => {
    courseApi
      .list({ type: 'granular' })
      .then((res) => {
        setGranularCourses(res.items || [])
      })
      .catch(() => setGranularCourses([]))
  }, [])

  const isReferenceKp = (kp: KnowledgePointItem) => kp.linked

  const sceneKpIds = sceneFilter === 'all' ? null : SCENE_KNOWLEDGE_MAP[sceneFilter]
  const filtered = pool.filter(
    (kp) =>
      (!sceneKpIds || sceneKpIds.includes(kp.id)) &&
      (!kpSearch ||
        kp.name.includes(kpSearch) ||
        (kp.description && kp.description.includes(kpSearch)) ||
        (kp.code && kp.code.includes(kpSearch))),
  )

  const hasResults = kpSearch ? filtered.length > 0 : false

  const handleReferenceKp = (kp: KnowledgePointItem) => {
    if (selected.find((s) => s.id === kp.id)) return
    onChange?.([...selected, kp])
  }

  const handleRemoveKp = (kpId: string) => {
    onChange?.(selected.filter((s) => s.id !== kpId))
  }

  const openAddKp = () => {
    setNewKpForm({ name: kpSearch, description: '', code: generateKpCode(), granularLessons: [] })
    setKpActionMode('add')
    setKpActionTarget(null)
    setKpActionOpen(true)
  }

  const openCloneKp = (kp: KnowledgePointItem) => {
    setNewKpForm({
      name: `${kp.name}（克隆）`,
      description: kp.description || '',
      code: generateKpCode(),
      granularLessons: kp.granularLessons || [],
    })
    setKpActionMode('clone')
    setKpActionTarget(kp)
    setKpActionOpen(true)
  }

  const openEditKp = (kp: KnowledgePointItem) => {
    setNewKpForm({
      name: kp.name,
      description: kp.description || '',
      code: kp.code || generateKpCode(),
      granularLessons: kp.granularLessons || [],
    })
    setKpActionMode('edit')
    setKpActionTarget(kp)
    setKpActionOpen(true)
  }

  const handleSaveKp = () => {
    if (!newKpForm.name.trim()) return
    if (kpActionMode === 'edit' && kpActionTarget) {
      const updated = selected.map((s) =>
        s.id === kpActionTarget.id
          ? {
              ...s,
              name: newKpForm.name.trim(),
              description: newKpForm.description.trim(),
              code: newKpForm.code,
              granularLessons: newKpForm.granularLessons,
            }
          : s,
      )
      onChange?.(updated)
      setKpActionOpen(false)
      return
    }
    const newId = `kp-custom-${Date.now()}`
    const newKp: KnowledgePointItem = {
      id: newId,
      name: newKpForm.name.trim(),
      description: newKpForm.description.trim(),
      code: newKpForm.code,
      linked: false,
      granularLessons: newKpForm.granularLessons,
    }
    onAddCustom?.(newKp.name, newKp.description)
    onChange?.([...selected, newKp])
    setKpActionOpen(false)
    setKpSearch('')
  }

  const openGlSelect = (kpId: string) => {
    setGlSelectTargetKp(kpId)
    setGlSearch('')
    setGlSelectOpen(true)
  }

  const handleToggleGlForKp = (kpId: string, glId: string) => {
    const updated = selected.map((s) => {
      if (s.id !== kpId) return s
      const current = s.granularLessons || []
      const updatedGl = current.includes(glId)
        ? current.filter((x) => x !== glId)
        : [...current, glId]
      return { ...s, granularLessons: updatedGl }
    })
    onChange?.(updated)
  }

  const detailKp = selectedKpForDetail
    ? selected.find((s) => s.id === selectedKpForDetail) ||
      pool.find((p) => p.id === selectedKpForDetail)
    : null
  const detailGranularLessons =
    detailKp?.granularLessons
      ?.map((gid) => granularCourses.find((g) => g.id === gid))
      .filter(Boolean) || []

  const glFiltered = granularCourses.filter(
    (g) => !glSearch || g.name.includes(glSearch) || (g.code && g.code.includes(glSearch)),
  )
  const glTargetKp = glSelectTargetKp
    ? selected.find((s) => s.id === glSelectTargetKp) || null
    : null
  const glSelectedIds =
    glSelectTargetKp === 'new-kp' ? newKpForm.granularLessons : glTargetKp?.granularLessons || []

  const selectionPanels = (
    <div className={cn('flex gap-4', standalone ? 'h-[480px]' : 'h-full min-h-0')}>
      {/* Left: Search Results */}
      <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={kpSearch}
              onChange={(e) => setKpSearch(e.target.value)}
              placeholder="搜索知识点名称、描述或编码..."
              className="pl-9"
            />
          </div>
          <Button onClick={openAddKp}>
            <Plus className="h-4 w-4 mr-1" />
            新增知识点
          </Button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 shrink-0">场景/任务筛选</span>
          <Select
            value={sceneFilter}
            onValueChange={(v) => {
              setSceneFilter(v)
              if (
                taskFilter !== 'all' &&
                v !== 'all' &&
                TASK_SCENE_MAP[taskFilter] &&
                !TASK_SCENE_MAP[taskFilter].includes(v)
              ) {
                setTaskFilter('all')
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="选择场景" />
            </SelectTrigger>
            <SelectContent>
              {SCENES.map((scene) => (
                <SelectItem key={scene.id} value={scene.id} className="text-xs">
                  {scene.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-gray-300 shrink-0">▸</span>
          <Select
            value={taskFilter}
            onValueChange={(v) => {
              setTaskFilter(v)
              if (v !== 'all' && TASK_SCENE_MAP[v] && !TASK_SCENE_MAP[v].includes(sceneFilter)) {
                setSceneFilter(TASK_SCENE_MAP[v][0] || 'all')
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="选择任务" />
            </SelectTrigger>
            <SelectContent>
              {TASKS.filter(
                (t) =>
                  t.id === 'all' ||
                  sceneFilter === 'all' ||
                  (TASK_SCENE_MAP[t.id] && TASK_SCENE_MAP[t.id].includes(sceneFilter)),
              ).map((task) => (
                <SelectItem key={task.id} value={task.id} className="text-xs">
                  {task.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 shrink-0">岗位筛选</span>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="选择岗位" />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((pos) => (
                <SelectItem key={pos.id} value={pos.id} className="text-xs">
                  {pos.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          {!kpSearch && filtered.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">请输入关键词搜索知识点</p>
            </div>
          )}
          {kpSearch && !hasResults && (
            <div className="p-6 text-center text-gray-500 text-sm border border-dashed rounded-lg">
              <p className="mb-2">未找到 &quot;{kpSearch}&quot; 相关的知识点</p>
              <Button variant="outline" size="sm" onClick={openAddKp}>
                <Plus className="h-3 w-3 mr-1" />
                新增此知识点
              </Button>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[28%]">
                    知识点名称
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[18%]">
                    知识点编码
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-[34%]">
                    知识点描述
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-[20%]">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((kp) => {
                  const isSelected = selected.some((s) => s.id === kp.id)
                  return (
                    <tr
                      key={kp.id}
                      className={cn(
                        'hover:bg-gray-50 transition-colors',
                        isSelected ? 'bg-primary/[0.03]' : '',
                      )}
                    >
                      <td className="px-3 py-2">
                        <span className="text-sm font-medium text-gray-800">{kp.name}</span>
                      </td>
                      <td className="px-3 py-2">
                        {kp.code ? (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                            {kp.code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-gray-500 line-clamp-1" title={kp.description}>
                          {kp.description}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-1.5 text-gray-500 hover:text-primary"
                            onClick={() => {
                              setSelectedKpForDetail(kp.id)
                              setKpDetailOpen(true)
                            }}
                          >
                            详情
                          </Button>
                          {isSelected ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2"
                              onClick={() => handleRemoveKp(kp.id)}
                            >
                              取消
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                className="h-6 text-[11px] px-2"
                                onClick={() => handleReferenceKp(kp)}
                              >
                                引用
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] px-2"
                                onClick={() => openCloneKp(kp)}
                              >
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
            </div>
          )}
        </div>
      </div>

      {/* Right: Selected Knowledge Points */}
      <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
        <p className="text-sm font-medium mb-3 text-gray-700">已选择知识点 ({selected.length})</p>
        <div className="flex-1 overflow-y-auto">
          {selected.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">从左侧搜索并选择知识点</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {selected.map((kp) => {
                const isReference = isReferenceKp(kp)
                const kpGlNames =
                  kp.granularLessons
                    ?.map((gid) => granularCourses.find((g) => g.id === gid)?.name)
                    .filter(Boolean) || []
                return (
                  <div
                    key={kp.id}
                    className={cn(
                      'p-2 rounded-lg border cursor-pointer transition-colors relative overflow-hidden',
                      isReference
                        ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        : 'border-primary/20 bg-primary/5 hover:bg-primary/10',
                    )}
                    onClick={() => {
                      if (isReference) {
                        setSelectedKpForDetail(kp.id)
                        setKpDetailOpen(true)
                      } else {
                        openEditKp(kp)
                      }
                    }}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium flex-1 truncate">{kp.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-gray-400 -mr-1 -mt-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveKp(kp.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-1 mb-1">{kp.description}</p>
                    {kpGlNames.length > 0 && (
                      <div className="flex items-center gap-0.5 flex-wrap">
                        {kpGlNames.slice(0, 2).map((name, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[9px] font-normal px-1 py-0 h-4"
                          >
                            {name}
                          </Badge>
                        ))}
                        {kpGlNames.length > 2 && (
                          <span className="text-[9px] text-gray-400">+{kpGlNames.length - 2}</span>
                        )}
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
  )

  const subDialogs = (
    <>
      {/* Add / Clone / Edit Knowledge Dialog */}
      <Dialog open={kpActionOpen} onOpenChange={setKpActionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {kpActionMode === 'add'
                ? '新增知识点'
                : kpActionMode === 'clone'
                  ? '克隆知识点'
                  : '编辑知识点'}
            </DialogTitle>
            <DialogDescription>
              {kpActionMode === 'add'
                ? '创建一个新的知识点'
                : kpActionMode === 'clone'
                  ? `基于「${kpActionTarget?.name}」创建副本`
                  : '修改知识点信息'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>知识点名称</Label>
              <Input
                value={newKpForm.name}
                onChange={(e) => setNewKpForm({ ...newKpForm, name: e.target.value })}
                placeholder="输入知识点名称"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={newKpForm.description}
                onChange={(e) => setNewKpForm({ ...newKpForm, description: e.target.value })}
                placeholder="输入知识点描述"
                className="mt-1.5"
                rows={3}
              />
            </div>
            <div>
              <Label>编码</Label>
              <Input
                value={newKpForm.code}
                disabled={kpActionMode !== 'edit'}
                onChange={(e) => setNewKpForm({ ...newKpForm, code: e.target.value })}
                className={cn('mt-1.5', kpActionMode !== 'edit' && 'bg-gray-50')}
              />
              <p className="text-xs text-gray-400 mt-1">
                {kpActionMode === 'edit' ? '可修改编码' : '系统自动生成，不可修改'}
              </p>
            </div>
            <div>
              <Label>关联颗粒课</Label>
              <div className="mt-1.5">
                {newKpForm.granularLessons.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newKpForm.granularLessons.map((gid) => {
                      const gl = granularCourses.find((g) => g.id === gid)
                      return gl ? (
                        <Badge key={gid} variant="secondary" className="text-xs gap-1">
                          {gl.name}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() =>
                              setNewKpForm({
                                ...newKpForm,
                                granularLessons: newKpForm.granularLessons.filter((x) => x !== gid),
                              })
                            }
                          />
                        </Badge>
                      ) : null
                    })}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setGlSelectTargetKp('new-kp')
                      setGlSearch('')
                      setGlSelectOpen(true)
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    选择颗粒课
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpActionOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveKp} disabled={!newKpForm.name.trim()}>
              {kpActionMode === 'add'
                ? '新增并选中'
                : kpActionMode === 'clone'
                  ? '克隆并选中'
                  : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Granular Lesson Selection Dialog */}
      <Dialog open={glSelectOpen} onOpenChange={setGlSelectOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {glTargetKp ? `为「${glTargetKp.name}」选择颗粒课` : '选择颗粒课'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 flex-1 min-h-0 py-4">
            <div className="w-3/5 flex flex-col min-h-0 border rounded-xl p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={glSearch}
                  onChange={(e) => setGlSearch(e.target.value)}
                  placeholder="搜索颗粒课名称或编码..."
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {glFiltered.map((gl) => {
                  const isSelected = glSelectedIds.includes(gl.id)
                  return (
                    <div
                      key={gl.id}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300',
                      )}
                      onClick={() => {
                        if (glSelectTargetKp === 'new-kp') {
                          setNewKpForm((prev) => {
                            const current = prev.granularLessons
                            const updated = current.includes(gl.id)
                              ? current.filter((x) => x !== gl.id)
                              : [...current, gl.id]
                            return { ...prev, granularLessons: updated }
                          })
                        } else if (glSelectTargetKp) {
                          handleToggleGlForKp(glSelectTargetKp, gl.id)
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center',
                            isSelected ? 'bg-primary border-primary' : 'border-gray-300',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-sm font-medium flex-1">{gl.name}</span>
                        {gl.code && (
                          <Badge variant="outline" className="text-[10px]">
                            {gl.code}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">{gl.description}</p>
                    </div>
                  )
                })}
                {glFiltered.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-sm">未找到匹配的颗粒课</p>
                  </div>
                )}
              </div>
            </div>
            <div className="w-2/5 border rounded-xl p-3 flex flex-col min-h-0">
              <p className="text-sm font-medium mb-3 text-gray-700">
                已选择 ({glSelectedIds.length})
              </p>
              <div className="flex-1 overflow-y-auto space-y-2">
                {glSelectedIds.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-xs">从左侧选择颗粒课</p>
                  </div>
                ) : (
                  glSelectedIds.map((gid) => {
                    const gl = granularCourses.find((g) => g.id === gid)
                    if (!gl) return null
                    return (
                      <div
                        key={gid}
                        className="flex items-center gap-2 p-2 rounded border bg-gray-50"
                      >
                        <span className="text-sm flex-1 truncate">{gl.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400"
                          onClick={() => {
                            if (glSelectTargetKp === 'new-kp') {
                              setNewKpForm((prev) => ({
                                ...prev,
                                granularLessons: prev.granularLessons.filter((x) => x !== gid),
                              }))
                            } else if (glSelectTargetKp) {
                              handleToggleGlForKp(glSelectTargetKp, gid)
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setGlSelectOpen(false)}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge Point Detail Dialog */}
      <Dialog open={kpDetailOpen} onOpenChange={setKpDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>知识点详情</DialogTitle>
          </DialogHeader>
          {detailKp && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500">知识点名称</Label>
                {isReferenceKp(detailKp) ? (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    引用（不可编辑）
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 border-primary/30 text-primary"
                  >
                    自定义（可编辑）
                  </Badge>
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
                  {!isReferenceKp(detailKp) && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2 text-primary"
                        onClick={() => {
                          setKpDetailOpen(false)
                          openGlSelect(detailKp.id)
                        }}
                      >
                        引用颗粒课
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detailGranularLessons.length > 0 ? (
                    detailGranularLessons.map((gl: any) => (
                      <Badge key={gl!.id} variant="outline" className="text-xs">
                        {gl!.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">暂无关联颗粒课</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpDetailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (!standalone) {
    return (
      <>
        {selectionPanels}
        {subDialogs}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((kp) => (
            <Badge
              key={kp.id}
              variant="secondary"
              className={cn(
                'px-2.5 py-1 text-xs font-normal hover:cursor-pointer',
                isReferenceKp(kp)
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
              )}
            >
              {kp.name}
              <button
                className="ml-1 text-indigo-400 hover:text-indigo-700"
                onClick={() => handleRemoveKp(kp.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add button + dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full border-dashed">
            <Plus className="mr-2 h-4 w-4" />
            添加知识点
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[1075px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加知识点</DialogTitle>
            <DialogDescription>从知识库中选择或新建知识点</DialogDescription>
          </DialogHeader>

          {selectionPanels}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {subDialogs}
    </div>
  )
}
