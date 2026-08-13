'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Loader2,
  Building2,
  Save,
  Briefcase,
  Workflow,
  Search,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/shared/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceEnterpriseApi, allianceGrantApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { getStatusConfig } from '@zhiyu/shared-types'
import type { AllianceGrantResourceOption } from '@/lib/api'
import type { AllianceEnterprise } from '@/lib/types'

type GrantOption = AllianceGrantResourceOption
type ResourceType = 'position' | 'scene'

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '审批中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

export default function AlliancePermissionsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()

  const { data: enterprises, loading: entLoading } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEnterpriseApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const [enterpriseId, setEnterpriseId] = useState('')
  const [activeType, setActiveType] = useState<ResourceType>('position')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  // 搜索与筛选（仅影响展示，不影响已勾选）
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [batchFilter, setBatchFilter] = useState('__all__')

  // 折叠的批次分组（默认全部展开，点击组头折叠）
  const [collapsedBatches, setCollapsedBatches] = useState<Set<string>>(new Set())

  // 未手动选择时默认选中第一个企业，保证页面不空数据
  const currentEnterpriseId = enterpriseId || enterprises?.[0]?.id || ''

  // 选中企业后加载：授权现状 + 资源候选
  const { data, refresh, loading: optionsLoading } = useAsync(
    async () => {
      if (!tenantId || !currentEnterpriseId)
        return { options: [] as GrantOption[], granted: new Set<string>() }
      const [optRes, grantRes] = await Promise.all([
        allianceGrantApi.resourceOptions(currentEnterpriseId),
        allianceGrantApi.list(currentEnterpriseId),
      ])
      const granted = new Set<string>()
      grantRes.grants.forEach((g) => g.resourceIds.forEach((id) => granted.add(id)))
      return { options: optRes.items || [], granted }
    },
    { deps: [tenantId, currentEnterpriseId, authLoading], onError: () => true },
  )

  const options = useMemo(() => data?.options ?? [], [data])
  const granted = useMemo(() => data?.granted ?? new Set<string>(), [data])

  const isChecked = (o: GrantOption) => (checked[o.id] === undefined ? granted.has(o.id) : checked[o.id])

  const typeOptions = useMemo(
    () => options.filter((o) => o.type === activeType),
    [options, activeType],
  )

  // 当前 tab 的批次分组（含未分类）
  const batches = useMemo(() => {
    const map = new Map<string, { name: string; items: GrantOption[] }>()
    typeOptions.forEach((o) => {
      if (!o.batchId || !o.batchName) return
      if (!map.has(o.batchId)) map.set(o.batchId, { name: o.batchName, items: [] })
      map.get(o.batchId)!.items.push(o)
    })
    return [...map.entries()].map(([id, v]) => ({ id, ...v }))
  }, [typeOptions])

  const uncategorized = useMemo(
    () => typeOptions.filter((o) => !o.batchId || !o.batchName),
    [typeOptions],
  )

  // 搜索/状态/批次筛选后的可见列表（用于全选范围）
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return typeOptions.filter((o) => {
      if (kw && !o.name.toLowerCase().includes(kw)) return false
      if (statusFilter !== '__all__' && o.status !== statusFilter) return false
      if (batchFilter === '__all__') return true
      if (batchFilter === '__none__') return !o.batchId || !o.batchName
      return o.batchId === batchFilter
    })
  }, [typeOptions, search, statusFilter, batchFilter])

  const filteredBatches = useMemo(
    () => batches.filter((b) => filtered.some((o) => o.batchId === b.id)),
    [batches, filtered],
  )
  const filteredUncategorized = useMemo(
    () => uncategorized.filter((o) => filtered.some((x) => x.id === o.id)),
    [uncategorized, filtered],
  )

  const allFilteredChecked =
    filtered.length > 0 && filtered.every((o) => isChecked(o))

  const toggleBatch = (batchId: string) => {
    setCollapsedBatches((prev) => {
      const next = new Set(prev)
      next.has(batchId) ? next.delete(batchId) : next.add(batchId)
      return next
    })
  }

  const toggleFilteredAll = () => {
    setChecked((prev) => {
      const next = { ...prev }
      filtered.forEach((o) => {
        next[o.id] = !allFilteredChecked
      })
      return next
    })
  }

  const toggleGroupAll = (items: GrantOption[]) => {
    const groupAll = items.every((o) => isChecked(o))
    setChecked((prev) => {
      const next = { ...prev }
      items.forEach((o) => {
        next[o.id] = !groupAll
      })
      return next
    })
  }

  const toggleOne = (o: GrantOption) => {
    setChecked((prev) => ({ ...prev, [o.id]: !isChecked(o) }))
  }

  const selectEnterprise = (id: string) => {
    setEnterpriseId(id)
    setChecked({})
    setSearch('')
    setStatusFilter('__all__')
    setBatchFilter('__all__')
  }

  const saveCurrentType = async () => {
    if (saving) return
    setSaving(true)
    try {
      const ids = typeOptions.filter((o) => isChecked(o)).map((o) => o.id)
      await allianceGrantApi.save({
        enterpriseId: currentEnterpriseId,
        resourceType: activeType,
        resourceIds: ids,
      })
      toast({ title: t('授权已保存') })
      setChecked({})
      await refresh()
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const sourceLabel = (o: GrantOption) => {
    if (o.source === 'school') return t('本校自建')
    if (o.sourceEnterpriseId === currentEnterpriseId) return t('该企业共建')
    return o.sourceEnterpriseName ? t('{ent}共建', { ent: o.sourceEnterpriseName }) : t('企业共建')
  }

  const renderRow = (o: GrantOption) => {
    const st = getStatusConfig(o.status)
    const checkedFlag = isChecked(o)
    return (
      <label
        key={o.id}
        className={cn(
          'flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors',
          checkedFlag ? 'border-primary/30 bg-primary/[0.03]' : 'border-slate-100',
        )}
      >
        <Checkbox checked={checkedFlag} onCheckedChange={() => toggleOne(o)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{o.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span
              className="text-[11px] px-1.5 py-px rounded"
              style={{ color: st.color, background: st.bg }}
            >
              {st.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{sourceLabel(o)}</span>
            {o.batchName && (
              <span className="text-[11px] text-muted-foreground">
                {t('批次：{name}', { name: o.batchName })}
              </span>
            )}
          </div>
        </div>
      </label>
    )
  }

  const renderGroup = (items: GrantOption[], groupId: string | null, groupName: string) => {
    const isExpanded = groupId !== null && !collapsedBatches.has(groupId)
    const groupAll = items.length > 0 && items.every((o) => isChecked(o))
    const body = (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((o) => renderRow(o))}
      </div>
    )
    if (groupId === null) {
      return (
        <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">{groupName}</span>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleGroupAll(items)}>
              {groupAll ? <CheckSquare className="h-3.5 w-3.5 mr-1" /> : <Square className="h-3.5 w-3.5 mr-1" />}
              {groupAll ? t('取消全选') : t('全选')}
            </Button>
          </div>
          <div className="p-3">{body}</div>
        </div>
      )
    }
    return (
      <Collapsible
        key={groupId}
        open={isExpanded}
        onOpenChange={() => toggleBatch(groupId)}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <span className="font-medium text-gray-800">{groupName}</span>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                toggleGroupAll(items)
              }}
            >
              {groupAll ? <CheckSquare className="h-3.5 w-3.5 mr-1" /> : <Square className="h-3.5 w-3.5 mr-1" />}
              {groupAll ? t('取消全选') : t('全选')}
            </Button>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 pt-0">{body}</div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const selectedCount = typeOptions.filter((o) => isChecked(o)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('合作权限管理')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            '为企业授予岗位/场景的编辑权限：授权后企业专家可登录企业服务台查看并编辑这些资源（编辑稿需学校审批后生效）。',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-primary" />
            {t('选择企业')}
          </CardTitle>
          <CardDescription className="text-xs">{t('仅可对本校已引入的企业授权')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Select
              value={currentEnterpriseId}
              onValueChange={selectEnterprise}
              disabled={entLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('请选择企业')} />
              </SelectTrigger>
              <SelectContent>
                {(enterprises ?? []).map((e: AllianceEnterprise) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {currentEnterpriseId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Save className="h-4 w-4 text-primary" />
              {t('资源授权')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t(
                '展示本校全部岗位/场景（含各状态与批次分组），勾选即授权该企业编辑权限，保存按类型整组生效。',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={activeType}
              onValueChange={(v) => setActiveType(v as ResourceType)}
            >
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="position" className="w-full">
                  <Briefcase className="h-4 w-4 mr-1.5" />
                  {t('岗位')}
                </TabsTrigger>
                <TabsTrigger value="scene" className="w-full">
                  <Workflow className="h-4 w-4 mr-1.5" />
                  {t('场景')}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                wrapperClassName="flex-1 min-w-[220px]"
                inputClassName="h-9 text-sm"
                placeholder={t('搜索{type}名称', { type: activeType === 'position' ? t('岗位') : t('场景') })}
                value={search}
                onChange={setSearch}
              />
              <Select value={batchFilter} onValueChange={(v) => setBatchFilter(v)}>
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue placeholder={t('按批次筛选')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('全部批次')}</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                  {uncategorized.length > 0 && (
                    <SelectItem value="__none__">{t('未分类')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="h-9 text-sm w-32">
                  <SelectValue placeholder={t('按状态筛选')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('全部状态')}</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('__all__')
                  setBatchFilter('__all__')
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {t('重置')}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs text-muted-foreground mr-1">
                {t('已勾选 {count} 个{type}', {
                  count: selectedCount,
                  type: activeType === 'position' ? t('岗位') : t('场景'),
                })}
              </span>
              {filtered.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleFilteredAll}>
                  {allFilteredChecked ? <CheckSquare className="h-3.5 w-3.5 mr-1" /> : <Square className="h-3.5 w-3.5 mr-1" />}
                  {allFilteredChecked ? t('取消当前筛选全选') : t('全选当前筛选')}
                </Button>
              )}
              <div className="flex-1" />
              <Button size="sm" disabled={saving} onClick={saveCurrentType}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {t('保存{type}授权', { type: activeType === 'position' ? t('岗位') : t('场景') })}
              </Button>
            </div>

            {optionsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">{t('当前筛选条件下暂无{type}', { type: activeType === 'position' ? t('岗位') : t('场景') })}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBatches.map((b) => renderGroup(b.items, b.id, b.name))}
                {filteredUncategorized.length > 0 &&
                  renderGroup(filteredUncategorized, null, t('未分类'))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
