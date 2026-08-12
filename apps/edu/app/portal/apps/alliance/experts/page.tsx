'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceExpertApi, allianceEnterpriseApi } from '@/lib/api'
import { useAsync, useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceExpert } from '@/lib/types'

export default function AllianceExpertsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const t = useT()
  const { toast } = useToast()
  const [enterpriseFilter, setEnterpriseFilter] = useState<string>('all')

  // 专家档案由企业侧维护，学校端只读；企业筛选数据源 = 本校已引入企业
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return { experts: [] as AllianceExpert[], enterprises: [] as { id: string; name: string }[] }
      const [exp, ent] = await Promise.all([
        allianceExpertApi.list({ limit: 500 }),
        allianceEnterpriseApi.list({ limit: 200 }),
      ])
      return {
        experts: exp.items || [],
        enterprises: (ent.items || []).map((e) => ({ id: e.id, name: e.name })),
      }
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const { experts = [], enterprises = [] } = data ?? {}
  const enterpriseName = (id?: string) => enterprises.find((e) => e.id === id)?.name

  const filtered =
    enterpriseFilter === 'all'
      ? experts
      : experts.filter((e) => e.enterpriseId === enterpriseFilter)

  return (
    <PortalCrudPage
      title={t('专家资源库')}
      description={t('已引入企业维护的专家档案，学校端只读。')}
      entityLabel={t('专家')}
      searchPlaceholder={t('搜索姓名、头衔或行业...')}
      items={filtered}
      loading={loading}
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
      hideCreate
      searchRight={
        <Select value={enterpriseFilter} onValueChange={setEnterpriseFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={t('按所属企业筛选')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('全部企业')}</SelectItem>
            {enterprises.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      colSpan={8}
      renderTableHeader={() => (
        <>
          <TableHead>{t('姓名')}</TableHead>
          <TableHead>{t('头衔')}</TableHead>
          <TableHead>{t('职位')}</TableHead>
          <TableHead>{t('所属企业')}</TableHead>
          <TableHead>{t('行业')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('前台展示')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(e: AllianceExpert, actions: any) => (
        <>
          <TableCell className="font-medium">
            <Link href={`/portal/apps/alliance/experts/${e.id}`} className="hover:underline">
              {e.name}
            </Link>
          </TableCell>
          <TableCell>{e.title || '-'}</TableCell>
          <TableCell>{e.position || '-'}</TableCell>
          <TableCell
            className="max-w-[160px] truncate"
            title={enterpriseName(e.enterpriseId) || e.organization || '-'}
          >
            {enterpriseName(e.enterpriseId) || e.organization || '-'}
          </TableCell>
          <TableCell>{e.industry || '-'}</TableCell>
          <TableCell>{allianceLabel('expertStatus', e.status)}</TableCell>
          <TableCell>
            <Switch
              checked={e.isPublic || false}
              onCheckedChange={actions.toggle}
              aria-label={t('前台展示')}
            />
          </TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/experts/${e.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {t('查看')}
              </Button>
            </Link>
          </TableRowActions>
        </>
      )}
      onToggleEnabled={async (item: AllianceExpert) => {
        // 仅控制联盟首页（landing）展示；企业详情页"专家团队"不受该开关影响
        await allianceExpertApi.updateDisplay(item.id, !item.isPublic)
        toast({ title: item.isPublic ? t('已取消前台展示') : t('已开启前台展示') })
      }}
    />
  )
}
