'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Sparkles,
  GraduationCap,
  Briefcase,
  Eye,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Search,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PositionType, Position, Batch, PositionRecommendation } from '@/lib/types/job-source'
import { POSITION_TYPE_LABELS } from '@/lib/types/job-source'
import { positionApi, batchApi, recommendApi, majorApi, industryApi } from '@/lib/api'
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
  convertApiRecommendationToLocal,
} from '@/lib/stores/job-converters'
import type { PositionRecommendation as ApiPositionRecommendation } from '@/lib/types/job'
import { useToast } from '@/hooks/use-toast'

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PostRecommendPage() {
  const { toast } = useToast()
  const { user } = useAuth()

  const [positions, setPositions] = useState<Position[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [recommendations, setRecommendations] = useState<PositionRecommendation[]>([])
  const [majorNameToId, setMajorNameToId] = useState<Record<string, string>>({})
  const [industryMap, setIndustryMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)

  const [selectedMajor, setSelectedMajor] = useState<string>('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedPositionId, setSelectedPositionId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [isVisibleNew, setIsVisibleNew] = useState(true)
  const [positionSearchOpen, setPositionSearchOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [posRes, batchRes, recRes, majorRes, industryRes] = await Promise.all([
        positionApi.list({ limit: 1000 }),
        batchApi.list({ limit: 1000 }),
        recommendApi.list({ limit: 1000 }),
        majorApi.list({ limit: 1000 }),
        industryApi.list({ limit: 1000 }),
      ])
      setPositions(posRes.items.map(convertCareerPositionToPosition))
      setBatches(batchRes.items.map(convertJobBatchToBatch))
      setRecommendations(recRes.items.map(convertApiRecommendationToLocal))
      const nameToId: Record<string, string> = {}
      majorRes.items.forEach((m) => { if (m.name) nameToId[m.name] = m.id })
      setMajorNameToId(nameToId)
      const industryNameMap = new Map<string, string>()
      industryRes.items.forEach((i) => { if (i.name) industryNameMap.set(i.id, i.name) })
      setIndustryMap(industryNameMap)
    } catch (err: any) {
      toast({ variant: 'destructive', title: '加载失败', description: err?.message || '请稍后重试' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const majorOptions = useMemo(() => {
    const set = new Set<string>()
    Object.keys(majorNameToId).forEach((name) => set.add(name))
    batches.forEach((b) => { if (b.major) set.add(b.major) })
    positions.forEach((p) => p.majors.forEach((m) => set.add(m)))
    return Array.from(set).sort()
  }, [batches, positions, majorNameToId])

  const currentMajor = selectedMajor || majorOptions[0] || ''

  const majorRecommendations = useMemo(() => {
    return recommendations
      .filter((rec) => rec.major === currentMajor)
      .sort((a, b) => a.order - b.order)
  }, [recommendations, currentMajor])

  const recommendedPositionIds = useMemo(
    () => new Set(majorRecommendations.map((rec) => rec.positionId)),
    [majorRecommendations]
  )

  const availablePositions = useMemo(() => {
    return positions.filter(
      (p) =>
        p.majors.includes(currentMajor) &&
        p.status === 'published' &&
        !recommendedPositionIds.has(p.id)
    )
  }, [positions, currentMajor, recommendedPositionIds])

  const handleMove = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= majorRecommendations.length) return
    const ids = majorRecommendations.map((rec) => rec.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(newIndex, 0, moved)
    try {
      const majorRecs = recommendations.filter((r) => r.major === currentMajor).sort((a, b) => a.order - b.order)
      await Promise.all(
        ids.map(async (id, idx) => {
          const rec = majorRecs.find((r) => r.id === id)
          if (!rec) return
          const newOrder = idx + 1
          if (newOrder === rec.order) return
          await recommendApi.update(id, {
            majorId: majorNameToId[currentMajor] || undefined,
            careerPositionId: rec.positionId,
            positionType: rec.positionType,
            reason: rec.reason,
            sortOrder: newOrder,
            isEnabled: rec.isEnabled,
            createdBy: rec.createdBy,
          } as ApiPositionRecommendation)
        })
      )
      await loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '排序失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await recommendApi.delete(id)
      await loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '删除失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleToggleVisible = async (id: string, isEnabled: boolean) => {
    const rec = recommendations.find((r) => r.id === id)
    if (!rec) return
    try {
      await recommendApi.update(id, {
        majorId: majorNameToId[currentMajor] || undefined,
        careerPositionId: rec.positionId,
        positionType: rec.positionType,
        reason: rec.reason,
        sortOrder: rec.order,
        isEnabled,
        createdBy: rec.createdBy,
      } as ApiPositionRecommendation)
      await loadData()
    } catch (err: any) {
      toast({ variant: 'destructive', title: '操作失败', description: err?.message || '请稍后重试' })
    }
  }

  const handleAdd = async () => {
    if (!selectedPositionId || !currentMajor || !user) return
    const position = positions.find((p) => p.id === selectedPositionId)
    if (!position) return
    try {
      const majorRecs = recommendations.filter((r) => r.major === currentMajor)
      await recommendApi.create({
        majorId: majorNameToId[currentMajor] || undefined,
        careerPositionId: position.id,
        positionType: position.positionType,
        reason: reason.trim() || undefined,
        sortOrder: majorRecs.length + 1,
        isEnabled: isVisibleNew,
        createdBy: user.id,
      } as Omit<ApiPositionRecommendation, 'id' | 'createdAt' | 'updatedAt'>)
      await loadData()
      setSelectedPositionId('')
      setReason('')
      setIsVisibleNew(true)
      setIsAddOpen(false)
    } catch (err: any) {
      toast({ variant: 'destructive', title: '添加失败', description: err?.message || '请稍后重试' })
    }
  }

  const selectedPosition = positions.find((p) => p.id === selectedPositionId)

  const getIndustryName = (id?: string) => {
    if (!id) return '-'
    return industryMap.get(id) || '-'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            岗位目标推荐管理
          </h1>
          <p className="text-muted-foreground mt-1">
            按专业配置前台"为你推荐"模块展示的岗位及顺序，支持企业岗位与教学岗位混合推荐
          </p>
        </div>
        <Link href="/explore">
          <Button variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            前台预览
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">选择专业</span>
            </div>
            <p className="text-sm text-muted-foreground">
              已配置 {majorRecommendations.length} 个推荐岗位
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {majorOptions.map((major) => (
              <button
                key={major}
                onClick={() => setSelectedMajor(major)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  currentMajor === major
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {major}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>推荐岗位列表</CardTitle>
              <CardDescription>
                专业「{currentMajor}」的前台推荐顺序，数字越小越靠前
              </CardDescription>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  添加推荐
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>添加岗位目标推荐</DialogTitle>
                  <DialogDescription>
                    为「{currentMajor}」专业选择一个岗位并配置推荐类型与原因
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">推荐岗位</label>
                    <Popover open={positionSearchOpen} onOpenChange={setPositionSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={positionSearchOpen}
                          className="w-full justify-between font-normal h-10 px-3 bg-background hover:bg-background border-input"
                          disabled={availablePositions.length === 0}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className={cn("truncate", !selectedPosition && "text-muted-foreground")}>
                              {selectedPosition
                                ? `${selectedPosition.name}（${selectedPosition.shortName}）`
                                : availablePositions.length === 0
                                ? '暂无可添加的岗位'
                                : '搜索或选择岗位'}
                            </span>
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                        <Command>
                          <CommandInput placeholder="搜索岗位名称、简称、行业..." />
                          <CommandList>
                            <CommandEmpty>未找到匹配岗位</CommandEmpty>
                            <CommandGroup>
                              {availablePositions.map((position) => (
                                <CommandItem
                                  key={position.id}
                                  value={`${position.name} ${position.shortName} ${getIndustryName(position.industry)}`}
                                  onSelect={() => {
                                    setSelectedPositionId(position.id)
                                    setPositionSearchOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedPositionId === position.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{position.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {position.shortName} · {getIndustryName(position.industry)}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {selectedPosition && (
                    <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{selectedPosition.name}</span>
                        </div>
                        <Link href={`/explore/${selectedPosition.id}`} target="_blank">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-primary">
                            <ExternalLink className="h-3.5 w-3.5" />
                            查看岗位
                          </Button>
                        </Link>
                      </div>
                      <div className="text-muted-foreground">
                        行业：{getIndustryName(selectedPosition.industry)} · 能力点：{selectedPosition.abilityModel?.nodes.length || 0} 个 · 上架时间：{formatDate(selectedPosition.createdAt)}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">推荐原因（选填）</label>
                    <Input
                      placeholder="例如：核心对口岗位，就业需求量大"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">是否展示</label>
                      <p className="text-xs text-muted-foreground">关闭后该推荐将不在前台显示</p>
                    </div>
                    <Switch
                      checked={isVisibleNew}
                      onCheckedChange={setIsVisibleNew}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAdd} disabled={!selectedPositionId}>
                    确认添加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">顺序</TableHead>
                  <TableHead>岗位名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>推荐原因</TableHead>
                  <TableHead>上架时间</TableHead>
                  <TableHead className="text-center">是否展示</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {majorRecommendations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Sparkles className="h-10 w-10 mb-2" />
                        <p>暂无为「{currentMajor}」配置的推荐岗位</p>
                        <p className="text-xs mt-1">添加后将在前台"为你推荐"按顺序展示</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  majorRecommendations.map((rec, index) => {
                    const position = positions.find((p) => p.id === rec.positionId)
                    return (
                      <TableRow key={rec.id} className={cn("group", !rec.isEnabled && "opacity-60")}>
                        <TableCell>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {rec.order}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{position?.name || '未知岗位'}</div>
                          <div className="text-xs text-muted-foreground">
                            {position?.shortName || '-'} · {getIndustryName(position?.industry)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              rec.positionType === 'teaching'
                                ? 'bg-amber-50 text-amber-600 hover:bg-amber-50'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-50'
                            )}
                          >
                            {POSITION_TYPE_LABELS[rec.positionType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {rec.reason || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(position?.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={rec.isEnabled}
                            onCheckedChange={(checked) => handleToggleVisible(rec.id, checked)}
                            aria-label={rec.isEnabled ? '已展示' : '已隐藏'}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => handleMove(index, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={index === majorRecommendations.length - 1}
                              onClick={() => handleMove(index, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(rec.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
