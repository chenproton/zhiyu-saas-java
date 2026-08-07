'use client'

import { useMemo, useState } from 'react'

import { scenarioApi, sceneBatchApi } from '@/lib/api'
import { formatDate } from '@/lib/format-utils'
import type { Scenario } from '@/lib/types/scene'
import { useToast, useAsync } from '@zhiyu/ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ArchiveListPage, type ArchiveColumn } from '@/components/shared/archive-list-page'
import { useT } from '@/lib/i18n/locale-provider'

export default function SceneArchivePage() {
  const t = useT()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null)
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string[] | null>(null)

  const { data, loading, refresh } = useAsync(async () => {
    const [scenarioRes, batchRes] = await Promise.all([
      scenarioApi.list({ status: 'archived', limit: 1000 }),
      sceneBatchApi.list({ limit: 1000 }),
    ])
    return { scenarios: scenarioRes.items, batches: batchRes.items }
  })

  const { scenarios, batches } = data ?? {}

  const professions = useMemo(() => {
    const set = new Set<string>()
    ;(scenarios ?? []).forEach((s) => {
      ;(s.professionNames || s.professionIds || []).forEach((name) => set.add(name))
    })
    return Array.from(set).sort()
  }, [scenarios])

  const filtered = useMemo(() => {
    let result = scenarios ?? []
    if (selectedProfession) {
      result = result.filter((s) =>
        (s.professionNames || s.professionIds || []).includes(selectedProfession),
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code || '').toLowerCase().includes(q) ||
          (s.professionNames || s.professionIds || []).some((v) => v.toLowerCase().includes(q)) ||
          (s.industryNames || s.industryIds || []).some((v) => v.toLowerCase().includes(q)),
      )
    }
    return result
  }, [scenarios, selectedProfession, search])

  const batchMap = useMemo(() => new Map((batches ?? []).map((b) => [b.id, b])), [batches])

  const handleRestore = async (scenario: Scenario) => {
    try {
      await scenarioApi.saveDraft(scenario.id)
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

  const handleDelete = async (scenario: Scenario) => {
    try {
      await scenarioApi.delete(scenario.id)
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
    const results = await Promise.allSettled(ids.map((id) => scenarioApi.saveDraft(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    await refresh()
    if (failed === 0) {
      toast({ title: t('已批量恢复 {n} 个场景', { n: ids.length }) })
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
      await Promise.all(batchDeleteTarget.map((id) => scenarioApi.delete(id)))
      await refresh()
      toast({ title: t('已批量删除 {n} 个场景', { n: batchDeleteTarget.length }) })
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

  const columns: ArchiveColumn<Scenario>[] = [
    {
      header: t('场景名称'),
      className: 'w-44',
      cell: (entry) => (
        <div className="max-w-44">
          <span className="font-medium line-clamp-1">{entry.name}</span>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {(entry.professionNames || entry.professionIds || []).join('、') || '-'} ·{' '}
            {(entry.industryNames || entry.industryIds || []).join('、') || '-'}
          </p>
        </div>
      ),
    },
    {
      header: t('场景编码'),
      className: 'w-28',
      cell: (entry) => (
        <span className="text-sm text-muted-foreground max-w-28 truncate">{entry.code}</span>
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
        <span className="text-sm max-w-24 truncate">
          {(entry.industryNames || entry.industryIds || []).join('、') || '-'}
        </span>
      ),
    },
    {
      header: t('适用专业'),
      className: 'w-32',
      cell: (entry) => (
        <span className="text-sm max-w-32 truncate">
          {(entry.professionNames || entry.professionIds || []).join('、') || '-'}
        </span>
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
        entityLabel={t('场景')}
        pageTitle={t('场景历史档案库')}
        pageDescription={t('查看已归档的场景记录，支持恢复为草稿继续编辑')}
        sidebarTitle={t('按专业归档')}
        sidebarItems={professions.map((p) => ({ id: p, name: p }))}
        sidebarSelectedId={selectedProfession}
        onSidebarSelect={setSelectedProfession}
        items={filtered}
        loading={loading}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onBatchRestore={handleBatchRestore}
        onBatchDelete={handleBatchDelete}
        detailHref={(item) => `/scene/scenarios/${item.id}/edit`}
        searchPlaceholder={t('搜索场景名称 / 编码 / 专业 / 行业')}
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
        description={t('确定删除选中的 {n} 个场景吗？删除后不可恢复。', {
          n: batchDeleteTarget?.length || 0,
        })}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
