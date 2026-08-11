'use client'

import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAchievementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { formatDate } from '@/lib/format-utils'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/lib/i18n/locale-provider'
import { useAllianceDictionary, mergeDictOptions } from '@/lib/alliance-dicts'
import type { AllianceAchievement } from '@/lib/types'

export default function AllianceAchievementsPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const { items: typeItems } = useAllianceDictionary('achievement_type', tenantId)
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return { items: [], enterprises: [], projects: [] }
      const [data, ents, projs] = await Promise.all([
        allianceAchievementApi.list(),
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
      title={t('合作成果管理')}
      description={t('管理校企合作产出的各类成果')}
      entityLabel={t('合作成果')}
      searchPlaceholder={t('搜索成果名称...')}
      createButtonLabel={t('新建成果')}
      items={items ?? []}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(filtered, search) =>
        filtered.filter((a) => !search || a.title.toLowerCase().includes(search.toLowerCase()))
      }
      importConfig={{
        importType: 'alliance-achievements',
        entityLabel: t('合作成果'),
        templateFileName: t('合作成果批量导入模板.xlsx'),
      }}
      createHref="/portal/apps/alliance/achievements/new"
      colSpan={8}
      renderTableHeader={() => (
        <>
          <TableHead>{t('成果名称')}</TableHead>
          <TableHead>{t('前台展示')}</TableHead>
          <TableHead>{t('合作企业')}</TableHead>
          <TableHead>{t('关联项目')}</TableHead>
          <TableHead>{t('类型')}</TableHead>
          <TableHead>{t('发布时间')}</TableHead>
          <TableHead>{t('创建人')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(item: any, actions: any) => {
        const entIds: string[] = (item.enterpriseIds || []).map(String)
        const project = (projects ?? []).find((p) => p.id === (item.projectIds || [])[0])
        return (
          <>
            <TableCell className="font-medium">
              <Link
                href={`/portal/apps/alliance/achievements/${item.id}`}
                className="hover:underline"
              >
                {item.title}
              </Link>
            </TableCell>
            <TableCell>
              <Switch checked={item.isPublic || false} onCheckedChange={actions.toggle} />
            </TableCell>
            <TableCell className="max-w-[160px]">
              {entIds.length > 0
                ? entIds
                    .map((eid) => (enterprises ?? []).find((e) => e.id === eid)?.name || eid)
                    .join('、')
                : '-'}
            </TableCell>
            <TableCell>{project?.name || '-'}</TableCell>
            <TableCell>{allianceLabel('achievementType', item.type)}</TableCell>
            <TableCell>{formatDate(item.achievementDate)}</TableCell>
            <TableCell>{item.createdBy || '-'}</TableCell>
            <TableRowActions>
              <Link href={`/portal/apps/alliance/achievements/${item.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  {t('查看')}
                </Button>
              </Link>
              <Link href={`/portal/apps/alliance/achievements/${item.id}/edit`}>
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
          title: '',
          type: 'custom',
          status: 'draft',
          isPublic: false as any,
          description: '',
          coverImage: '',
          viewCount: 0,
          enabled: true as any,
          createdAt: '',
          updatedAt: '',
        }) as AllianceAchievement & { enabled?: boolean }
      }
      renderForm={(item: any, setItem: any) => (
        <div className="space-y-4">
          <FormFieldRow label={t('成果标题')} required>
            <Input
              value={item.title || ''}
              onChange={(e: any) => setItem({ ...item, title: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label={t('成果类型')}>
            <Select
              value={item.type || 'custom'}
              onValueChange={(v: any) => setItem({ ...item, type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mergeDictOptions(typeItems, item.type || 'custom').map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldRow>
          <FormFieldRow label={t('描述')}>
            <Textarea
              value={item.description || ''}
              onChange={(e: any) => setItem({ ...item, description: e.target.value })}
              rows={4}
            />
          </FormFieldRow>
          <FormFieldRow label={t('封面图 URL')}>
            <Input
              value={item.coverImage || ''}
              onChange={(e: any) => setItem({ ...item, coverImage: e.target.value })}
              placeholder="https://..."
            />
          </FormFieldRow>
        </div>
      )}
      getDeleteDescription={(item: any) => (
        <>{t('确定要删除成果「{title}」吗？', { title: item.title })}</>
      )}
      onSave={async (item: any, isEdit: boolean) => {
        if (isEdit) {
          await allianceAchievementApi.update(item.id, item)
        } else {
          await allianceAchievementApi.create(item)
        }
        toast({ title: t('成果已{action}', { action: isEdit ? t('更新') : t('创建') }) })
        await refresh()
      }}
      onDelete={async (item: any) => {
        await allianceAchievementApi.delete(item.id)
        toast({ title: t('成果已删除') })
        await refresh()
      }}
      onToggleEnabled={async (item: any) => {
        // 全量回传：后端 PUT 为全列覆盖，避免部分字段被清空
        await allianceAchievementApi.update(item.id, { ...item, isPublic: !item.isPublic })
        toast({ title: item.isPublic ? t('已取消前台展示') : t('已开启前台展示') })
      }}
    />
  )
}
