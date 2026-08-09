'use client'

import { TableCell, TableHead } from '@/components/ui/table'
import { partnerMentorTaskApi } from '@/lib/api'
import { useAsync } from '@zhiyu/ui'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { formatDate } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerTasksPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerMentorTaskApi.list()
      return res.items || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  const tasks = (data ?? []).map((task) => ({ ...task, id: task.taskId }))

  return (
    <PortalCrudPage
      title={t('测评任务')}
      description={t(
        '打分在学校端进行；此处展示本企业专家被学校分配的测评任务，便于专家跟进。',
      )}
      entityLabel={t('测评任务')}
      searchPlaceholder={t('搜索任务名称、专家或学校...')}
      items={tasks}
      loading={loading || authLoading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, search) =>
        items.filter(
          (task) =>
            !search ||
            task.taskName.toLowerCase().includes(search.toLowerCase()) ||
            task.expertName.toLowerCase().includes(search.toLowerCase()) ||
            task.schoolName.toLowerCase().includes(search.toLowerCase()),
        )
      }
      hideCreate
      colSpan={5}
      renderTableHeader={() => (
        <>
          <TableHead>{t('任务名称')}</TableHead>
          <TableHead>{t('评审步骤')}</TableHead>
          <TableHead>{t('负责专家')}</TableHead>
          <TableHead>{t('所属学校')}</TableHead>
          <TableHead>{t('更新时间')}</TableHead>
        </>
      )}
      renderTableRow={(task) => (
        <>
          <TableCell className="font-medium">{task.taskName}</TableCell>
          <TableCell>{task.stepLabel || '-'}</TableCell>
          <TableCell>{task.expertName}</TableCell>
          <TableCell>{task.schoolName}</TableCell>
          <TableCell>{formatDate(task.updatedAt)}</TableCell>
        </>
      )}
    />
  )
}
