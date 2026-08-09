'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { partnerSchoolApi, type PartnerSchoolStatus } from '@/lib/api'
import { useAsync, useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDate } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerSchoolsPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()
  const [actingId, setActingId] = useState<string | null>(null)
  const [terminateTarget, setTerminateTarget] = useState<{ tenantId: string; schoolName: string } | null>(null)
  const [terminating, setTerminating] = useState(false)

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerSchoolApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  const schools = (data ?? []).map((s) => ({ ...s, id: s.tenantId }))

  const updateStatus = async (tenantId: string, status: PartnerSchoolStatus) => {
    setActingId(tenantId)
    try {
      await partnerSchoolApi.updateStatus(tenantId, status)
      toast({ title: t('合作状态已更新') })
      await refresh()
    } catch (e: any) {
      toast({
        title: t('操作失败'),
        description: e instanceof Error ? e.message : t('未知错误'),
        variant: 'destructive',
      })
    } finally {
      setActingId(null)
    }
  }

  const confirmTerminate = async () => {
    if (!terminateTarget) return
    setTerminating(true)
    try {
      await partnerSchoolApi.updateStatus(terminateTarget.tenantId, 'terminated')
      toast({ title: t('合作已终止') })
      setTerminateTarget(null)
      await refresh()
    } catch (e: any) {
      toast({
        title: t('操作失败'),
        description: e instanceof Error ? e.message : t('未知错误'),
        variant: 'destructive',
      })
    } finally {
      setTerminating(false)
    }
  }

  return (
    <PortalCrudPage
      title={t('合作学校')}
      description={t('已引入本企业的学校列表；企业可确认、暂停或终止合作，合作评级由学校侧维护。')}
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
      colSpan={6}
      renderTableHeader={() => (
        <>
          <TableHead>{t('学校名称')}</TableHead>
          <TableHead>{t('合作状态')}</TableHead>
          <TableHead>{t('合作评级')}</TableHead>
          <TableHead>{t('学校前台展示')}</TableHead>
          <TableHead>{t('引入时间')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(s) => (
        <>
          <TableCell className="font-medium">{s.schoolName}</TableCell>
          <TableCell>{allianceLabel('enterpriseStatus', s.status)}</TableCell>
          <TableCell>{allianceLabel('enterpriseRating', s.rating)}</TableCell>
          <TableCell>{s.isPublic ? t('是') : t('否')}</TableCell>
          <TableCell>{formatDate(s.createdAt)}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              {s.status === 'negotiating' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actingId === s.tenantId}
                  onClick={() => updateStatus(s.tenantId, 'active')}
                >
                  {t('确认合作')}
                </Button>
              )}
              {s.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actingId === s.tenantId}
                  onClick={() => updateStatus(s.tenantId, 'paused')}
                >
                  {t('暂停合作')}
                </Button>
              )}
              {s.status === 'paused' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actingId === s.tenantId}
                  onClick={() => updateStatus(s.tenantId, 'active')}
                >
                  {t('恢复合作')}
                </Button>
              )}
              {s.status !== 'terminated' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={actingId === s.tenantId}
                  onClick={() => setTerminateTarget({ tenantId: s.tenantId, schoolName: s.schoolName })}
                >
                  {t('终止合作')}
                </Button>
              )}
            </div>
          </TableCell>
        </>
      )}
    >
      <ConfirmDialog
        open={terminateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setTerminateTarget(null)
        }}
        title={t('终止合作')}
        description={
          terminateTarget
            ? t('确定要终止与 {name} 的合作吗？终止后不可恢复。', {
                name: terminateTarget.schoolName,
              })
            : ''
        }
        pending={terminating}
        variant="destructive"
        confirmText={t('终止合作')}
        onConfirm={confirmTerminate}
      />
    </PortalCrudPage>
  )
}
