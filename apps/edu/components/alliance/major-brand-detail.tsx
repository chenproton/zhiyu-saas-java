'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi, allianceEnterpriseApi, allianceAchievementApi, portalRequest } from '@/lib/api'
import { useToast, FormDialogFooter } from '@zhiyu/ui'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { RelatedObjectCard } from '@/components/alliance/related-object-card'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { SingleImageUpload } from '@/components/shared/image-list-upload'
import { SearchInput } from '@/components/shared/search-input'
import { useT } from '@/lib/i18n/locale-provider'
import { allianceLabel } from '@zhiyu/shared-types'
import type { AllianceBrand } from '@/lib/types'

interface RefItem {
  id: string
  name: string
}

interface MajorBrandData {
  employmentDirections?: RefItem[]
  cooperationEnterprises?: RefItem[]
  cooperationAchievements?: RefItem[]
  featuredCourses?: RefItem[]
}

export function MajorBrandDetail({ id }: { id: string }) {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()

  const [brand, setBrand] = useState<AllianceBrand | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || !tenantId) return
    allianceBrandApi
      .get(id)
      .then((b) => setBrand(b))
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id, tenantId, toast, t])

  const data = useMemo<MajorBrandData>(() => brand?.data ?? {}, [brand])

  const saveData = async (next: MajorBrandData) => {
    if (!brand) return
    setSaving(true)
    try {
      await allianceBrandApi.update(brand.id, { data: { ...(brand.data || {}), ...next } } as any)
      setBrand({ ...brand, data: { ...(brand.data || {}), ...next } })
      toast({ title: t('已保存') })
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const saveDisplayInfo = async () => {
    if (!brand) return
    setSaving(true)
    try {
      const next = {
        name: brand.name,
        coverImage: brand.coverImage,
        description: brand.description,
      }
      await allianceBrandApi.update(brand.id, next as any)
      setBrand({ ...brand, ...next })
      toast({ title: t('已保存') })
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const setSection = (key: keyof MajorBrandData, items: RefItem[]) => {
    saveData({ ...data, [key]: items })
  }

  if (!brand && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/brands" />
  }

  const tabs = [
    {
      key: 'info',
      label: t('专业信息'),
      content: (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">{t('品牌展示信息')}</h3>
            <div className="space-y-4">
              <FormFieldRow label={t('品牌名称')}>
                <Input
                  value={brand?.name || ''}
                  onChange={(e) => setBrand({ ...brand!, name: e.target.value })}
                />
              </FormFieldRow>
              <FormFieldRow label={t('封面图')}>
                <SingleImageUpload
                  label={t('封面图')}
                  value={brand?.coverImage || ''}
                  onChange={(v) =>
                    setBrand({
                      ...brand!,
                      coverImage: v || undefined,
                    })
                  }
                  allowUrlInput={false}
                />
              </FormFieldRow>
              <FormFieldRow label={t('品牌介绍')}>
                <Textarea
                  value={brand?.description || ''}
                  onChange={(e) =>
                    setBrand({
                      ...brand!,
                      description: e.target.value ? e.target.value : undefined,
                    })
                  }
                  rows={4}
                />
              </FormFieldRow>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveDisplayInfo} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {t('保存品牌信息')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'directions',
      label: t('专业就业方向'),
      badge: data.employmentDirections?.length ?? 0,
      content: (
        <RefSection
          key="directions"
          kind="brands"
          title={t('关联岗位品牌作为专业就业方向')}
          empty={t('暂未关联就业方向')}
          items={data.employmentDirections ?? []}
          onAdd={(items) => setSection('employmentDirections', items)}
          fetchOptions={async () => {
            const res = await allianceBrandApi.list({ brandType: 'job', limit: 200 })
            return (res.items ?? []).map((b) => ({
              id: b.id,
              name: (b as AllianceBrand & { positionName?: string }).name ||
                (b as AllianceBrand & { positionName?: string }).positionName ||
                '',
            }))
          }}
          placeholder={t('搜索岗位品牌...')}
          pickerTitle={t('选择岗位品牌')}
        />
      ),
    },
    {
      key: 'enterprises',
      label: t('专业合作企业'),
      badge: data.cooperationEnterprises?.length ?? 0,
      content: (
        <RefSection
          key="enterprises"
          kind="enterprises"
          title={t('关联合作企业')}
          empty={t('暂未关联合作企业')}
          items={data.cooperationEnterprises ?? []}
          onAdd={(items) => setSection('cooperationEnterprises', items)}
          fetchOptions={async () => {
            // 合作企业 + 独立雇主企业品牌（独立雇主企业前台跳品牌详情页）
            const [entsRes, brandsRes] = await Promise.all([
              allianceEnterpriseApi.list({ limit: 200 }),
              allianceBrandApi.list({ brandType: 'employer', limit: 200 }),
            ])
            const enterpriseItems = (entsRes.items ?? []).map((e) => ({
              id: e.id,
              name: e.name,
            }))
            const brandItems = (brandsRes.items ?? [])
              .filter((b) => !b.enterpriseId)
              .map((b) => ({ id: b.id, name: b.name }))
            return [...enterpriseItems, ...brandItems]
          }}
          placeholder={t('搜索企业名称...')}
          pickerTitle={t('选择合作企业')}
        />
      ),
    },
    {
      key: 'achievements',
      label: t('专业合作成果'),
      badge: data.cooperationAchievements?.length ?? 0,
      content: (
        <RefSection
          key="achievements"
          kind="achievements"
          title={t('关联合作成果')}
          empty={t('暂未关联合作成果')}
          items={data.cooperationAchievements ?? []}
          onAdd={(items) => setSection('cooperationAchievements', items)}
          fetchOptions={async () => {
            const res = await allianceAchievementApi.list({ limit: 200 })
            return (res.items ?? []).map((a) => ({ id: a.id, name: a.title }))
          }}
          placeholder={t('搜索成果标题...')}
          pickerTitle={t('选择合作成果')}
        />
      ),
    },
    {
      key: 'courses',
      label: t('专业特色课程'),
      badge: data.featuredCourses?.length ?? 0,
      content: (
        <RefSection
          key="courses"
          kind="courses"
          title={t('关联特色课程')}
          empty={t('暂未关联特色课程')}
          items={data.featuredCourses ?? []}
          onAdd={(items) => setSection('featuredCourses', items)}
          fetchOptions={async () => {
            const res = await portalRequest<{ items: { id: string; name: string }[] }>(
              '/lesson/courses?limit=200',
            )
            return (res.items ?? []).map((c) => ({ id: c.id, name: c.name }))
          }}
          placeholder={t('搜索课程名称...')}
          pickerTitle={t('选择特色课程')}
        />
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={brand?.name || ''}
      subtitle={allianceLabel('brandType', brand?.brandType)}
      backHref="/portal/apps/alliance/brands/major"
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}

// ── 通用关联管理区块（卡片展示 + 选择/移除关联对象，卡片可跳转对应详情页） ─────────

function RefSection({
  kind,
  title,
  empty,
  items,
  onAdd,
  fetchOptions,
  placeholder,
  pickerTitle,
}: {
  kind: 'brands' | 'enterprises' | 'achievements' | 'courses'
  title: string
  empty: string
  items: RefItem[]
  onAdd: (items: RefItem[]) => void
  fetchOptions: () => Promise<RefItem[]>
  placeholder: string
  pickerTitle: string
}) {
  const { toast } = useToast()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<RefItem[]>([])
  const [options, setOptions] = useState<RefItem[]>([])
  const [loading, setLoading] = useState(false)

  const openPicker = async () => {
    setOpen(true)
    setSearch('')
    setSelected([])
    setLoading(true)
    try {
      setOptions(await fetchOptions())
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  const existingIds = useMemo(() => new Set(items.map((i) => i.id)), [items])

  const referable = useMemo(() => {
    const list = options.filter((o) => !existingIds.has(o.id))
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter((o) => o.name.toLowerCase().includes(kw))
  }, [options, existingIds, search])

  const toggle = (item: RefItem) => {
    setSelected((prev) =>
      prev.some((x) => x.id === item.id) ? prev.filter((x) => x.id !== item.id) : [...prev, item],
    )
  }

  const confirm = () => {
    if (selected.length === 0) return
    onAdd([...items, ...selected])
    toast({ title: t('已关联 {count} 项', { count: selected.length }) })
    setOpen(false)
  }

  const remove = (itemId: string) => {
    onAdd(items.filter((i) => i.id !== itemId))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button size="sm" variant="outline" onClick={openPicker}>
          <Plus className="h-4 w-4 mr-1" />
          {t('关联')}
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-100 bg-white p-12 text-center text-sm text-muted-foreground shadow-sm">
          {empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <RelatedObjectCard key={item.id} item={item} kind={kind}>
              <button
                className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                title={t('取消关联')}
                onClick={() => remove(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </RelatedObjectCard>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pickerTitle}</DialogTitle>
            <DialogDescription>{t('选择后确认关联')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              confirm()
            }}
            className="grid gap-4"
          >
            <SearchInput placeholder={placeholder} value={search} onChange={setSearch} />
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : referable.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('没有可选内容')}</p>
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
                    <span className="truncate text-sm font-medium">{o.name}</span>
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
          <FormDialogFooter
            onCancel={() => setOpen(false)}
            confirmText={t('确认关联 ({count})', { count: selected.length })}
            cancelText={t('取消')}
            confirmDisabled={selected.length === 0}
          />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
