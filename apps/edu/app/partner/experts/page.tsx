'use client'

import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { partnerExpertApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import type { PartnerExpert } from '@/lib/api'

export default function PartnerExpertsPage() {
  const { user, isAdmin, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerExpertApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  const experts = data ?? []

  return (
    <PortalCrudPage
      title={t('专家资源')}
      description={t('维护企业专家档案，档案将共享给引入本企业的合作学校（学校端只读）。')}
      entityLabel={t('专家')}
      searchPlaceholder={t('搜索姓名、头衔或行业...')}
      createButtonLabel={t('新建专家')}
      items={experts}
      loading={loading || authLoading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, search) =>
        items.filter(
          (e) =>
            !search ||
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.industry || '').toLowerCase().includes(search.toLowerCase()),
        )
      }
      createHref={isAdmin ? '/partner/experts/new' : undefined}
      hideCreate={!isAdmin}
      colSpan={8}
      renderTableHeader={() => (
        <>
          <TableHead>{t('姓名')}</TableHead>
          <TableHead>{t('头衔')}</TableHead>
          <TableHead>{t('职位')}</TableHead>
          <TableHead>{t('行业')}</TableHead>
          <TableHead>{t('所在城市')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('对外展示')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(e: PartnerExpert, actions) => (
        <>
          <TableCell className="font-medium">
            <Link href={`/partner/experts/${e.id}`} className="hover:underline">
              {e.name}
            </Link>
          </TableCell>
          <TableCell>{e.title || '-'}</TableCell>
          <TableCell>{e.position || '-'}</TableCell>
          <TableCell>{e.industry || '-'}</TableCell>
          <TableCell>{e.city || '-'}</TableCell>
          <TableCell>{allianceLabel('expertStatus', e.status)}</TableCell>
          <TableCell>{e.isPublic ? t('是') : t('否')}</TableCell>
          <TableRowActions>
            <Link href={`/partner/experts/${e.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {t('查看')}
              </Button>
            </Link>
            {isAdmin && (
              <>
                <Link href={`/partner/experts/${e.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {t('编辑')}
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t('删除')}
                </Button>
              </>
            )}
          </TableRowActions>
        </>
      )}
      getDeleteDescription={(item) => <>{t('确定要删除专家 {name} 吗？', { name: item.name })}</>}
      onDelete={
        isAdmin
          ? async (item) => {
              await partnerExpertApi.delete(item.id)
              toast({ title: t('已删除') })
              await refresh()
            }
          : undefined
      }
    />
  )
}
