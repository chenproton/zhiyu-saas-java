'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TableCell, TableHead } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Trash2 } from 'lucide-react'
import { partnerCobuildScenarioApi, partnerSchoolApi } from '@/lib/api'
import type { CoBuildScenario } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { usePagedList } from '@/hooks/use-paged-list'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { StatusBadge } from '@/components/shared/status-badge'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { formatDateTime } from '@/lib/format-utils'

export default function PartnerCoBuildScenesPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const [schoolFilter, setSchoolFilter] = useState('')

  // 已确认合作（active）的学校：用于顶部筛选与"新建"弹窗选学校
  const { data: schoolsData } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerSchoolApi.list({ limit: 200 })
      return (res.items || []).filter((s) => s.status === 'active')
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )
  const activeSchools = schoolsData ?? []

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerCobuildScenarioApi.list({
        schoolTenantId: schoolFilter || undefined,
        limit: 200,
      })
      return res.items || []
    },
    { deps: [authLoading, user?.id, schoolFilter], onError: () => true },
  )

  const scenes = data ?? []

  // 编辑一律直接进入编辑页：保存后状态回写草稿，发布由学校端进行（含学校授权资源）
  const schoolSelector = (value: string, onChange: (v: string) => void, includeAll: boolean) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder={t('选择合作学校')} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{t('全部学校')}</SelectItem>}
        {activeSchools.map((s) => (
          <SelectItem key={s.tenantId} value={s.tenantId}>
            {s.schoolName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <PortalCrudPage
      title={t('场景共建')}
      description={t('为合作学校创建或编辑场景资源，保存后状态为草稿，由学校端审核发布。')}
      entityLabel={t('场景')}
      searchPlaceholder={t('搜索场景名称...')}
      createButtonLabel={t('新建场景')}
      items={scenes}
      loading={loading || authLoading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, search) =>
        items.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
      }
      searchRight={schoolSelector(
        schoolFilter || 'all',
        (v) => setSchoolFilter(v === 'all' ? '' : v),
        true,
      )}
      colSpan={5}
      emptyContent={
        activeSchools.length === 0 ? (
          <div className="py-4">
            <p>{t('暂无已确认合作的学校，无法共建场景。')}</p>
            <Link href="/partner/schools" className="text-primary hover:underline">
              {t('前往合作学校页确认合作')}
            </Link>
          </div>
        ) : undefined
      }
      createDefault={() => ({ id: '', schoolTenantId: '' }) as CoBuildScenario}
      renderForm={(item, setItem) => (
        <div className="grid gap-2">
          <Label>{t('合作学校')}</Label>
          {activeSchools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('暂无已确认合作的学校，请先在合作学校页确认合作。')}
            </p>
          ) : (
            schoolSelector(
              item.schoolTenantId,
              (v) => setItem({ ...item, schoolTenantId: v }),
              false,
            )
          )}
          <p className="text-xs text-muted-foreground">
            {t('创建后将生成草稿「未命名场景」，并跳转到编辑页完善内容。')}
          </p>
        </div>
      )}
      onSave={async (item) => {
        if (!item.schoolTenantId) throw new Error(t('请选择合作学校'))
        const created = await partnerCobuildScenarioApi.create({
          schoolTenantId: item.schoolTenantId,
          name: t('未命名场景'),
        })
        router.push(`/partner/co-build/scenes/${created.id}/edit?new=true`)
      }}
      renderTableHeader={() => (
        <>
          <TableHead>{t('名称')}</TableHead>
          <TableHead>{t('合作学校')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('更新时间')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(s: CoBuildScenario, actions) => (
        <>
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              <span>{s.name}</span>
              {s.sourceType !== 'enterprise' && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {t('学校授权')}
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>{s.schoolName || '-'}</TableCell>
          <TableCell>
            <StatusBadge status={s.status} />
          </TableCell>
          <TableCell>{formatDateTime(s.updatedAt)}</TableCell>
          <TableRowActions>
            <Link href={`/partner/co-build/scenes/${s.id}/edit`}>
              <Button variant="ghost" size="sm">
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {t('编辑')}
              </Button>
            </Link>
            {s.sourceType === 'enterprise' && (s.status === 'draft' || s.status === 'rejected') && (
              <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('删除')}
              </Button>
            )}
          </TableRowActions>
        </>
      )}
      getDeleteDescription={(item) => <>{t('确定要删除场景 {name} 吗？', { name: item.name })}</>}
      onDelete={async (item) => {
        await partnerCobuildScenarioApi.delete(item.id)
        toast({ title: t('已删除') })
        await refresh()
      }}
    />
  )
}
