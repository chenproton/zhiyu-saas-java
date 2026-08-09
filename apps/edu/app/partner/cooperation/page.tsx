'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { partnerCooperationApi } from '@/lib/api'
import { useAsync, LoadingView, ErrorState } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { formatDate } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerCooperationPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerCooperationApi.overview()
      return res.schools || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  if (authLoading || loading) return <LoadingView />
  if (error) return <ErrorState description={error.message} onRetry={refresh} />

  const schools = data ?? []
  const publicLabel = (v: boolean) => (v ? t('是') : t('否'))
  const emptyHint = (
    <p className="py-4 text-center text-sm text-muted-foreground">{t('暂无')}</p>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('合作内容')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('按学校查看与本企业的合作项目、合作成果与合作协议；内容由合作学校维护，企业只读。')}
        </p>
      </div>

      {schools.length === 0 && (
        <div className="rounded-lg border border-gray-100 bg-white py-12 text-center text-sm text-muted-foreground shadow-sm">
          {t('暂无合作内容；合作学校发布项目、成果或协议后将在此展示。')}
        </div>
      )}

      {schools.map((school) => (
        <Card key={school.tenantId}>
          <CardHeader>
            <CardTitle className="text-base">{school.schoolName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">{t('合作项目')}</h3>
              {school.projects.length === 0 ? (
                emptyHint
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>{t('名称')}</TableHead>
                      <TableHead>{t('阶段')}</TableHead>
                      <TableHead>{t('前台展示')}</TableHead>
                      <TableHead>{t('更新时间')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {school.projects.map((p) => (
                      <TableRow key={p.id} className="border-border">
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{allianceLabel('projectPhase', p.phase)}</TableCell>
                        <TableCell>{publicLabel(p.isPublic)}</TableCell>
                        <TableCell>{formatDate(p.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">{t('合作成果')}</h3>
              {school.achievements.length === 0 ? (
                emptyHint
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>{t('标题')}</TableHead>
                      <TableHead>{t('类型')}</TableHead>
                      <TableHead>{t('前台展示')}</TableHead>
                      <TableHead>{t('更新时间')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {school.achievements.map((a) => (
                      <TableRow key={a.id} className="border-border">
                        <TableCell className="font-medium">{a.title}</TableCell>
                        <TableCell>{allianceLabel('achievementType', a.type)}</TableCell>
                        <TableCell>{publicLabel(a.isPublic)}</TableCell>
                        <TableCell>{formatDate(a.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">{t('合作协议')}</h3>
              {school.agreements.length === 0 ? (
                emptyHint
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>{t('名称')}</TableHead>
                      <TableHead>{t('类型')}</TableHead>
                      <TableHead>{t('状态')}</TableHead>
                      <TableHead>{t('前台展示')}</TableHead>
                      <TableHead>{t('更新时间')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {school.agreements.map((a) => (
                      <TableRow key={a.id} className="border-border">
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.type || '-'}</TableCell>
                        <TableCell>{allianceLabel('agreementStatus', a.status)}</TableCell>
                        <TableCell>{publicLabel(a.isPublic)}</TableCell>
                        <TableCell>{formatDate(a.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
