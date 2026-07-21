'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { positionApi, batchApi, recommendApi } from '@/lib/api'
import { useIndustryMap } from '@/lib/use-resource-maps'
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
  const [loading, setLoading] = useState(false)
  const industryMap = useIndustryMap()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedPositionId, setSelectedPositionId] = useState<string>('')
  const [positionSearchOpen, setPositionSearchOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [posRes, batchRes, recRes] = await Promise.all([
        positionApi.list({ limit: 1000 }),
        batchApi.list({ limit: 1000 }),
        recommendApi.list({ limit: 1000 }),
      ])
      setPositions(posRes.items.map(convertCareerPositionToPosition))
      setBatches(batchRes.items.map(convertJobBatchToBatch))
      setRecommendations(recRes.items.map(convertApiRecommendationToLocal))
    } catch (err: any) {
      toast({ variant: 'destructive', title: '加载失败', description: err?.message || '请稍后重试' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const allRecommendations = useMemo(() => {
    return recommendations
      .filter((rec) => rec.isEnabled)
      .sort((a, b) => a.order - b.order)
  }, [recommendations])

  const recommendedPositionIds = useMemo(
    () => new Set(allRecommendations.map((rec) => rec.positionId)),
    [allRecommendations]
  )

  const availablePositions = useMemo(() => {
    return positions.filter(
      (p) =>
        p.status === 'published' &&
        !recommendedPositionIds.has(p.id)
    )
  }, [positions, recommendedPositionIds])

  const handleMove = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= allRecommendations.length) return
    const ids = allRecommendations.map((rec) => rec.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(newIndex, 0, moved)
    try {
      const sortedRecs = [...allRecommendations].sort((a, b) => a.order - b.order)
      await Promise.all(
        ids.map(async (id, idx) => {
          const rec = sortedRecs.find((r) => r.id === id)
          if (!rec) return
          const newOrder = idx + 1
          if (newOrder === rec.order) return
          await recommendApi.update(id, {
            careerPositionId: rec.positionId,
            positionType: rec.positionType,
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

  const handleAdd = async () => {
    if (!selectedPositionId || !user) return
    const position = positions.find((p) => p.id === selectedPositionId)
    if (!position) return
    try {
      await recommendApi.create({
        careerPositionId: position.id,
        positionType: position.positionType,
        sortOrder: allRecommendations.length + 1,
        isEnabled: true,
        createdBy: user.id,
      } as Omit<ApiPositionRecommendation, 'id' | 'createdAt' | 'updatedAt'>)
      await loadData()
      setSelectedPositionId('')
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
            岗位目标推荐管理
          </h1>
          <p className="text-muted-foreground mt-1">
            配置前台"为你推荐"模块展示的岗位及顺序，支持企业岗位与教学岗位混合推荐
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
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            已配置 <span className="font-medium text-foreground">{allRecommendations.length}</span> 个推荐岗位
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>推荐岗位列表</CardTitle>
              <CardDescription>
                前台推荐顺序，数字越小越靠前
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
                    选择一个岗位加入前台推荐列表
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
                  <TableHead>上架时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRecommendations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Sparkles className="h-10 w-10 mb-2" />
                        <p>暂无配置的推荐岗位</p>
                        <p className="text-xs mt-1">添加后将在前台"为你推荐"按顺序展示</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  allRecommendations.map((rec, index) => {
                    const position = positions.find((p) => p.id === rec.positionId)
                    return (
                      <TableRow key={rec.id} className="group">
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
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(position?.createdAt)}
                          </span>
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
                              disabled={index === allRecommendations.length - 1}
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
