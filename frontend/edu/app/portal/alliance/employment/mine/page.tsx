'use client'

import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Briefcase, FileText, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { allianceEmploymentPublicApi } from '@/lib/api'
import type { EmploymentApplication } from '@/lib/types'
import { formatDateTime } from '@/lib/format-utils'
import { LoadingView, EmptyState, useAsync, ErrorState } from '@zhiyu/ui'
import { Footer } from '@/components/portal/footer'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'

export default function AllianceEmploymentMinePage() {
  const t = useT()
  const { tenantId } = usePortalAuth()
  const [selected, setSelected] = useState<EmploymentApplication | null>(null)

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return undefined
      const res = await allianceEmploymentPublicApi.myApplications()
      return res.items ?? []
    },
    { deps: [tenantId], onError: () => true },
  )
  const items = data ?? []

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8ff]">
      {/* 页头 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/75 to-primary/40">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '52px 52px',
          }}
        />
        <div className="absolute top-[-80px] right-[-5%] w-[360px] h-[360px] rounded-full bg-white/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[10%] w-[300px] h-[300px] rounded-full bg-black/10 blur-[100px] pointer-events-none" />
        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <Link
            to="/portal/alliance/employment"
            className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('返回人才与岗位供需服务大厅')}
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{t('我的投递')}</h1>
              <p className="text-sm text-white/80 mt-1">{t('查看你已投递的岗位与求职信')}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 w-full flex-1">
        {loading || data === undefined ? (
          <LoadingView />
        ) : error ? (
          <ErrorState description={error.message} onRetry={refresh} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-10 w-10 opacity-50" />}
            title={t('暂无投递记录')}
            titleClassName="text-slate-500"
            className="py-16 bg-white rounded-2xl border border-[#e7e5e4] shadow-sm"
          />
        ) : (
          <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs text-slate-400">
                    <th className="px-5 py-3.5 font-medium">{t('岗位')}</th>
                    <th className="px-5 py-3.5 font-medium">{t('企业')}</th>
                    <th className="px-5 py-3.5 font-medium">{t('项目')}</th>
                    <th className="px-5 py-3.5 font-medium">{t('投递时间')}</th>
                    <th className="px-5 py-3.5 font-medium">{t('状态')}</th>
                    <th className="px-5 py-3.5 font-medium text-right">{t('操作')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((app) => (
                    <tr key={app.id} className="hover:bg-primary/[0.02] transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {app.jobTitle || '-'}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{app.enterpriseName || '-'}</td>
                      <td className="px-5 py-4 text-slate-600">{app.projectName || '-'}</td>
                      <td className="px-5 py-4 text-slate-500">{formatDateTime(app.createdAt)}</td>
                      <td className="px-5 py-4">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {t('已投递')}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary h-8 px-2.5"
                            onClick={() => setSelected(app)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            {t('求职信')}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2.5" asChild>
                            <Link to={`/portal/alliance/employment/job/${app.jobId}`}>
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              {t('查看岗位')}
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer className="mt-auto" />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('我的求职信')}</DialogTitle>
            <DialogDescription>
              {selected?.jobTitle || '-'}
              {selected?.enterpriseName ? ` · ${selected.enterpriseName}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-slate-50 p-4 max-h-[50vh] overflow-y-auto">
            {selected?.coverLetter ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selected.coverLetter}
              </p>
            ) : (
              <p className="text-sm text-slate-400">{t('未填写求职信')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
