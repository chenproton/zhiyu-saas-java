'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Pencil, Plus, Trash2, Search, Loader2, Briefcase, UserRound } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi, portalRequest } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { useT } from '@/lib/i18n/locale-provider'
import { allianceLabel } from '@zhiyu/shared-types'
import type { EmployerBrand, CareerPosition } from '@/lib/types'

interface HiredStudent {
  studentId: string
  name: string
  studentNo?: string
  jobId: string
  jobName?: string
}

interface PositionSnapshot {
  id: string
  name: string
  positionType?: string
  salaryMin?: number
  salaryMax?: number
  majorNames?: string[]
}

function salaryText(p: PositionSnapshot) {
  if (p.salaryMin == null && p.salaryMax == null) return '-'
  if (p.salaryMin == null) return `${p.salaryMax}K`
  if (p.salaryMax == null) return `${p.salaryMin}K`
  return `${p.salaryMin}-${p.salaryMax}K`
}

interface EmployerBrandDetailProps {
  id: string
}

export function EmployerBrandDetail({ id }: EmployerBrandDetailProps) {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()

  const [brand, setBrand] = useState<EmployerBrand | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id || !tenantId) return
    allianceBrandApi
      .get(id)
      .then((b) => setBrand(b as EmployerBrand))
      .catch((e) =>
        toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }, [id, tenantId, reloadKey, toast, t])

  const positions = useMemo<PositionSnapshot[]>(() => brand?.data?.positions ?? [], [brand])
  const hiredStudents = useMemo<HiredStudent[]>(() => brand?.data?.hiredStudents ?? [], [brand])

  const isIndependent = !!brand && !brand.enterpriseId
  const info = (brand?.data?.enterpriseInfo ?? {}) as Record<string, any>

  const saveData = async (nextPositions: PositionSnapshot[], nextStudents: HiredStudent[]) => {
    if (!brand) return
    setSaving(true)
    try {
      await allianceBrandApi.update(brand.id, {
        data: { ...(brand.data || {}), positions: nextPositions, hiredStudents: nextStudents },
      })
      setBrand({
        ...brand,
        data: { ...(brand.data || {}), positions: nextPositions, hiredStudents: nextStudents },
      })
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const removePosition = async (pid: string) => {
    const nextPositions = positions.filter((p) => p.id !== pid)
    const nextStudents = hiredStudents.filter((s) => s.jobId !== pid)
    await saveData(nextPositions, nextStudents)
  }

  const removeStudent = async (studentId: string) => {
    await saveData(positions, hiredStudents.filter((s) => s.studentId !== studentId))
  }

  const addPositions = async (items: PositionSnapshot[]) => {
    await saveData(
      [...positions, ...items.filter((p) => !positions.some((x) => x.id === p.id))],
      hiredStudents,
    )
  }

  const addStudents = async (items: HiredStudent[]) => {
    await saveData(
      positions,
      [
        ...hiredStudents,
        ...items.filter((s) => !hiredStudents.some((x) => x.studentId === s.studentId)),
      ],
    )
  }

  const studentsByJob = useMemo(() => {
    const map = new Map<string, HiredStudent[]>()
    for (const s of hiredStudents) {
      const key = s.jobId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [hiredStudents])

  if (!brand && !loading) {
    return <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/brands" />
  }

  const enterpriseRows: { label: string; value?: string }[] = isIndependent
    ? [
        { label: t('企业名称'), value: brand?.name },
        { label: t('统一社会信用代码'), value: info.creditCode },
        { label: t('所属行业'), value: info.industry },
        { label: t('联系人'), value: info.contactPerson },
        { label: t('联系电话'), value: info.contactPhone },
        { label: t('联系邮箱'), value: info.contactEmail },
        { label: t('企业地址'), value: info.address },
      ]
    : [
        { label: t('企业名称'), value: brand?.enterpriseName },
        { label: t('统一社会信用代码'), value: brand?.enterpriseCreditCode },
        { label: t('所属行业'), value: brand?.enterpriseIndustry },
        { label: t('所在地区'), value: brand?.enterpriseRegion },
        { label: t('联系人'), value: brand?.enterpriseContactPerson },
        { label: t('联系电话'), value: brand?.enterpriseContactPhone },
        { label: t('联系邮箱'), value: brand?.enterpriseContactEmail },
        { label: t('企业地址'), value: brand?.enterpriseAddress },
      ].filter((x) => x.value)
  const enterpriseDesc = isIndependent ? info.description : brand?.enterpriseDescription
  const enterpriseLogo = isIndependent ? info.logo : brand?.enterpriseLogo

  const tabs = [
    {
      key: 'info',
      label: t('基本信息'),
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('品牌信息')}</h3>
                {isIndependent && (
                  <EditInfoButton brand={brand} onSaved={() => setReloadKey((k) => k + 1)} />
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{t('品牌类型：')}</span>
                  {allianceLabel('brandType', brand?.brandType)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('推荐：')}</span>
                  {brand?.isFeatured ? t('是') : t('否')}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('前台展示：')}</span>
                  {brand?.isPublic ? t('是') : t('否')}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('浏览量：')}</span>
                  {brand?.viewCount || 0}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{t('企业资料')}</h3>
                {!isIndependent && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                    {t('来自合作企业库，只读')}
                  </span>
                )}
              </div>
              {enterpriseLogo && (
                <div className="mb-3 flex items-center gap-3">
                  <Image
                    src={enterpriseLogo}
                    alt={brand?.name || ''}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-lg border object-cover"
                  />
                  <span className="text-base font-semibold">{brand?.name}</span>
                </div>
              )}
              <div className="space-y-2 text-sm">
                {enterpriseRows.map((r) => (
                  <p key={r.label}>
                    <span className="text-muted-foreground">{r.label}：</span>
                    {r.value || t('暂无')}
                  </p>
                ))}
                {enterpriseDesc && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {enterpriseDesc}
                  </p>
                )}
              </div>
            </div>
          </div>
          {brand?.description && (
            <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">{t('品牌描述')}</h3>
              <p className="text-sm whitespace-pre-wrap">{brand.description}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'positions',
      label: t('关联岗位'),
      badge: positions.length,
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <PositionPickerDialog
              tenantId={tenantId}
              existing={positions}
              onConfirm={addPositions}
            />
          </div>
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>{t('岗位名称')}</TableHead>
                  <TableHead>{t('分类')}</TableHead>
                  <TableHead>{t('薪资范围')}</TableHead>
                  <TableHead>{t('面向专业')}</TableHead>
                  <TableHead className="w-16">{t('操作')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {t('暂未关联岗位')}
                    </TableCell>
                  </TableRow>
                ) : (
                  positions.map((p) => (
                    <TableRow key={p.id} className="border-border">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {p.positionType === 'teaching'
                          ? t('教学岗位')
                          : p.positionType === 'enterprise'
                            ? t('企业岗位')
                            : '-'}
                      </TableCell>
                      <TableCell>{salaryText(p)}</TableCell>
                      <TableCell className="max-w-56 truncate">
                        {p.majorNames?.join('、') || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={saving}
                          onClick={() => removePosition(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {t('移除')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ),
    },
    {
      key: 'students',
      label: t('已招聘学生'),
      badge: hiredStudents.length,
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <StudentPickerDialog
              tenantId={tenantId}
              positions={positions}
              existing={hiredStudents}
              onConfirm={addStudents}
            />
          </div>
          {hiredStudents.length === 0 ? (
            <div className="rounded-lg border border-gray-100 bg-white p-12 text-center text-sm text-muted-foreground shadow-sm">
              {t('暂未关联学生')}
            </div>
          ) : (
            [...studentsByJob.entries()].map(([jobId, students]) => {
              const job = positions.find((p) => p.id === jobId)
              return (
                <div key={jobId} className="rounded-lg border border-gray-100 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{job?.name || t('未分配岗位')}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {students.map((s) => (
                      <div key={s.studentId} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-sm font-medium text-primary">
                            {s.name?.charAt(0) || <UserRound className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.studentNo || '-'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={saving}
                          onClick={() => removeStudent(s.studentId)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {t('移除')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={brand?.name || ''}
      subtitle={allianceLabel('brandType', brand?.brandType)}
      backHref="/portal/apps/alliance/brands"
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}

// ── 独立雇主企业资料编辑 ────────────────────────────────────────

function EditInfoButton({ brand, onSaved }: { brand: EmployerBrand; onSaved: () => void }) {
  const { toast } = useToast()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)

  const openEdit = () => {
    setForm(brand.data?.enterpriseInfo ?? {})
    setOpen(true)
  }

  const save = async () => {
    if (!form.name?.trim()) {
      toast({ title: t('企业名称不能为空'), variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await allianceBrandApi.update(brand.id, {
        name: form.name,
        data: { ...(brand.data || {}), enterpriseInfo: form },
      })
      toast({ title: t('企业资料已更新') })
      setOpen(false)
      onSaved()
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openEdit}>
        <Pencil className="h-3.5 w-3.5 mr-1" />
        {t('编辑资料')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('编辑独立雇主企业')}</DialogTitle>
            <DialogDescription>{t('仅在本模块展示，不会加入合作企业库')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormFieldRow label={t('企业名称')} required>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormFieldRow>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormFieldRow label={t('统一社会信用代码')}>
                <Input
                  value={form.creditCode || ''}
                  onChange={(e) => setForm({ ...form, creditCode: e.target.value })}
                />
              </FormFieldRow>
              <FormFieldRow label={t('所属行业')}>
                <Input
                  value={form.industry || ''}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                />
              </FormFieldRow>
              <FormFieldRow label={t('联系人')}>
                <Input
                  value={form.contactPerson || ''}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </FormFieldRow>
              <FormFieldRow label={t('联系电话')}>
                <Input
                  value={form.contactPhone || ''}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                />
              </FormFieldRow>
              <FormFieldRow label={t('联系邮箱')}>
                <Input
                  value={form.contactEmail || ''}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                />
              </FormFieldRow>
              <FormFieldRow label={t('企业地址')}>
                <Input
                  value={form.address || ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </FormFieldRow>
            </div>
            <FormFieldRow label={t('Logo URL')}>
              <Input value={form.logo || ''} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
            </FormFieldRow>
            <FormFieldRow label={t('企业简介')}>
              <Textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </FormFieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t('取消')}
            </Button>
            <Button size="sm" onClick={save} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── 引用岗位 ───────────────────────────────────────────────────

function PositionPickerDialog({
  tenantId,
  existing,
  onConfirm,
}: {
  tenantId?: string
  existing: PositionSnapshot[]
  onConfirm: (items: PositionSnapshot[]) => void
}) {
  const { toast } = useToast()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PositionSnapshot[]>([])

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

  const referable = useMemo(() => {
    const existingIds = new Set(existing.map((p) => p.id))
    const list = (positions ?? []).filter((p) => !existingIds.has(p.id))
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter((p) => p.name.toLowerCase().includes(kw))
  }, [positions, existing, search])

  const toggle = (p: CareerPosition) => {
    const snap: PositionSnapshot = {
      id: p.id,
      name: p.name,
      positionType: p.positionType,
      salaryMin: p.salaryMin,
      salaryMax: p.salaryMax,
      majorNames: p.majorNames,
    }
    setSelected((prev) =>
      prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, snap],
    )
  }

  const confirm = () => {
    if (selected.length === 0) return
    onConfirm(selected)
    toast({ title: t('已关联 {count} 个岗位', { count: selected.length }) })
    setOpen(false)
    setSelected([])
    setSearch('')
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        {t('引用岗位')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('引用职业岗位库')}</DialogTitle>
            <DialogDescription>{t('从已有岗位库中选择岗位关联到雇主品牌')}</DialogDescription>
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
              <p className="py-8 text-center text-sm text-muted-foreground">{t('没有可引用的岗位')}</p>
            ) : (
              referable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    selected.some((x) => x.id === p.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-100 hover:border-primary/30'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.positionType === 'teaching' ? t('教学岗位') : t('企业岗位')} ·{' '}
                      {salaryText(p as PositionSnapshot)}
                    </p>
                  </div>
                  <span
                    className={`h-3 w-3 shrink-0 rounded border ${
                      selected.some((x) => x.id === p.id)
                        ? 'border-primary bg-primary'
                        : 'border-slate-300'
                    }`}
                  />
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t('取消')}
            </Button>
            <Button size="sm" onClick={confirm} disabled={selected.length === 0}>
              {t('确认关联 ({count})', { count: selected.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── 关联学生 ───────────────────────────────────────────────────

interface StudentOption {
  id: string
  name: string
  studentNo?: string
  username?: string
  loginName?: string
}

function StudentPickerDialog({
  tenantId,
  positions,
  existing,
  onConfirm,
}: {
  tenantId?: string
  positions: PositionSnapshot[]
  existing: HiredStudent[]
  onConfirm: (items: HiredStudent[]) => void
}) {
  const { toast } = useToast()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [jobId, setJobId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: students, loading } = useAsync(
    async () => {
      if (!open || !tenantId) return []
      const res = await portalRequest<{ items: StudentOption[] }>('/users?role=student&limit=200')
      return res.items || []
    },
    { deps: [open, tenantId], onError: () => true },
  )

  const referable = useMemo(() => {
    const existingIds = new Set(existing.map((s) => s.studentId))
    const list = (students ?? []).filter((s) => !existingIds.has(s.id))
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.studentNo || s.username || s.loginName || '').toLowerCase().includes(kw),
    )
  }, [students, existing, search])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const confirm = () => {
    const job = positions.find((p) => p.id === jobId)
    const items: HiredStudent[] = (students ?? [])
      .filter((s) => selected.has(s.id))
      .map((s) => ({
        studentId: s.id,
        name: s.name,
        studentNo: s.studentNo || s.username || s.loginName || '',
        jobId,
        jobName: job?.name,
      }))
    if (items.length === 0) return
    onConfirm(items)
    toast({ title: t('已关联 {count} 名学生', { count: items.length }) })
    setOpen(false)
    setSelected(new Set())
    setSearch('')
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        {t('关联学生')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('关联学生')}</DialogTitle>
            <DialogDescription>{t('选择已招聘学生及其雇佣岗位')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">{t('雇佣岗位')}</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('选择岗位...')} />
                </SelectTrigger>
                <SelectContent>
                  {positions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {t('请先关联岗位')}
                    </div>
                  ) : (
                    positions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('搜索学生姓名或学号...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : referable.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('没有可关联的学生')}</p>
            ) : (
              referable.map((s) => {
                const checked = selected.has(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors ${
                      checked ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 shrink-0 rounded border ${
                        checked ? 'border-primary bg-primary' : 'border-slate-300'
                      }`}
                    />
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.studentNo || s.username || s.loginName || ''}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t('取消')}
            </Button>
            <Button size="sm" onClick={confirm} disabled={selected.size === 0 || !jobId}>
              {t('确认关联 ({count})', { count: selected.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
