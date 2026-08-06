'use client'

import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  allianceEnterpriseApi,
  allianceProjectApi,
  allianceAchievementApi,
  allianceAgreementApi,
} from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { formatDate } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceEnterprise } from '@/lib/types'

export default function AllianceEnterprisesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return { enterprises: [], projects: [], achievements: [], agreements: [] }
      const [ent, proj, ach, agr] = await Promise.all([
        allianceEnterpriseApi.list(),
        allianceProjectApi.list({ limit: 200 }),
        allianceAchievementApi.list({ limit: 200 }),
        allianceAgreementApi.list({ limit: 200 }),
      ])
      return {
        enterprises: ent.items || [],
        projects: proj.items || [],
        achievements: ach.items || [],
        agreements: agr.items || [],
      }
    },
    { deps: [tenantId, authLoading], onError: () => true },
  )

  const { enterprises, projects, achievements, agreements } = data ?? {}

  const countBy = (arr: any[], field: string, id: string) =>
    arr.filter((x) => (x[field] || []).includes?.(id)).length

  return (
    <PortalCrudPage
      title={t('合作企业管理')}
      description={t('管理全部合作企业档案，包含基本信息、合作协议、合作评级等。')}
      entityLabel={t('合作企业')}
      searchPlaceholder={t('搜索企业名称或行业...')}
      createButtonLabel={t('新建企业')}
      items={enterprises ?? []}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, search) =>
        items.filter(
          (e) =>
            !search ||
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            (e.industry || '').toLowerCase().includes(search.toLowerCase()),
        )
      }
      importConfig={{
        importType: 'alliance-enterprises',
        entityLabel: t('合作企业'),
        templateFileName: t('合作企业批量导入模板.xlsx'),
      }}
      createHref="/portal/apps/alliance/enterprises/new"
      colSpan={14}
      renderTableHeader={() => (
        <>
          <TableHead>{t('企业名称')}</TableHead>
          <TableHead>{t('前台展示')}</TableHead>
          <TableHead>{t('类型')}</TableHead>
          <TableHead>{t('行业')}</TableHead>
          <TableHead>{t('地址')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('评级')}</TableHead>
          <TableHead>{t('合作协议')}</TableHead>
          <TableHead>{t('合作项目')}</TableHead>
          <TableHead>{t('合作成果')}</TableHead>
          <TableHead>{t('创建人')}</TableHead>
          <TableHead>{t('创建时间')}</TableHead>
          <TableHead>{t('更新时间')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(enterprise: any, actions: any) => (
        <>
          <TableCell className="font-medium">
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}`}
              className="hover:underline"
            >
              {enterprise.name}
            </Link>
          </TableCell>
          <TableCell>
            <Switch checked={enterprise.isPublic || false} onCheckedChange={actions.toggle} />
          </TableCell>
          <TableCell>{allianceLabel('enterpriseType', enterprise.enterpriseType)}</TableCell>
          <TableCell>{enterprise.industry || '-'}</TableCell>
          <TableCell className="max-w-[160px] truncate">{enterprise.address || '-'}</TableCell>
          <TableCell>{allianceLabel('enterpriseStatus', enterprise.status)}</TableCell>
          <TableCell>{allianceLabel('enterpriseRating', enterprise.rating)}</TableCell>
          <TableCell>
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}?tab=agreements`}
              className="text-primary hover:underline"
            >
              {
                (agreements ?? []).filter((a) => (a.enterpriseIds || []).includes?.(enterprise.id))
                  .length
              }
            </Link>
          </TableCell>
          <TableCell>
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}?tab=projects`}
              className="text-primary hover:underline"
            >
              {countBy(projects ?? [], 'enterpriseIds', enterprise.id)}
            </Link>
          </TableCell>
          <TableCell>
            <Link
              href={`/portal/apps/alliance/enterprises/${enterprise.id}?tab=achievements`}
              className="text-primary hover:underline"
            >
              {countBy(achievements ?? [], 'enterpriseIds', enterprise.id)}
            </Link>
          </TableCell>
          <TableCell>{enterprise.createdBy || '-'}</TableCell>
          <TableCell>{formatDate(enterprise.createdAt)}</TableCell>
          <TableCell>{formatDate(enterprise.updatedAt)}</TableCell>
          <TableRowActions>
            <Link href={`/portal/apps/alliance/enterprises/${enterprise.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {t('查看')}
              </Button>
            </Link>
            <Link href={`/portal/apps/alliance/enterprises/${enterprise.id}/edit`}>
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
      )}
      createDefault={() =>
        ({
          id: '',
          name: '',
          enterpriseType: 'cooperation',
          status: 'negotiating',
          rating: 'general',
          isPublic: false as any,
          industry: '',
          region: '',
          description: '',
          contactPerson: '',
          contactPhone: '',
          contactEmail: '',
          cooperationTypes: [] as any,
          businessLicensePhotos: [] as any,
          qualificationPhotos: [] as any,
          intellectualPropertyPhotos: [] as any,
          coverPhotos: [] as any,
          secondaryColleges: [] as any,
          createdAt: '',
          updatedAt: '',
        }) as AllianceEnterprise & { enabled?: boolean }
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormFieldRow label={t('企业名称')} required>
              <Input
                value={item.name || ''}
                onChange={(e: any) => setItem({ ...item, name: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('企业类型')}>
              <Select
                value={item.enterpriseType || 'cooperation'}
                onValueChange={(v: any) => setItem({ ...item, enterpriseType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cooperation">{t('合作企业')}</SelectItem>
                  <SelectItem value="third-party">{t('第三方雇主企业')}</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label={t('所属行业')}>
              <Input
                value={item.industry || ''}
                onChange={(e: any) => setItem({ ...item, industry: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('所在地区')}>
              <Input
                value={item.region || ''}
                onChange={(e: any) => setItem({ ...item, region: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('合作状态')}>
              <Select
                value={item.status || 'negotiating'}
                onValueChange={(v: any) => setItem({ ...item, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="negotiating">{t('洽谈中')}</SelectItem>
                  <SelectItem value="active">{t('合作中')}</SelectItem>
                  <SelectItem value="paused">{t('已暂停')}</SelectItem>
                  <SelectItem value="terminated">{t('已终止')}</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label={t('合作评级')}>
              <Select
                value={item.rating || 'general'}
                onValueChange={(v: any) => setItem({ ...item, rating: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strategic">{t('战略合作')}</SelectItem>
                  <SelectItem value="deep">{t('深度合作')}</SelectItem>
                  <SelectItem value="general">{t('一般合作')}</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label={t('联系人')}>
              <Input
                value={item.contactPerson || ''}
                onChange={(e: any) => setItem({ ...item, contactPerson: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('联系电话')}>
              <Input
                value={item.contactPhone || ''}
                onChange={(e: any) => setItem({ ...item, contactPhone: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('联系邮箱')}>
              <Input
                value={item.contactEmail || ''}
                onChange={(e: any) => setItem({ ...item, contactEmail: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('Logo URL')}>
              <Input
                value={item.logoUrl || ''}
                onChange={(e: any) => setItem({ ...item, logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </FormFieldRow>
            <FormFieldRow label={t('企业地址')}>
              <Input
                value={item.address || ''}
                onChange={(e: any) => setItem({ ...item, address: e.target.value })}
              />
            </FormFieldRow>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={item.isPublic || false}
                onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })}
              />
              <Label>{t('公开显示')}</Label>
            </div>
          </div>
          <FormFieldRow label={t('企业描述')}>
            <Textarea
              value={item.description || ''}
              onChange={(e: any) => setItem({ ...item, description: e.target.value })}
              rows={4}
            />
          </FormFieldRow>
        </div>
      )}
      getDeleteDescription={(item: any) => (
        <>{t('确定要删除合作企业 {name} 吗？此操作不可撤销。', { name: item.name })}</>
      )}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await allianceEnterpriseApi.update(item.id, item)
        } else {
          await allianceEnterpriseApi.create(item)
        }
        toast({ title: t('企业已{action}', { action: isEdit ? t('更新') : t('创建') }) })
        await refresh()
      }}
      onDelete={async (item: any) => {
        await allianceEnterpriseApi.delete(item.id)
        toast({ title: t('企业已删除') })
        await refresh()
      }}
      onToggleEnabled={async (item: any) => {
        await allianceEnterpriseApi.togglePublic(item.id, !item.isPublic)
        await refresh()
      }}
    />
  )
}
