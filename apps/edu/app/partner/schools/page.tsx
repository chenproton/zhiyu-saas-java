'use client'

import { TableCell, TableHead } from '@/components/ui/table'
import { partnerSchoolApi } from '@/lib/api'
import { useAsync } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { formatDate } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerSchoolsPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerSchoolApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  const schools = (data ?? []).map((s) => ({ ...s, id: s.tenantId }))

  return (
    <PortalCrudPage
      title={t('合作学校')}
      description={t('已引入本企业的学校列表；合作状态、评级等由学校侧维护，企业只读。')}
      entityLabel={t('合作学校')}
      searchPlaceholder={t('搜索学校名称...')}
      items={schools}
      loading={loading || authLoading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, search) =>
        items.filter(
          (s) => !search || s.schoolName.toLowerCase().includes(search.toLowerCase()),
        )
      }
      hideCreate
      colSpan={5}
      renderTableHeader={() => (
        <>
          <TableHead>{t('学校名称')}</TableHead>
          <TableHead>{t('合作状态')}</TableHead>
          <TableHead>{t('合作评级')}</TableHead>
          <TableHead>{t('学校前台展示')}</TableHead>
          <TableHead>{t('引入时间')}</TableHead>
        </>
      )}
      renderTableRow={(s) => (
        <>
          <TableCell className="font-medium">{s.schoolName}</TableCell>
          <TableCell>{allianceLabel('enterpriseStatus', s.status)}</TableCell>
          <TableCell>{allianceLabel('enterpriseRating', s.rating)}</TableCell>
          <TableCell>{s.isPublic ? t('是') : t('否')}</TableCell>
          <TableCell>{formatDate(s.createdAt)}</TableCell>
        </>
      )}
    />
  )
}
