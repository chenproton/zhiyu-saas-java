'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { positionApi, batchApi } from '@/lib/api'
import type { Position, Batch } from '@/lib/types/job-source'
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
} from '@/lib/converters/job-converters'
import { useToast } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useIndustryMap, useMajorMap } from '@/lib/use-resource-maps'
import { ArchiveListPage, type ArchiveColumn } from '@/components/shared/archive-list-page'

export default function PositionArchivePage() {
  const { toast } = useToast()
  const [positions, setPositions] = useState<Position[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string[] | null>(null)
  const industryMap = useIndustryMap()
  const majorMap = useMajorMap()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [posRes, batchRes] = await Promise.all([
        positionApi.list({ status: 'archived', limit: 1000 }),
        batchApi.list({ limit: 1000 }),
      ])
      setPositions(posRes.items.map(convertCareerPositionToPosition))
      setBatches(batchRes.items.map(convertJobBatchToBatch))
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '无法获取归档数据',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    ;(async () => {
      await loadData()
    })()
  }, [loadData])

  const majors = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => {
      p.majors.forEach((id) => {
        const name = majorMap.get(id)
        if (name) set.add(name)
      })
    })
    return Array.from(set).sort()
  }, [positions, majorMap])

  const filtered = useMemo(() => {
    let result = positions
    if (selectedMajor) {
      result = result.filter((p) => p.majors.some((id) => majorMap.get(id) === selectedMajor))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortName.toLowerCase().includes(q) ||
          (industryMap.get(p.industry) || '').toLowerCase().includes(q) ||
          p.majors.some((id) => (majorMap.get(id) || '').toLowerCase().includes(q)),
      )
    }
    return result
  }, [positions, selectedMajor, search, industryMap, majorMap])

  const batchMap = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches])

  const getMajorNames = (ids: string[]) => {
    if (ids.length === 0) return '-'
    return ids.map((id) => majorMap.get(id) || id).join('，')
  }

  const handleRestore = async (position: Position) => {
    try {
      await positionApi.saveDraft(position.id)
      await loadData()
      toast({ title: '已恢复' })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '恢复失败',
        description: err.message || '请稍后重试',
      })
    }
  }

  const handleDelete = async (position: Position) => {
    try {
      await positionApi.delete(position.id)
      await loadData()
      toast({ title: '已删除' })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: err.message || '请稍后重试',
      })
    }
  }

  const handleBatchRestore = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => positionApi.saveDraft(id)))
      await loadData()
      toast({ title: `已批量恢复 ${ids.length} 个岗位` })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '批量恢复失败',
        description: err.message || '请稍后重试',
      })
    }
  }

  const handleBatchDelete = async (ids: string[]) => {
    setBatchDeleteTarget(ids)
  }

  const confirmBatchDelete = async () => {
    if (!batchDeleteTarget || batchDeleteTarget.length === 0) return
    try {
      await Promise.all(batchDeleteTarget.map((id) => positionApi.delete(id)))
      await loadData()
      toast({ title: `已批量删除 ${batchDeleteTarget.length} 个岗位` })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '批量删除失败',
        description: err.message || '请稍后重试',
      })
    } finally {
      setBatchDeleteTarget(null)
    }
  }

  const columns: ArchiveColumn<Position>[] = [
    {
      header: '岗位名称',
      className: 'w-44',
      cell: (entry) => (
        <div className="max-w-44">
          <span className="font-medium line-clamp-1">{entry.name}</span>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {industryMap.get(entry.industry) || '-'} · {getMajorNames(entry.majors)}
          </p>
        </div>
      ),
    },
    {
      header: '简称',
      className: 'w-24',
      cell: (entry) => (
        <span className="text-sm text-muted-foreground max-w-24 truncate">
          {entry.shortName || '-'}
        </span>
      ),
    },
    {
      header: '版本',
      className: 'w-20',
      cell: (entry) => <span className="text-sm">{entry.version}</span>,
    },
    {
      header: '所属行业',
      className: 'w-24',
      cell: (entry) => (
        <span className="text-sm max-w-24 truncate">{industryMap.get(entry.industry) || '-'}</span>
      ),
    },
    {
      header: '适用专业',
      className: 'w-32',
      cell: (entry) => (
        <span className="text-sm max-w-32 truncate">{getMajorNames(entry.majors)}</span>
      ),
    },
    {
      header: '所属批次分组',
      className: 'w-28',
      cell: (entry) => (
        <span className="text-sm max-w-28 truncate">
          {entry.batchId ? batchMap.get(entry.batchId)?.name || '-' : '-'}
        </span>
      ),
    },
    {
      header: '归档时间',
      className: 'w-24',
      cell: (entry) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {new Date(entry.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <>
      <ArchiveListPage
        entityLabel="岗位"
        pageTitle="岗位历史档案库"
        pageDescription="查看已归档的岗位记录，支持恢复为草稿继续编辑"
        sidebarTitle="按专业归档"
        sidebarItems={majors.map((m) => ({ id: m, name: m }))}
        sidebarSelectedId={selectedMajor}
        onSidebarSelect={setSelectedMajor}
        items={filtered}
        loading={loading}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onBatchRestore={handleBatchRestore}
        onBatchDelete={handleBatchDelete}
        detailHref={(item) => `/job/positions/${item.id}/edit`}
        searchPlaceholder="搜索岗位名称 / 简称 / 行业 / 专业"
        searchValue={search}
        onSearchChange={setSearch}
        columns={columns}
      />
      <ConfirmDialog
        open={batchDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteTarget(null)
        }}
        title="确认批量删除"
        description={`确定删除选中的 ${batchDeleteTarget?.length || 0} 个岗位吗？删除后不可恢复。`}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
