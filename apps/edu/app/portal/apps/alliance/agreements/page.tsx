'use client'

import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/shared/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAgreementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { formatDate } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceAgreement } from '@/lib/types'

export default function AllianceAgreementsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return { items: [], enterprises: [], projects: [] }
      const [data, ents, projs] = await Promise.all([
        allianceAgreementApi.list(),
        allianceEnterpriseApi.list({ limit: 200 }),
        allianceProjectApi.list({ limit: 200 }),
      ])
      return {
        items: data.items || [],
        enterprises: ents.items || [],
        projects: projs.items || [],
      }
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const { items, enterprises, projects } = data ?? {}

  return (
    <PortalCrudPage
      title={t('合作协议管理')}
      description={t('管理校企合作协议的独立记录')}
      entityLabel={t('合作协议')}
      searchPlaceholder={t('搜索协议名称...')}
      createButtonLabel={t('新建协议')}
      items={items ?? []}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(filtered, search) =>
        filtered.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))
      }
      importConfig={{
        importType: 'alliance-agreements',
        entityLabel: t('合作协议'),
        templateFileName: t('合作协议批量导入模板.xlsx'),
      }}
      createHref="/portal/apps/alliance/agreements/new"
      colSpan={9}
      renderTableHeader={() => (
        <>
          <TableHead>{t('协议名称')}</TableHead>
          <TableHead>{t('合作企业')}</TableHead>
          <TableHead>{t('关联项目')}</TableHead>
          <TableHead>{t('类型')}</TableHead>
          <TableHead>{t('生效日期')}</TableHead>
          <TableHead>{t('到期日期')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('前台展示')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => {
        const entIds: string[] = (item.enterpriseIds || []).map(String)
        const expiring =
          item.endDate &&
          (() => {
            const days = (new Date(item.endDate).getTime() - Date.now()) / 86400000
            return days >= 0 && days <= 90
          })()
        return (
          <>
            <TableCell className="font-medium">
              <Link
                href={`/portal/apps/alliance/agreements/${item.id}`}
                className="hover:underline"
              >
                {item.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-[160px]">
              {entIds.length > 0
                ? entIds
                    .map((eid) => (enterprises ?? []).find((e) => e.id === eid)?.name || eid)
                    .join('、')
                : '-'}
            </TableCell>
            <TableCell>
              {(item.projectIds || []).length > 0
                ? (projects ?? []).find((p) => p.id === (item.projectIds || [])[0])?.name || '-'
                : '-'}
            </TableCell>
            <TableCell>{item.type || '-'}</TableCell>
            <TableCell>{formatDate(item.startDate)}</TableCell>
            <TableCell className={expiring ? 'text-amber-600 font-medium' : ''}>
              {formatDate(item.endDate)}
              {expiring && <span className="ml-1 text-xs">{t('（即将到期）')}</span>}
            </TableCell>
            <TableCell>{allianceLabel('agreementStatus', item.status)}</TableCell>
            <TableCell>
              <Switch checked={item.isPublic || false} onCheckedChange={actions.toggle} />
            </TableCell>
            <TableRowActions>
              <Link href={`/portal/apps/alliance/agreements/${item.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  {t('查看')}
                </Button>
              </Link>
              <Link href={`/portal/apps/alliance/agreements/${item.id}/edit`}>
                <Button variant="ghost" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t('编辑')}
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('删除')}
              </Button>
            </TableRowActions>
          </>
        )
      }}
      createDefault={() =>
        ({
          id: '',
          name: '',
          type: '',
          status: 'draft',
          startDate: '',
          endDate: '',
          content: '',
          isPublic: false,
          enabled: true as any,
          createdAt: '',
          updatedAt: '',
        }) as AllianceAgreement & { enabled?: boolean }
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <FormFieldRow label={t('协议名称')} required>
            <Input
              value={item.name || ''}
              onChange={(e: any) => setItem({ ...item, name: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label={t('协议类型')}>
            <Input
              value={item.type || ''}
              onChange={(e: any) => setItem({ ...item, type: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label={t('状态')}>
            <Select
              value={item.status || 'draft'}
              onValueChange={(v: any) => setItem({ ...item, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t('草稿')}</SelectItem>
                <SelectItem value="active">{t('生效中')}</SelectItem>
                <SelectItem value="expired">{t('已过期')}</SelectItem>
                <SelectItem value="renewed">{t('已续签')}</SelectItem>
                <SelectItem value="terminated">{t('已终止')}</SelectItem>
              </SelectContent>
            </Select>
          </FormFieldRow>
          <FormFieldGrid>
            <FormFieldRow label={t('开始日期')}>
              <DateInput
                type="date"
                value={item.startDate || ''}
                onChange={(e: any) => setItem({ ...item, startDate: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('结束日期')}>
              <DateInput
                type="date"
                value={item.endDate || ''}
                onChange={(e: any) => setItem({ ...item, endDate: e.target.value })}
              />
            </FormFieldRow>
          </FormFieldGrid>
          <FormFieldRow label={t('协议内容')}>
            <Textarea
              value={item.content || ''}
              onChange={(e: any) => setItem({ ...item, content: e.target.value })}
              rows={4}
            />
          </FormFieldRow>
          <FormFieldRow label={t('前台展示')}>
            <Switch
              checked={item.isPublic || false}
              onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })}
            />
          </FormFieldRow>
        </div>
      )}
      getDeleteDescription={(item: any) => (
        <>{t('确定要删除协议「{name}」吗？', { name: item.name })}</>
      )}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await allianceAgreementApi.update(item.id, item)
        } else {
          await allianceAgreementApi.create(item)
        }
        toast({ title: t('协议已{action}', { action: isEdit ? t('更新') : t('创建') }) })
        await refresh()
      }}
      onDelete={async (item: any) => {
        await allianceAgreementApi.delete(item.id)
        toast({ title: t('协议已删除') })
        await refresh()
      }}
      onToggleEnabled={async (item: any) => {
        // 全量回传：后端 PUT 为全列覆盖，避免部分字段被清空
        await allianceAgreementApi.update(item.id, { ...item, isPublic: !item.isPublic })
        toast({ title: item.isPublic ? t('已取消前台展示') : t('已开启前台展示') })
      }}
    />
  )
}
