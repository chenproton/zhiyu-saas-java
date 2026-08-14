'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Pencil, Trash2, ExternalLink, Link2, Building2 } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceBrandApi, allianceEnterpriseApi } from '@/lib/api'
import { listAll } from '@zhiyu/api-client'
import { useToast, useAsync, FormDialogFooter } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import {
  EnterpriseProfileForm,
} from '@/components/alliance/enterprise-profile-form'
import {
  normalizeEnterpriseInfo,
  type EnterpriseInfo,
} from '@/components/alliance/independent-enterprise-form'
import { SearchInput } from '@/components/shared/search-input'
import { useT } from '@/lib/i18n/locale-provider'
import type { EmployerBrand, AllianceEnterprise } from '@/lib/types'

const brandType = 'employer'

function enterpriseInfoOf(item?: EmployerBrand | null): EnterpriseInfo {
  return normalizeEnterpriseInfo(item?.data?.enterpriseInfo)
}

function positionsOf(item?: EmployerBrand | null): any[] {
  return item?.data?.positions ?? []
}

function hiredStudentsOf(item?: EmployerBrand | null): any[] {
  return item?.data?.hiredStudents ?? []
}

export default function AllianceEmployerBrandPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const brandLabel = t('雇主品牌')
  const brandDesc = t('从合作企业库引用或新增独立雇主企业，维护雇主品牌展示')

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      // 全量拉取，避免 limit 截断导致品牌列表静默缺失（与 culture 页服务端分页语义一致）
      const data = await listAll((page, pageSize) =>
        allianceBrandApi.list({ brandType, limit: pageSize, offset: page * pageSize }),
      )
      return data
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const items = useMemo(() => (data ?? []) as EmployerBrand[], [data])

  // ── 从合作企业库引用 ─────────────────────────────────────────
  const [refDialogOpen, setRefDialogOpen] = useState(false)
  const [refSearch, setRefSearch] = useState('')
  const [refSelected, setRefSelected] = useState<AllianceEnterprise | null>(null)
  const [refSubmitting, setRefSubmitting] = useState(false)

  const { data: enterprises } = useAsync(
    async () => {
      if (!refDialogOpen) return []
      // 引用弹窗全量拉取企业，避免超限企业无法被引用
      const res = await listAll((page, pageSize) =>
        allianceEnterpriseApi.list({ limit: pageSize, offset: page * pageSize }),
      )
      return res
    },
    { deps: [tenantId, refDialogOpen], onError: () => true },
  )

  const referencedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const b of items) if (b.enterpriseId) ids.add(b.enterpriseId)
    return ids
  }, [items])

  const referable = useMemo(() => {
    const list = (enterprises ?? []).filter((e) => !referencedIds.has(e.id))
    const kw = refSearch.trim().toLowerCase()
    if (!kw) return list
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(kw) ||
        (e.industry || '').toLowerCase().includes(kw),
    )
  }, [enterprises, referencedIds, refSearch])

  const confirmRefer = async () => {
    if (!refSelected) return
    setRefSubmitting(true)
    try {
      await allianceBrandApi.create({
        brandType,
        name: refSelected.name,
        enterpriseId: refSelected.id,
        status: 'draft',
        data: {},
      })
      toast({ title: t('已引用合作企业') })
      setRefDialogOpen(false)
      setRefSelected(null)
      setRefSearch('')
      await refresh()
    } catch (e: any) {
      toast({ title: t('引用失败'), description: e.message || t('未知错误'), variant: 'destructive' })
    } finally {
      setRefSubmitting(false)
    }
  }

  // ── 新增/编辑独立雇主企业 ────────────────────────────────────
  const [editTarget, setEditTarget] = useState<EmployerBrand | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editInfo, setEditInfo] = useState<EnterpriseInfo>({})
  const [editSubmitting, setEditSubmitting] = useState(false)

  const openCreate = () => {
    setEditTarget(null)
    setEditInfo({})
    setEditOpen(true)
  }

  const openEdit = (item: EmployerBrand) => {
    setEditTarget(item)
    setEditInfo(enterpriseInfoOf(item))
    setEditOpen(true)
  }

  const confirmSaveIndependent = async () => {
    if (!editInfo.name?.trim()) {
      toast({ title: t('企业名称不能为空'), variant: 'destructive' })
      return
    }
    setEditSubmitting(true)
    try {
      const payload = { data: { enterpriseInfo: editInfo } }
      if (editTarget) {
        await allianceBrandApi.update(editTarget.id, {
          ...payload,
          name: editInfo.name,
          data: { ...(editTarget.data || {}), enterpriseInfo: editInfo },
        })
      } else {
        await allianceBrandApi.create({
          brandType,
          name: editInfo.name,
          status: 'draft',
          data: payload.data,
        })
      }
      toast({ title: editTarget ? t('企业资料已更新') : t('独立雇主企业已创建') })
      setEditOpen(false)
      await refresh()
    } catch (e: any) {
      toast({
        title: editTarget ? t('保存失败') : t('创建失败'),
        description: e.message || t('未知错误'),
        variant: 'destructive',
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  const toggleBrandField = async (item: EmployerBrand, field: 'isPublic' | 'isFeatured', value: boolean) => {
    try {
      await allianceBrandApi.update(item.id, { [field]: value } as any)
      toast({ title: t('已更新') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('更新失败'), description: e.message, variant: 'destructive' })
    }
  }

  return (
    <>
      <PortalCrudPage
        title={t('{brandLabel}管理', { brandLabel })}
        description={brandDesc}
        entityLabel={brandLabel}
        searchPlaceholder={t('搜索企业名称...')}
        items={items}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refresh}
        filterItems={(filtered, search) =>
          filtered.filter((b: EmployerBrand) => {
            const name = b.name || b.enterpriseName || ''
            return !search || name.toLowerCase().includes(search.toLowerCase())
          })
        }
        headerActions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Building2 className="h-4 w-4 mr-1" />
              {t('新增独立雇主企业')}
            </Button>
            <Button size="sm" onClick={() => setRefDialogOpen(true)}>
              <Link2 className="h-4 w-4 mr-1" />
              {t('从合作企业库引用')}
            </Button>
          </div>
        }
        importConfig={{
          importType: 'alliance-brands',
          entityLabel: brandLabel,
          templateFileName: t('雇主品牌批量导入模板.xlsx'),
          extraQuery: { brandType: 'employer' },
        }}
        hideCreate
        colSpan={8}
        renderTableHeader={() => (
          <>
            <TableHead>{t('企业名称')}</TableHead>
            <TableHead>{t('前台展示')}</TableHead>
            <TableHead>{t('推荐')}</TableHead>
            <TableHead>{t('来源')}</TableHead>
            <TableHead>{t('行业')}</TableHead>
            <TableHead>{t('关联岗位')}</TableHead>
            <TableHead>{t('已招聘学生')}</TableHead>
            <TableHead>{t('操作')}</TableHead>
          </>
        )}
        renderTableRow={(item: EmployerBrand, actions: any) => {
          const isIndependent = !item.enterpriseId
          const info = enterpriseInfoOf(item)
          return (
            <>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                <Switch
                  checked={item.isPublic}
                  onCheckedChange={(v) => toggleBrandField(item, 'isPublic', v)}
                />
              </TableCell>
              <TableCell>
                <Switch
                  checked={item.isFeatured}
                  onCheckedChange={(v) => toggleBrandField(item, 'isFeatured', v)}
                />
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                    isIndependent ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {isIndependent ? t('独立雇主') : t('合作企业')}
                </span>
              </TableCell>
              <TableCell>{item.enterpriseIndustry || info.industry || '-'}</TableCell>
              <TableCell>{positionsOf(item).length}</TableCell>
              <TableCell>{hiredStudentsOf(item).length}</TableCell>
              <TableRowActions>
                <Link href={`/portal/apps/alliance/brands/${item.id}`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    {t('查看')}
                  </Button>
                </Link>
                {isIndependent && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {t('编辑')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t('删除')}
                </Button>
              </TableRowActions>
            </>
          )
        }}
        getDeleteDescription={(item: any) => (
          <>{t('确定要删除雇主品牌「{name}」吗？', { name: item.name })}</>
        )}
        onDelete={async (item: any) => {
          await allianceBrandApi.delete(item.id)
          toast({ title: t('品牌已删除') })
          await refresh()
        }}
      />

      {/* 从合作企业库引用 */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('从合作企业库引用')}</DialogTitle>
            <DialogDescription>{t('选择合作企业库中的企业，引用为雇主品牌')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              confirmRefer()
            }}
            className="grid gap-4"
          >
            <SearchInput
              placeholder={t('搜索企业名称或行业...')}
              value={refSearch}
              onChange={setRefSearch}
            />
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {referable.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('没有可引用的合作企业')}
              </p>
            ) : (
              referable.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setRefSelected(e)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    refSelected?.id === e.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-100 hover:border-primary/30'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.industry || '-'} · {e.region || '-'}
                    </p>
                  </div>
                  {refSelected?.id === e.id && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))
            )}
          </div>
          <FormDialogFooter
            onCancel={() => setRefDialogOpen(false)}
            confirmText={t('确认引用')}
            loading={refSubmitting}
            confirmDisabled={!refSelected}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* 新增独立雇主企业 / 编辑独立企业资料（样式对齐 /partner/enterprise 编辑弹窗） */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? t('编辑独立雇主企业') : t('新增独立雇主企业')}
            </DialogTitle>
            <DialogDescription>
              {t('由学校登记的企业资料，仅在本模块展示，不会加入合作企业库')}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              confirmSaveIndependent()
            }}
            className="grid gap-4"
          >
            <div className="overflow-y-auto flex-1 min-h-0 py-2 px-1">
              <EnterpriseProfileForm value={editInfo} onChange={setEditInfo} />
            </div>
            <FormDialogFooter
              onCancel={() => setEditOpen(false)}
              loading={editSubmitting}
            />
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
