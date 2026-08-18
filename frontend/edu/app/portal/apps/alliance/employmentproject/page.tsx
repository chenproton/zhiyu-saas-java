'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceEmploymentProjectApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { usePagedList } from '@/hooks/use-paged-list'
import { formatDate } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  deriveEmploymentProjectPhase,
  type EmploymentProject,
} from '@/lib/types'

/** 类型展示：内置枚举用标签，custom:<文本> 展示自定义文本，其余未知值原样。 */
function employmentTypeLabel(type: string | undefined): string {
  if (!type) return '-'
  if (type.startsWith('custom:')) return type.slice('custom:'.length)
  return EMPLOYMENT_PROJECT_TYPE_LABELS[type] ?? type
}

export default function EmploymentProjectListPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()

  const [publishStatus, setPublishStatus] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const list = usePagedList(
    async ({ page, limit, search }) => {
      if (!tenantId) return { items: [], total: 0 }
      const data = await allianceEmploymentProjectApi.list({
        page,
        limit,
        search,
        publishStatus: publishStatus === 'all' ? undefined : publishStatus,
        type: typeFilter === 'all' ? undefined : typeFilter,
      })
      return { items: data.items || [], total: data.total }
    },
    [tenantId, authLoading, publishStatus, typeFilter],
  )

  const togglePublish = async (p: EmploymentProject) => {
    const next = p.publishStatus === 'published' ? 'draft' : 'published'
    try {
      await allianceEmploymentProjectApi.update(p.id, { publishStatus: next })
      toast({ title: next === 'published' ? t('已发布') : t('已取消发布') })
      await list.refresh()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  return (
    <PortalCrudPage
      title={t('就业项目管理')}
      description={t('管理人才与岗位供需服务大厅的就业项目。')}
      entityLabel={t('就业项目')}
      searchPlaceholder={t('搜索项目名称...')}
      createButtonLabel={t('新建项目')}
      items={list.items}
      loading={list.loading}
      error={list.error?.message ?? null}
      onRetry={list.refresh}
      searchValue={list.search}
      onSearchChange={list.setSearch}
      pagination={list.pagination}
      createHref="/portal/apps/alliance/employmentproject/new"
      colSpan={7}
      searchRight={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={publishStatus} onValueChange={(v) => { setPublishStatus(v); list.setPage(1) }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('全部发布状态')}</SelectItem>
              <SelectItem value="published">{t('已发布')}</SelectItem>
              <SelectItem value="draft">{t('草稿')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); list.setPage(1) }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('全部类型')}</SelectItem>
              {['spring', 'autumn', 'directed', 'order'].map((v) => (
                <SelectItem key={v} value={v}>
                  {EMPLOYMENT_PROJECT_TYPE_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      renderTableHeader={() => (
        <>
          <TableHead>{t('项目名称')}</TableHead>
          <TableHead>{t('类型')}</TableHead>
          <TableHead>{t('发起单位')}</TableHead>
          <TableHead>{t('起止日期')}</TableHead>
          <TableHead>{t('展示状态')}</TableHead>
          <TableHead>{t('发布状态')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(p: any, actions: any) => {
        const phase = deriveEmploymentProjectPhase(p)
        const phaseVariant =
          phase === 'ongoing' ? 'default' : phase === 'ended' ? 'outline' : 'secondary'
        return (
          <>
            <TableCell className="font-medium">
              <Link
                to={`/portal/apps/alliance/employmentproject/${p.id}`}
                className="hover:underline"
              >
                {p.name}
              </Link>
            </TableCell>
            <TableCell>{employmentTypeLabel(p.type)}</TableCell>
            <TableCell>{p.organizer || '-'}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(p.startDate)} ~ {formatDate(p.endDate)}
            </TableCell>
            <TableCell>
              <Badge variant={phaseVariant as any}>{EMPLOYMENT_PROJECT_PHASE_LABELS[phase]}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={p.publishStatus === 'published' ? 'default' : 'secondary'}>
                {p.publishStatus === 'published' ? t('已发布') : t('草稿')}
              </Badge>
            </TableCell>
            <TableRowActions>
              <Link to={`/portal/apps/alliance/employmentproject/${p.id}`}>
                <Button variant="ghost" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t('编辑')}
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => togglePublish(p)}>
                {p.publishStatus === 'published' ? t('取消发布') : t('发布')}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('删除')}
              </Button>
            </TableRowActions>
          </>
        )
      }}
      getDeleteDescription={(item: any) => (
        <>{t('确定要删除就业项目 {name} 吗？', { name: item.name })}</>
      )}
      onDelete={async (item: any) => {
        await allianceEmploymentProjectApi.delete(item.id)
        toast({ title: t('已删除') })
        await list.refresh()
      }}
    />
  )
}
