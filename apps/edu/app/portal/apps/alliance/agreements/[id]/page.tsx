'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAgreementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import type { AllianceAgreement, AllianceEnterprise, AllianceProject } from '@/lib/types'

export default function AllianceAgreementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [agreement, setAgreement] = useState<AllianceAgreement | null>(null)
  const [enterprises, setEnterprises] = useState<AllianceEnterprise[]>([])
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      allianceAgreementApi.get(id),
      allianceEnterpriseApi.list({ limit: 1000 }),
      allianceProjectApi.list({ limit: 1000 }),
    ])
      .then(([a, ents, projs]) => {
        setAgreement(a)
        setEnterprises(ents.items || [])
        setProjects(projs.items || [])
      })
      .catch((e) => toast({ title: '加载失败', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast])

  if (!agreement && !loading) {
    return (
      <AllianceDetailShell
        title=""
        tabs={[]}
        notFound
        backHref="/portal/apps/alliance/agreements"
      />
    )
  }

  const entIds: string[] = (agreement?.enterpriseIds || []).map(String)
  const projIds: string[] = (agreement?.projectIds || []).map(String)

  const tabs = [
    {
      key: 'info',
      label: '基本信息',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>协议信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">协议类型：</span>
                {agreement?.type || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">协议状态：</span>
                {allianceLabel('agreementStatus', agreement?.status)}
              </p>
              <p>
                <span className="text-muted-foreground">生效日期：</span>
                {agreement?.startDate || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">到期日期：</span>
                {agreement?.endDate || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">创建人：</span>
                {agreement?.createdBy || '-'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>关联对象</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">合作企业：</span>
                {entIds.length > 0
                  ? entIds.map((eid) => {
                      const ent = enterprises.find((e) => e.id === eid)
                      return ent ? (
                        <a
                          key={eid}
                          href={`/portal/apps/alliance/enterprises/${eid}`}
                          className="text-primary hover:underline mr-2"
                        >
                          {ent.name}
                        </a>
                      ) : (
                        eid
                      )
                    })
                  : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">关联项目：</span>
                {projIds.length > 0
                  ? projIds.map((pid) => {
                      const proj = projects.find((p) => p.id === pid)
                      return proj ? (
                        <a
                          key={pid}
                          href={`/portal/apps/alliance/projects/${pid}`}
                          className="text-primary hover:underline mr-2"
                        >
                          {proj.name}
                        </a>
                      ) : (
                        pid
                      )
                    })
                  : '-'}
              </p>
            </CardContent>
          </Card>
          {agreement?.content && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>协议概要</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{agreement.content}</p>
              </CardContent>
            </Card>
          )}
          {agreement && agreement.attachments && agreement.attachments.length > 0 && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>协议附件</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {agreement.attachments.map((a, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    📄 {typeof a === 'string' ? a : (a as any)?.name || '附件'}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
  ]

  return (
    <AllianceDetailShell
      title={agreement?.name || ''}
      statusBadge={
        agreement ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            {allianceLabel('agreementStatus', agreement.status)}
          </span>
        ) : undefined
      }
      backHref="/portal/apps/alliance/agreements"
      editHref={`/portal/apps/alliance/agreements/${id}/edit`}
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
