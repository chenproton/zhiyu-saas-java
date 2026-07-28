"use client"

import { useEffect, useMemo, useState, useCallback } from "react"

import { scenarioApi, sceneBatchApi } from "@/lib/api"
import type { Scenario, SceneBatch } from "@/lib/types/scene"
import { useToast } from "@zhiyu/ui"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ArchiveListPage, type ArchiveColumn } from "@/components/shared/archive-list-page"

export default function SceneArchivePage() {
  const { toast } = useToast()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [batches, setBatches] = useState<SceneBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedProfession, setSelectedProfession] = useState<string | null>(
    null
  )
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<string[] | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [scenarioRes, batchRes] = await Promise.all([
        scenarioApi.list({ status: "archived", limit: 1000 }),
        sceneBatchApi.list({ limit: 1000 }),
      ])
      setScenarios(scenarioRes.items)
      setBatches(batchRes.items)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "加载失败",
        description: err.message || "无法获取归档数据",
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

  const professions = useMemo(() => {
    const set = new Set<string>()
    scenarios.forEach((s) => {
      (s.professionNames || s.professionIds || []).forEach((name) =>
        set.add(name)
      )
    })
    return Array.from(set).sort()
  }, [scenarios])

  const filtered = useMemo(() => {
    let result = scenarios
    if (selectedProfession) {
      result = result.filter((s) =>
        (s.professionNames || s.professionIds || []).includes(
          selectedProfession
        )
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code || "").toLowerCase().includes(q) ||
          (s.professionNames || s.professionIds || []).some((v) =>
            v.toLowerCase().includes(q)
          ) ||
          (s.industryNames || s.industryIds || []).some((v) =>
            v.toLowerCase().includes(q)
          )
      )
    }
    return result
  }, [scenarios, selectedProfession, search])

  const batchMap = useMemo(
    () => new Map(batches.map((b) => [b.id, b])),
    [batches]
  )

  const handleRestore = async (scenario: Scenario) => {
    try {
      await scenarioApi.saveDraft(scenario.id)
      await loadData()
      toast({ title: "已恢复" })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "恢复失败",
        description: err.message || "请稍后重试",
      })
    }
  }

  const handleDelete = async (scenario: Scenario) => {
    try {
      await scenarioApi.delete(scenario.id)
      await loadData()
      toast({ title: "已删除" })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: err.message || "请稍后重试",
      })
    }
  }

  const handleBatchRestore = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => scenarioApi.saveDraft(id)))
      await loadData()
      toast({ title: `已批量恢复 ${ids.length} 个场景` })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "批量恢复失败",
        description: err.message || "请稍后重试",
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
      await loadData()
      toast({ title: `已批量删除 ${batchDeleteTarget.length} 个场景` })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "批量删除失败",
        description: err.message || "请稍后重试",
      })
    } finally {
      setBatchDeleteTarget(null)
    }
  }

  const columns: ArchiveColumn<Scenario>[] = [
    {
      header: "场景名称",
      className: "w-44",
      cell: (entry) => (
        <div className="max-w-44">
          <span className="font-medium line-clamp-1">{entry.name}</span>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {(entry.professionNames || entry.professionIds || []).join("、") ||
              "-"}{" "}
            ·{" "}
            {(entry.industryNames || entry.industryIds || []).join("、") || "-"}
          </p>
        </div>
      ),
    },
    {
      header: "场景编码",
      className: "w-28",
      cell: (entry) => (
        <span className="text-sm text-muted-foreground max-w-28 truncate">
          {entry.code}
        </span>
      ),
    },
    {
      header: "版本",
      className: "w-20",
      cell: (entry) => <span className="text-sm">{entry.version}</span>,
    },
    {
      header: "所属行业",
      className: "w-24",
      cell: (entry) => (
        <span className="text-sm max-w-24 truncate">
          {(entry.industryNames || entry.industryIds || []).join("、") || "-"}
        </span>
      ),
    },
    {
      header: "适用专业",
      className: "w-32",
      cell: (entry) => (
        <span className="text-sm max-w-32 truncate">
          {(entry.professionNames || entry.professionIds || []).join("、") ||
            "-"}
        </span>
      ),
    },
    {
      header: "所属批次分组",
      className: "w-28",
      cell: (entry) => (
        <span className="text-sm max-w-28 truncate">
          {entry.batchId ? batchMap.get(entry.batchId)?.name || "-" : "-"}
        </span>
      ),
    },
    {
      header: "归档时间",
      className: "w-24",
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
        entityLabel="场景"
        pageTitle="场景历史档案库"
        pageDescription="查看已归档的场景记录，支持恢复为草稿继续编辑"
        sidebarTitle="按专业归档"
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
        searchPlaceholder="搜索场景名称 / 编码 / 专业 / 行业"
        searchValue={search}
        onSearchChange={setSearch}
        columns={columns}
      />
      <ConfirmDialog
        open={batchDeleteTarget !== null}
        onOpenChange={(open) => { if (!open) setBatchDeleteTarget(null) }}
        title="确认批量删除"
        description={`确定删除选中的 ${batchDeleteTarget?.length || 0} 个场景吗？删除后不可恢复。`}
        variant="destructive"
        onConfirm={confirmBatchDelete}
      />
    </>
  )
}
