'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { allianceBrandApi, portalRequest } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { StepBasicInfo } from '@/components/job/position-builder/step-basic-info'
import { SearchInput } from '@/components/shared/search-input'
import { useT } from '@/lib/i18n/locale-provider'
import {
  convertCareerPositionToPosition,
  convertApiResponsibilityToLocal,
  convertApiCertificateToLocal,
} from '@/lib/converters/job-converters'
import type { JobBrand } from '@/lib/types'
import type { CareerPosition, PositionResponsibility, PositionCertificate } from '@/lib/types/job'
import type { Position } from '@/lib/types/job-source'

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
        <SearchInput
          placeholder={t('搜索岗位名称...')}
          value={search}
          onChange={setSearch}
        />
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
// 复用 /job/positions 编辑页步骤 1「岗位基础信息」表单（StepBasicInfo），
// 不含步骤 2/3 能力建模配置；岗位类型锁定为"企业岗位"。

/** 新建独立岗位的初始 Position（对齐 /job/positions 新建草稿，岗位类型固定企业岗位） */
function createInitialPosition(): Position {
  return {
    id: '',
    code: '',
    batchId: '',
    version: 'V1.0',
    status: 'draft',
    name: '',
    shortName: '',
    industry: '',
    majors: [],
    positionType: 'enterprise',
    salaryRange: [0, 0],
    coverImage: undefined,
    certificates: [],
    description: '',
    responsibilities: [{ id: `resp-${Date.now()}`, name: '', description: '' }],
    requirements: [''],
    careerPath: '',
    abilityModel: { nodes: [], edges: [] },
    abilityBindings: [],
    abilityDomains: [],
    competencyConfig: [],
    createdBy: '',
    collaborators: [],
    createdAt: '',
    updatedAt: '',
    sourceType: 'school',
    favoriteCount: 0,
  }
}

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
  const [position, setPosition] = useState<Position | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!target?.id
  const open = !!target

  // target 变化时初始化表单：编辑加载岗位步骤 1 数据（含职责/证书），新建给初始草稿
  useAsync(
    async () => {
      if (!open) return true
      setLoading(true)
      try {
        if (isEdit && target.positionId) {
          const cp = await portalRequest<CareerPosition>(`/job/positions/${target.positionId}`).catch(
            () => null,
          )
          if (!cp) {
            setPosition(null)
            return true
          }
          const base = convertCareerPositionToPosition(cp)
          const [respRes, certRes] = await Promise.all([
            portalRequest<{ items: PositionResponsibility[] }>(
              `/job/position-responsibilities?careerPositionId=${cp.id}&limit=1000`,
            ).catch(() => ({ items: [] as PositionResponsibility[] })),
            portalRequest<{ items: PositionCertificate[] }>(
              `/job/position-certificates?careerPositionId=${cp.id}&limit=1000`,
            ).catch(() => ({ items: [] as PositionCertificate[] })),
          ])
          const responsibilities = respRes.items.map(convertApiResponsibilityToLocal)
          const certificates = certRes.items.map(convertApiCertificateToLocal)
          setPosition({
            ...base,
            positionType: 'enterprise',
            responsibilities:
              responsibilities.length > 0
                ? responsibilities
                : [{ id: `resp-${Date.now()}`, name: '', description: '' }],
            certificates,
            requirements: base.requirements.length > 0 ? base.requirements : [''],
          })
        } else {
          setPosition(createInitialPosition())
        }
      } finally {
        setLoading(false)
      }
      return true
    },
    { deps: [open, isEdit, target?.positionId, target?.id] },
  )

  const save = async () => {
    if (!position) return
    const name = position.name.trim()
    if (!name) {
      toast({ title: t('岗位名称不能为空'), variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const saveFullPayload = {
        batchId: position.batchId,
        name,
        shortName: position.shortName,
        industry: position.industry,
        majors: position.majors,
        positionType: 'enterprise',
        salaryRange: position.salaryRange,
        coverImage: position.coverImage,
        description: position.description,
        requirements: position.requirements.map((r) => r.trim()).filter(Boolean),
        careerPath: position.careerPath,
        version: position.version || 'V1.0',
        collaborators: position.collaborators,
        responsibilities: position.responsibilities
          .filter((r) => r.name.trim())
          .map((r) => ({ id: r.id, name: r.name, description: r.description })),
        certificates: position.certificates,
        abilityBindings: [] as any[],
        abilityDomains: [] as any[],
      }
      if (isEdit && target.positionId) {
        await portalRequest(`/job/positions/${target.positionId}/save-full`, {
          method: 'PUT',
          body: JSON.stringify(saveFullPayload),
        })
        await allianceBrandApi.update(target.id, { name } as any)
        toast({ title: t('岗位品牌已更新') })
      } else {
        // 与 /job/positions 新建流程一致：先建草稿（名称+类型），再 save-full 保存步骤 1 全量数据
        const created = await portalRequest<CareerPosition>('/job/positions', {
          method: 'POST',
          body: JSON.stringify({ name, positionType: 'enterprise' }),
        })
        await portalRequest(`/job/positions/${created.id}/save-full`, {
          method: 'PUT',
          body: JSON.stringify(saveFullPayload),
        })
        await allianceBrandApi.create({
          brandType,
          name,
          positionId: created.id,
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('编辑企业岗位') : t('新增独立岗位')}</DialogTitle>
          <DialogDescription>
            {t('企业岗位仅在岗位品牌模块中可见和管理，不进入职业岗位库')}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-1 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : position ? (
            <StepBasicInfo
              position={position}
              onUpdate={(data) => setPosition((prev) => (prev ? { ...prev, ...data } : prev))}
              lockedPositionType
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('岗位不存在')}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('取消')}
          </Button>
          <Button size="sm" onClick={save} disabled={submitting || !position}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
