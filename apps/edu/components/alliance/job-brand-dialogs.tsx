'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2, Search } from 'lucide-react'
import { allianceBrandApi, portalRequest } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { useT } from '@/lib/i18n/locale-provider'
import type { JobBrand } from '@/lib/types'
import type { CareerPosition } from '@/lib/types/job'

const brandType = 'job'

export function salaryText(p: { salaryMin?: number; salaryMax?: number }) {
  if (p.salaryMin == null && p.salaryMax == null) return '-'
  if (p.salaryMin == null) return `${p.salaryMax}K`
  if (p.salaryMax == null) return `${p.salaryMin}K`
  return `${p.salaryMin}-${p.salaryMax}K`
}

export function positionTypeLabel(type?: string, t?: (k: string) => string) {
  if (type === 'teaching') return t?.('教学岗位') ?? '教学岗位'
  if (type === 'enterprise') return t?.('企业岗位') ?? '企业岗位'
  return '-'
}

// ── 引用职业岗位库（教学岗位只读关联） ────────────────────────────

export function JobBrandRefDialog({
  tenantId,
  items,
  onSaved,
  open,
  onOpenChange,
}: {
  tenantId?: string
  items: JobBrand[]
  onSaved: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const t = useT()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CareerPosition[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { data: positions, loading } = useAsync(
    async () => {
      if (!open || !tenantId) return []
      const res = await portalRequest<{ items: CareerPosition[] }>(
        '/job/positions?positionType=teaching&limit=200',
      )
      return res.items || []
    },
    { deps: [open, tenantId], onError: () => true },
  )

  const referencedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const b of items) if (b.positionId) ids.add(b.positionId)
    return ids
  }, [items])

  const referable = useMemo(() => {
    const list = (positions ?? []).filter((p) => !referencedIds.has(p.id))
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter((p) => p.name.toLowerCase().includes(kw))
  }, [positions, referencedIds, search])

  const toggle = (p: CareerPosition) => {
    setSelected((prev) =>
      prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p],
    )
  }

  const confirm = async () => {
    if (selected.length === 0) return
    setSubmitting(true)
    try {
      for (const p of selected) {
        await allianceBrandApi.create({
          brandType,
          name: p.name,
          positionId: p.id,
          isPublic: false,
        } as any)
      }
      toast({ title: t('已引用 {count} 个岗位', { count: selected.length }) })
      setSelected([])
      setSearch('')
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast({ title: t('引用失败'), description: e.message || t('未知错误'), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected([]); onOpenChange(v) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('引用职业岗位库')}</DialogTitle>
          <DialogDescription>
            {t('从岗位库中选择教学岗位，关联为岗位品牌（仅关联，岗位内容不可修改）')}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('搜索岗位名称...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : referable.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('没有可引用的教学岗位')}
            </p>
          ) : (
            referable.map((p) => {
              const checked = selected.some((x) => x.id === p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    checked ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {salaryText(p)} · {p.majorNames?.join('、') || '-'}
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
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('取消')}
          </Button>
          <Button size="sm" onClick={confirm} disabled={selected.length === 0 || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {t('确认引用 ({count})', { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── 新增独立岗位 / 编辑企业岗位（企业岗位仅在本模块可见，可编辑） ──

export function JobBrandEditDialog({
  target,
  onClose,
  onSaved,
}: {
  target: JobBrand | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const t = useT()
  const [form, setForm] = useState<{
    name: string
    industryId: string
    salaryMin?: number
    salaryMax?: number
    majorIds: string[]
    description: string
  }>({ name: '', industryId: '', salaryMin: undefined, salaryMax: undefined, majorIds: [], description: '' })
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!target?.id
  const open = !!target

  const { data: industryOptions } = useAsync(
    async () => {
      if (!open) return []
      const res = await portalRequest<{ items: { id: string; name: string }[] }>('/industries?limit=200')
      return res.items || []
    },
    { deps: [open], onError: () => true },
  )

  const { data: majorOptions } = useAsync(
    async () => {
      if (!open) return []
      const res = await portalRequest<{ items: { id: string; name: string }[] }>('/majors?limit=200')
      return res.items || []
    },
    { deps: [open], onError: () => true },
  )

  // target 变化时初始化表单（编辑企业岗位 / 新建）
  useAsync(
    async () => {
      if (!open) return true
      if (isEdit && target.positionId) {
        const pos = await portalRequest<CareerPosition>(`/job/positions/${target.positionId}`).catch(
          () => null,
        )
        setForm({
          name: target.name || pos?.name || '',
          industryId: pos?.industryId || '',
          salaryMin: pos?.salaryMin ?? undefined,
          salaryMax: pos?.salaryMax ?? undefined,
          majorIds: pos?.majorIds ?? [],
          description: pos?.description || target.description || '',
        })
      } else {
        setForm({ name: '', industryId: '', salaryMin: undefined, salaryMax: undefined, majorIds: [], description: '' })
      }
      return true
    },
    { deps: [open, isEdit, target?.positionId, target?.id] },
  )

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: t('岗位名称不能为空'), variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const positionPayload = {
        name: form.name.trim(),
        positionType: 'enterprise',
        industryId: form.industryId || undefined,
        salaryMin: form.salaryMin,
        salaryMax: form.salaryMax,
        majorIds: form.majorIds,
        description: form.description || undefined,
        version: 'V1.0',
      }
      if (isEdit && target.positionId) {
        await portalRequest(`/job/positions/${target.positionId}`, {
          method: 'PUT',
          body: JSON.stringify(positionPayload),
        })
        await allianceBrandApi.update(target.id, { name: form.name.trim() } as any)
        toast({ title: t('岗位品牌已更新') })
      } else {
        const pos = await portalRequest<CareerPosition>('/job/positions', {
          method: 'POST',
          body: JSON.stringify(positionPayload),
        })
        await allianceBrandApi.create({
          brandType,
          name: pos.name,
          positionId: pos.id,
          isPublic: false,
        } as any)
        toast({ title: t('独立岗位已创建') })
      }
      onClose()
      onSaved()
    } catch (e: any) {
      toast({
        title: isEdit ? t('保存失败') : t('创建失败'),
        description: e.message || t('未知错误'),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('编辑企业岗位') : t('新增独立岗位')}</DialogTitle>
          <DialogDescription>
            {t('企业岗位仅在岗位品牌模块中可见和管理，不进入职业岗位库')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <FormFieldRow label={t('岗位名称')} required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormFieldRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormFieldRow label={t('所属行业')}>
              <Select value={form.industryId} onValueChange={(v) => setForm({ ...form, industryId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('选择行业...')} />
                </SelectTrigger>
                <SelectContent>
                  {(industryOptions ?? []).map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label={t('薪资范围（K）')}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder={t('最低')}
                  value={form.salaryMin ?? ''}
                  onChange={(e) => setForm({ ...form, salaryMin: Number(e.target.value) || undefined })}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  min={0}
                  placeholder={t('最高')}
                  value={form.salaryMax ?? ''}
                  onChange={(e) => setForm({ ...form, salaryMax: Number(e.target.value) || undefined })}
                />
              </div>
            </FormFieldRow>
          </div>
          <FormFieldRow label={t('面向专业')}>
            <MultiSelect
              options={(majorOptions ?? []).map((m) => ({ label: m.name, value: m.id }))}
              value={form.majorIds}
              onChange={(values) => setForm({ ...form, majorIds: values })}
              placeholder={t('选择专业...')}
            />
          </FormFieldRow>
          <FormFieldRow label={t('岗位介绍')}>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </FormFieldRow>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('取消')}
          </Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
