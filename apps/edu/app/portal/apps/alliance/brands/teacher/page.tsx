'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Trash2, Loader2, Search, UserRound } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi, allianceExpertApi, portalRequest } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceBrand, AllianceExpert } from '@/lib/types'

const brandType = 'teacher'

interface TeacherOption {
   id: string
   name: string
   username?: string
   title?: string
   department?: string
   position?: string
}

export default function AllianceTeacherBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()

  const { data: brands, loading, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const data = await allianceBrandApi.list({ brandType, limit: 200 })
      return data.items || []
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const items = useMemo(() => (brands ?? []) as AllianceBrand[], [brands])

  const schoolBrands = useMemo(() => items.filter((b) => b.teacherId), [items])
  const expertBrands = useMemo(() => items.filter((b) => b.expertId), [items])

  const toggleBrandField = async (item: AllianceBrand, field: 'isPublic' | 'isFeatured', value: boolean) => {
    try {
      await allianceBrandApi.update(item.id, { [field]: value } as any)
      toast({ title: t('已更新') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('更新失败'), description: e.message, variant: 'destructive' })
    }
  }

  const onDelete = async (item: AllianceBrand) => {
    try {
      await allianceBrandApi.delete(item.id)
      toast({ title: t('已解除关联') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-full">
      <Tabs defaultValue="school" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="school" className="rounded-lg">
            {t('校本师资')}（{schoolBrands.length}）
          </TabsTrigger>
          <TabsTrigger value="expert" className="rounded-lg">
            {t('企业专家师资')}（{expertBrands.length}）
          </TabsTrigger>
        </TabsList>

        <TabsContent value="school">
          <TeacherBrandSection
            title={t('校本师资管理')}
            description={t('从系统教师库关联教师（只读展示，不可编辑教师信息）')}
            items={schoolBrands}
            loading={loading}
            onToggle={toggleBrandField}
            onDelete={onDelete}
            onSaved={refresh}
            linkField="teacherId"
            fetchOptions={async () => {
              const res = await portalRequest<{ items: TeacherOption[] }>(
                '/users?role=teacher&limit=200',
              )
              return res.items || []
            }}
            pickerTitle={t('关联校本教师')}
            searchPlaceholder={t('搜索教师姓名或工号...')}
            displayInfo={(b) => (
              <span className="text-xs text-muted-foreground">
                {t('关联教师：{id}', { id: b.teacherId ?? '' })}
              </span>
            )}
          />
        </TabsContent>

        <TabsContent value="expert">
          <TeacherBrandSection
            title={t('企业专家师资管理')}
            description={t('从企业专家库关联专家（只读展示，不可编辑专家信息）')}
            items={expertBrands}
            loading={loading}
            onToggle={toggleBrandField}
            onDelete={onDelete}
            onSaved={refresh}
            linkField="expertId"
            fetchOptions={async () => {
              const res = await allianceExpertApi.list({ limit: 200 })
              return (res.items ?? []).map((e: AllianceExpert) => ({
                id: e.id,
                name: e.name,
                title: e.title || e.position,
                position: e.organization,
              }))
            }}
            pickerTitle={t('关联企业专家')}
            searchPlaceholder={t('搜索专家姓名或机构...')}
            displayInfo={(b) => (
              <span className="text-xs text-muted-foreground">
                {t('关联专家：{id}', { id: b.expertId ?? '' })}
              </span>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── 通用师资关联区块（校本师资 / 企业专家共用） ────────────────────

function TeacherBrandSection({
  title,
  description,
  items,
  loading,
  onToggle,
  onDelete,
  onSaved,
  linkField,
  fetchOptions,
  pickerTitle,
  searchPlaceholder,
  displayInfo,
}: {
  title: string
  description: string
  items: AllianceBrand[]
  loading: boolean
  onToggle: (item: AllianceBrand, field: 'isPublic' | 'isFeatured', value: boolean) => void
  onDelete: (item: AllianceBrand) => void
  onSaved: () => void
  linkField: 'teacherId' | 'expertId'
  fetchOptions: () => Promise<TeacherOption[]>
  pickerTitle: string
  searchPlaceholder: string
  displayInfo: (brand: AllianceBrand) => React.ReactNode
}) {
  const { toast } = useToast()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<TeacherOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [options, setOptions] = useState<TeacherOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  const openPicker = async () => {
    setOpen(true)
    setSearch('')
    setSelected([])
    setOptionsLoading(true)
    try {
      setOptions(await fetchOptions())
    } catch {
      setOptions([])
    } finally {
      setOptionsLoading(false)
    }
  }

  const existingIds = useMemo(() => {
    const ids = new Set<string>()
    for (const b of items) {
      if (b.teacherId) ids.add(b.teacherId)
      if (b.expertId) ids.add(b.expertId)
    }
    return ids
  }, [items])

  const referable = useMemo(() => {
    const list = options.filter((o) => !existingIds.has(o.id))
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter(
      (o) =>
        o.name.toLowerCase().includes(kw) ||
        (o.title || '').toLowerCase().includes(kw) ||
        (o.department || '').toLowerCase().includes(kw) ||
        (o.position || '').toLowerCase().includes(kw),
    )
  }, [options, existingIds, search])

  const toggle = (o: TeacherOption) => {
    setSelected((prev) =>
      prev.some((x) => x.id === o.id) ? prev.filter((x) => x.id !== o.id) : [...prev, o],
    )
  }

  const confirm = async () => {
    if (selected.length === 0) return
    setSubmitting(true)
    try {
      for (const o of selected) {
        const payload: any = { brandType, name: o.name, isPublic: false }
        payload[linkField] = o.id
        await allianceBrandApi.create(payload)
      }
      toast({ title: t('已关联 {count} 人', { count: selected.length }) })
      setOpen(false)
      onSaved()
    } catch (e: any) {
      toast({ title: t('关联失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" onClick={openPicker}>
          <UserRound className="h-4 w-4 mr-1" />
          {t('关联{title}', { title: pickerTitle.replace('关联', '') })}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-white p-12 text-center text-sm text-muted-foreground shadow-sm">
          {t('暂未关联师资，点击右上角按钮关联')}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <TableHead>{t('姓名')}</TableHead>
                <TableHead>{t('前台展示')}</TableHead>
                <TableHead>{t('推荐')}</TableHead>
                <TableHead>{t('来源')}</TableHead>
                <TableHead>{t('操作')}</TableHead>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-gray-50">
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    <Switch
                      checked={b.isPublic}
                      onCheckedChange={(v) => onToggle(b, 'isPublic', v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={b.isFeatured}
                      onCheckedChange={(v) => onToggle(b, 'isFeatured', v)}
                    />
                  </TableCell>
                  <TableCell>{displayInfo(b)}</TableCell>
                  <TableRowActions>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => onDelete(b)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {t('解除关联')}
                    </Button>
                  </TableRowActions>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pickerTitle}</DialogTitle>
            <DialogDescription>{t('选择后关联到师资品牌（只读展示）')}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {optionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : referable.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('没有可选人员')}</p>
            ) : (
              referable.map((o) => {
                const checked = selected.some((x) => x.id === o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                      checked ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[o.title, o.department, o.position].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                    <span
                      className={`h-3 w-3 shrink-0 rounded border ${
                        checked ? 'border-primary bg-primary' : 'border-slate-300'
                      }`}
                    />
                  </button>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t('取消')}
            </Button>
            <Button size="sm" onClick={confirm} disabled={selected.length === 0 || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {t('确认关联 ({count})', { count: selected.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
