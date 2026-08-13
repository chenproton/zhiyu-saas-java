'use client'

import { Fragment, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Settings2, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react'
import { allianceBrandApi, portalRequest } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { SearchInput } from '@/components/shared/search-input'
import { useT } from '@/lib/i18n/locale-provider'
import type { BrandMajorRankConfig, TalentRankStudent } from '@/lib/types'

type SortKey =
  | 'avgAchievementRate'
  | 'avgPositionCompetency'
  | 'avgPositionCompetencyV2'
  | 'avgAbilityCognitionScore'
  | 'positionCount'

const SORTABLE_COLUMNS: { key: SortKey; labelKey: string; unit?: string }[] = [
  { key: 'avgAchievementRate', labelKey: '岗位能力达成率', unit: '%' },
  { key: 'avgPositionCompetency', labelKey: '岗位胜任度', unit: '%' },
  { key: 'avgPositionCompetencyV2', labelKey: '岗位胜任度（新）', unit: '%' },
  { key: 'avgAbilityCognitionScore', labelKey: '能力认证得分' },
  { key: 'positionCount', labelKey: '评估岗位数' },
]

function fmtValue(v?: number, unit?: string) {
  if (v === undefined || v === null) return '-'
  return `${v.toFixed(1)}${unit ?? ''}`
}

function rankMedal(rank: number) {
  const styles: Record<number, string> = {
    1: 'bg-amber-100 text-amber-700',
    2: 'bg-slate-200 text-slate-600',
    3: 'bg-orange-100 text-orange-600',
  }
  return styles[rank] ?? 'bg-muted text-muted-foreground'
}

interface TalentRankingPanelProps {
  tenantId?: string
}

export function TalentRankingPanel({ tenantId }: TalentRankingPanelProps) {
  const { toast } = useToast()
  const t = useT()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeMajor, setActiveMajor] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('avgAchievementRate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [configOpen, setConfigOpen] = useState(false)
  const [expandedId, setExpandedId] = useState('')

  const { data, loading, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const data = await allianceBrandApi.talentRanking({ search })
      return data.items || []
    },
    { deps: [tenantId, search], onError: () => true },
  )

  const groups = useMemo(() => data ?? [], [data])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const enabledGroups = useMemo(() => groups.filter((g) => g.enabled), [groups])

  const currentMajor = useMemo(
    () => enabledGroups.find((g) => g.majorId === activeMajor) ?? enabledGroups[0] ?? null,
    [enabledGroups, activeMajor],
  )

  const rankedStudents = useMemo(() => {
    if (!currentMajor) return []
    const sorted = [...currentMajor.students].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'positionCount' ? 0 : -Infinity)
      const bv = b[sortKey] ?? (sortKey === 'positionCount' ? 0 : -Infinity)
      const diff = av - bv
      return sortDir === 'desc' ? -diff || a.name.localeCompare(b.name) : diff || a.name.localeCompare(b.name)
    })
    return sorted.slice(0, currentMajor.rankLimit).map((s, idx) => ({ ...s, rank: idx + 1 }))
  }, [currentMajor, sortKey, sortDir])

  return (
    <div className="min-h-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('人才画像排名')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('基于岗位能力认证结果的学生综合排名')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            wrapperClassName="w-full sm:w-64"
            placeholder={t('搜索学生姓名或学号...')}
            value={searchInput}
            onChange={setSearchInput}
            onSearch={() => setSearch(searchInput.trim())}
          />
          <Button variant="outline" size="sm" onClick={() => setSearch(searchInput.trim())}>
            {t('搜索')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            {t('专业排名启用管理')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : enabledGroups.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-white p-12 text-center text-sm text-muted-foreground shadow-sm">
          {t('暂无启用展示的专业')}
        </div>
      ) : (
        <Tabs value={currentMajor?.majorId ?? ''} onValueChange={setActiveMajor} className="w-full">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TabsList className="overflow-x-auto">
              {enabledGroups.map((g) => (
                <TabsTrigger key={g.majorId} value={g.majorId} className="rounded-lg text-xs">
                  {g.majorName || t('未分配专业')}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent key={currentMajor?.majorId} value={currentMajor?.majorId ?? ''}>
            <p className="mb-3 text-xs text-muted-foreground">
              {t('展示范围：前 {limit} 名 · 当前显示 {shown} 人', {
                limit: currentMajor?.rankLimit ?? 0,
                shown: rankedStudents.length,
              })}
            </p>
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-16">{t('排名')}</TableHead>
                    <TableHead>{t('姓名')}</TableHead>
                    <TableHead>{t('学号')}</TableHead>
                    <TableHead>{t('专业')}</TableHead>
                    <TableHead>{t('班级')}</TableHead>
                    <TableHead>{t('院系')}</TableHead>
                    {SORTABLE_COLUMNS.map((col) => (
                      <TableHead key={col.key}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                          onClick={() => toggleSort(col.key)}
                        >
                          {t(col.labelKey)}
                          {sortKey === col.key &&
                            (sortDir === 'desc' ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronUp className="h-3 w-3" />
                            ))}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                        {t('暂无学生数据')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rankedStudents.map((s) => {
                      const expanded = expandedId === s.studentId
                      const hasPositions = (s.positions?.length ?? 0) > 0
                      return (
                        <Fragment key={s.studentId}>
                          <TableRow className="border-border">
                            <TableCell>
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${rankMedal(s.rank)}`}
                              >
                                {s.rank}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                                onClick={() =>
                                  hasPositions && setExpandedId(expanded ? '' : s.studentId)
                                }
                              >
                                {hasPositions && (
                                  expanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  )
                                )}
                                {s.name}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{s.studentNo}</TableCell>
                            <TableCell>{s.majorName}</TableCell>
                            <TableCell>{s.className}</TableCell>
                            <TableCell>{s.departmentName}</TableCell>
                            <TableCell>{fmtValue(s.avgAchievementRate, '%')}</TableCell>
                            <TableCell>{fmtValue(s.avgPositionCompetency, '%')}</TableCell>
                            <TableCell>{fmtValue(s.avgPositionCompetencyV2, '%')}</TableCell>
                            <TableCell>{fmtValue(s.avgAbilityCognitionScore)}</TableCell>
                            <TableCell>{s.positionCount || '-'}</TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow className="border-border bg-muted/30">
                              <TableCell colSpan={11} className="px-8 py-3">
                                <PositionDetailRows student={s} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <RankConfigDialog
        tenantId={tenantId}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSaved={() => {
          toast({ title: t('专业排名配置已保存') })
          refresh()
        }}
      />
    </div>
  )
}

// ── 学生各岗位评估明细（展开行，含 /evaluation/job-ability/results 全部字段） ──

function PositionDetailRows({ student }: { student: TalentRankStudent }) {
  const t = useT()
  const positions = student.positions ?? []
  if (positions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('暂无岗位评估明细，展开排名指标为空的学生无评估记录')}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t('该学生 {count} 个岗位的评估明细（排名指标为各岗位平均）', { count: positions.length })}
      </p>
      <div className="rounded-lg border border-gray-100 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>{t('岗位名称')}</TableHead>
              <TableHead>{t('岗位能力达成率')}</TableHead>
              <TableHead>{t('岗位胜任度')}</TableHead>
              <TableHead>{t('岗位胜任度（新）')}</TableHead>
              <TableHead>{t('能力认证得分')}</TableHead>
              <TableHead>{t('能力点达成')}</TableHead>
              <TableHead>{t('评级')}</TableHead>
              <TableHead>{t('评估时间')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((p) => (
              <TableRow key={p.positionId} className="border-border">
                <TableCell className="font-medium">{p.positionName || '-'}</TableCell>
                <TableCell>{fmtValue(p.achievementRate, '%')}</TableCell>
                <TableCell>{fmtValue(p.positionCompetency, '%')}</TableCell>
                <TableCell>{fmtValue(p.positionCompetencyV2, '%')}</TableCell>
                <TableCell>{fmtValue(p.abilityCognitionScore)}</TableCell>
                <TableCell>
                  {p.achievedAbilityPoints}/{p.totalAbilityPoints}
                </TableCell>
                <TableCell>{p.grade || '-'}</TableCell>
                <TableCell>
                  {p.evaluatedAt
                    ? new Date(p.evaluatedAt).toLocaleDateString('zh-CN')
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

interface RankConfigDialogProps {
  tenantId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

function RankConfigDialog({ tenantId, open, onOpenChange, onSaved }: RankConfigDialogProps) {
  const { toast } = useToast()
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [configs, setConfigs] = useState<Record<string, BrandMajorRankConfig>>({})

  const { data: majors, loading: majorsLoading } = useAsync(
    async () => {
      if (!open) return []
      const [majorsRes, configRes] = await Promise.all([
        portalRequest<{ items: { id: string; name: string }[] }>('/majors?limit=200'),
        allianceBrandApi.rankConfigs(),
      ])
      const cfgMap: Record<string, BrandMajorRankConfig> = {}
      for (const c of configRes.items || []) cfgMap[c.majorId] = c
      setConfigs(cfgMap)
      return majorsRes.items || []
    },
    { deps: [tenantId, open], onError: () => true },
  )

  const save = async () => {
    setSaving(true)
    try {
      await allianceBrandApi.saveRankConfigs(Object.values(configs))
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast({ title: t('保存失败'), description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('专业排名启用管理')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
          {majorsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (majors ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('暂无专业数据')}</p>
          ) : (
            (majors ?? []).map((major) => {
              const cfg = configs[major.id] ?? { majorId: major.id, enabled: true, rankLimit: 10 }
              return (
                <div
                  key={major.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{major.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={cfg.rankLimit}
                        onChange={(e) =>
                          setConfigs((prev) => ({
                            ...prev,
                            [major.id]: { ...cfg, rankLimit: Number(e.target.value) || 10 },
                          }))
                        }
                        className="h-8 w-20 text-sm"
                        disabled={!cfg.enabled}
                      />
                      <Label className="text-xs text-muted-foreground">{t('前 N 名')}</Label>
                    </div>
                    <Switch
                      checked={cfg.enabled}
                      onCheckedChange={(v) =>
                        setConfigs((prev) => ({
                          ...prev,
                          [major.id]: { ...cfg, enabled: v },
                        }))
                      }
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('取消')}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
