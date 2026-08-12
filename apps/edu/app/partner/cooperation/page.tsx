'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { partnerCooperationApi } from '@/lib/api'
import type {
  PartnerCooperationAchievementDetail,
  PartnerCooperationAgreementDetail,
  PartnerCooperationProjectDetail,
  PartnerCooperationSchool,
} from '@/lib/api'
import { useAsync, LoadingView, ErrorState } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { formatDate } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'

type RowKind = 'project' | 'achievement' | 'agreement'

type DetailUnion =
  | PartnerCooperationProjectDetail
  | PartnerCooperationAchievementDetail
  | PartnerCooperationAgreementDetail

interface CooperationRow {
  kind: RowKind
  id: string
  name: string
  label: string
  updatedAt: string
}

const KIND_BADGE: Record<RowKind, { labelKey: string; className: string }> = {
  project: {
    labelKey: '合作项目',
    className: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  achievement: {
    labelKey: '合作成果',
    className: 'bg-violet-50 text-violet-600 border-violet-200',
  },
  agreement: {
    labelKey: '合作协议',
    className: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
}

function InfoItem({
  label,
  value,
  full,
}: {
  label: string
  value?: string | number | null
  full?: boolean
}) {
  if (value == null || value === '') return null
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
        {String(value)}
      </p>
    </div>
  )
}

function DetailBody({
  kind,
  data,
}: {
  kind: RowKind
  data: DetailUnion
}) {
  const t = useT()
  if (kind === 'project') {
    const d = data as PartnerCooperationProjectDetail
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label={t('合作类型')} value={d.type} />
        <InfoItem label={t('当前阶段')} value={allianceLabel('projectPhase', d.phase)} />
        <InfoItem label={t('发布状态')} value={allianceLabel('publishStatus', d.publishStatus)} />
        <InfoItem label={t('预算')} value={d.budget} />
        <InfoItem label={t('开始日期')} value={formatDate(d.startDate)} />
        <InfoItem label={t('结束日期')} value={formatDate(d.endDate)} />
        <InfoItem
          label={t('关联二级学院')}
          value={(d.secondaryColleges ?? []).join('、') || undefined}
        />
        <InfoItem label={t('项目简介')} value={d.description} full />
        {d.milestones && d.milestones.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs text-muted-foreground">{t('项目里程碑')}</p>
            <div className="space-y-2">
              {d.milestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    {m.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                    )}
                    {(m.dueDate || m.completedDate) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.dueDate ? `${t('计划')}：${formatDate(m.dueDate)}` : ''}
                        {m.dueDate && m.completedDate ? ' ｜ ' : ''}
                        {m.completedDate ? `${t('完成')}：${formatDate(m.completedDate)}` : ''}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={m.isCompleted ? 'secondary' : 'outline'}
                    className={
                      m.isCompleted
                        ? 'shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'shrink-0 text-muted-foreground'
                    }
                  >
                    {m.isCompleted ? t('已完成') : t('未完成')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
  if (kind === 'achievement') {
    const d = data as PartnerCooperationAchievementDetail
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label={t('成果类型')} value={allianceLabel('achievementType', d.type)} />
        <InfoItem label={t('成果状态')} value={allianceLabel('achievementStatus', d.status)} />
        <InfoItem label={t('发布日期')} value={formatDate(d.achievementDate)} />
        <InfoItem label={t('浏览次数')} value={d.viewCount} />
        <InfoItem
          label={t('关联二级学院')}
          value={(d.secondaryColleges ?? []).join('、') || undefined}
        />
        <InfoItem label={t('成果简介')} value={d.description} full />
        <InfoItem label={t('引用原因 / 核心亮点')} value={d.citationReason} full />
        <InfoItem label={t('成果归属人')} value={(d.ownerPersons ?? []).join('、') || undefined} />
        <InfoItem label={t('成果共建人')} value={(d.coBuilders ?? []).join('、') || undefined} />
      </div>
    )
  }
  const d = data as PartnerCooperationAgreementDetail
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <InfoItem label={t('协议类型')} value={d.type} />
      <InfoItem label={t('协议状态')} value={allianceLabel('agreementStatus', d.status)} />
      <InfoItem label={t('开始日期')} value={formatDate(d.startDate)} />
      <InfoItem label={t('结束日期')} value={formatDate(d.endDate)} />
      <InfoItem label={t('协议正文')} value={d.content} full />
    </div>
  )
}

export default function PartnerCooperationPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()
  const [detail, setDetail] = useState<{ kind: RowKind; id: string; name: string } | null>(null)
  const [detailData, setDetailData] = useState<DetailUnion | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerCooperationApi.overview()
      return res.schools || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )

  const openDetail = async (kind: RowKind, id: string, name: string) => {
    setDetail({ kind, id, name })
    setDetailData(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const data =
        kind === 'project'
          ? await partnerCooperationApi.project(id)
          : kind === 'achievement'
            ? await partnerCooperationApi.achievement(id)
            : await partnerCooperationApi.agreement(id)
      setDetailData(data)
    } catch (err) {
      reportError(err, { source: '加载合作内容详情' })
      setDetailError(err instanceof Error ? err.message : t('加载失败'))
    } finally {
      setDetailLoading(false)
    }
  }

  if (authLoading || loading) return <LoadingView />
  if (error) return <ErrorState description={error.message} onRetry={refresh} />

  const schools = data ?? []
  const rows = (school: PartnerCooperationSchool): CooperationRow[] => {
    const items: CooperationRow[] = []
    for (const p of school.projects ?? []) {
      items.push({
        kind: 'project',
        id: p.id,
        name: p.name,
        label: allianceLabel('projectPhase', p.phase),
        updatedAt: p.updatedAt,
      })
    }
    for (const a of school.achievements ?? []) {
      items.push({
        kind: 'achievement',
        id: a.id,
        name: a.title,
        label: allianceLabel('achievementType', a.type),
        updatedAt: a.updatedAt,
      })
    }
    for (const g of school.agreements ?? []) {
      items.push({
        kind: 'agreement',
        id: g.id,
        name: g.name,
        label: allianceLabel('agreementStatus', g.status),
        updatedAt: g.updatedAt,
      })
    }
    return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }
  const emptyHint = (
    <p className="py-4 text-center text-sm text-muted-foreground">{t('暂无')}</p>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('合作内容')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('按学校查看与本企业的合作项目、合作成果与合作协议；内容由合作学校维护，企业只读，点击名称可查看详情。')}
        </p>
      </div>

      {schools.length === 0 && (
        <div className="rounded-lg border border-gray-100 bg-white py-12 text-center text-sm text-muted-foreground shadow-sm">
          {t('暂无合作内容；合作学校发布项目、成果或协议后将在此展示。')}
        </div>
      )}

      {schools.map((school) => {
        const schoolRows = rows(school)
        return (
          <Card key={school.tenantId}>
            <CardHeader>
              <CardTitle className="text-base">{school.schoolName}</CardTitle>
            </CardHeader>
            <CardContent>
              {schoolRows.length === 0 ? (
                emptyHint
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="w-28">{t('类型')}</TableHead>
                      <TableHead>{t('名称')}</TableHead>
                      <TableHead className="w-40">{t('阶段 / 状态')}</TableHead>
                      <TableHead className="w-32">{t('更新时间')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schoolRows.map((row) => (
                      <TableRow key={`${row.kind}-${row.id}`} className="border-border">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`border ${KIND_BADGE[row.kind].className}`}
                          >
                            {t(KIND_BADGE[row.kind].labelKey)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => openDetail(row.kind, row.id, row.name)}
                            className="text-left font-medium text-indigo-600 transition-colors hover:text-indigo-800 hover:underline"
                          >
                            {row.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.label}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(row.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{detail?.name ?? ''}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            {detailLoading ? (
              <div className="flex justify-center py-10">
                <LoadingView />
              </div>
            ) : detailError ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">{detailError}</p>
                {detail && (
                  <button
                    type="button"
                    onClick={() => openDetail(detail.kind, detail.id, detail.name)}
                    className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
                  >
                    {t('重试')}
                  </button>
                )}
              </div>
            ) : detail && detailData ? (
              <DetailBody kind={detail.kind} data={detailData} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
