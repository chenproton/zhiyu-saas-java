'use client'

import { useMemo, useState } from 'react'

import { positionApi, batchApi } from '@/lib/api'
import type { Position } from '@/lib/types/job-source'
import {
  convertCareerPositionToPosition,
  convertJobBatchToBatch,
} from '@/lib/converters/job-converters'
import { useToast, useAsync } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useIndustryMap, useMajorMap } from '@/lib/use-resource-maps'
import { formatDate } from '@/lib/format-utils'
import { ArchiveListPage, type ArchiveColumn } from '@/components/shared/archive-list-page'
import { useT } from '@/lib/i18n/locale-provider'

export default function PositionArchivePage() {
  const t = useT()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedMajor, setSelectedMajor] = useState<string | null>(null)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string[] | null>(null)
  const industryMap = useIndustryMap()
  const majorMap = useMajorMap()

  const { data, loading, refresh } = useAsync(async () => {
    const [posRes, batchRes] = await Promise.all([
      positionApi.list({ status: 'archived', limit: 1000 }),
      batchApi.list({ limit: 1000 }),
    ])
    return {
      positions: posRes.items.map(convertCareerPositionToPosition),
      batches: batchRes.items.map(convertJobBatchToBatch),
    }
  })

  const { positions, batches } = data ?? {}

  const majors = useMemo(() => {
    const set = new Set<string>()
    ;(positions ?? []).forEach((p) => {
      p.majors.forEach((id) => {
        const name = majorMap.get(id)
        if (name) set.add(name)
      })
    })
    return Array.from(set).sort()
  }, [positions, majorMap])

  const filtered = useMemo(() => {
    let result = positions ?? []
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

  const batchMap = useMemo(() => new Map((batches ?? []).map((b) => [b.id, b])), [batches])

  const getMajorNames = (ids: string[]) => {
    if (ids.length === 0) return '-'
    return ids.map((id) => majorMap.get(id) || id).join('，')
  }

  const handleRestore = async (position: Position) => {
    try {
      await positionApi.saveDraft(position.id)
      await refresh()
      toast({ title: t('已恢复') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('恢复失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handleDelete = async (position: Position) => {
    try {
      await positionApi.delete(position.id)
      await refresh()
      toast({ title: t('已删除') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handleBatchRestore = async (ids: string[]) => {
    const results = await Promise.allSettled(ids.map((id) => positionApi.saveDraft(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    await refresh()
    if (failed === 0) {
      toast({ title: t('已批量恢复 {n} 个岗位', { n: ids.length }) })
    } else {
      toast({
        variant: 'destructive',
        title: t('批量恢复部分失败'),
        description: t('成功 {ok} 个，失败 {fail} 个', { ok: ids.length - failed, fail: failed }),
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
      await refresh()
      toast({ title: t('已批量删除 {n} 个岗位', { n: batchDeleteTarget.length }) })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('批量删除失败'),
        description: err.message || t('请稍后重试'),
      })
    } finally {
      setBatchDeleteTarget(null)
    }
  }

  const columns: ArchiveColumn<Position>[] = [
    {
      header: t('岗位名称'),
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
      header: t('简称'),
      className: 'w-24',
      cell: (entry) => (
        <span className="text-sm text-muted-foreground max-w-24 truncate">
          {entry.shortName || '-'}
        </span>
      ),
    },
    {
      header: t('版本'),
      className: 'w-20',
      cell: (entry) => <span className="text-sm">{entry.version}</span>,
    },
    {
      header: t('所属行业'),
      className: 'w-24',
      cell: (entry) => (
        <span className="text-sm max-w-24 truncate">{industryMap.get(entry.industry) || '-'}</span>
      ),
    },
    {
      header: t('适用专业'),
      className: 'w-32',
      cell: (entry) => (
        <span className="text-sm max-w-32 truncate">{getMajorNames(entry.majors)}</span>
      ),
    },
    {
      header: t('所属批次分组'),
      className: 'w-28',
      cell: (entry) => (
        <span className="text-sm max-w-28 truncate">
          {entry.batchId ? batchMap.get(entry.batchId)?.name || '-' : '-'}
        </span>
      ),
    },
    {
      header: t('归档时间'),
      className: 'w-24',
      cell: (entry) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(entry.updatedAt)}
        </span>
      ),
    },
  ]

  return (
    <>
      <ArchiveListPage
        entityLabel={t('岗位')}
        pageTitle={t('岗位历史档案库')}
        pageDescription={t('查看已归档的岗位记录，支持恢复为草稿继续编辑')}
        sidebarTitle={t('按专业归档')}
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
        searchPlaceholder={t('搜索岗位名称 / 简称 / 行业 / 专业')}
        searchValue={search}
        onSearchChange={setSearch}
        columns={columns}
      />
      <ConfirmDialog
        open={batchDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteTarget(null)
        }}
        title={t('确认批量删除')}
        description={t('确定删除选中的 {n} 个岗位吗？删除后不可恢复。', {
          n: batchDeleteTarget?.length || 0,
        })}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
