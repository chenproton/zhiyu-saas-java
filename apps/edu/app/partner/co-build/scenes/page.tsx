'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TableCell, TableHead } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Trash2, Send, Undo2 } from 'lucide-react'
import { partnerCobuildScenarioApi, partnerSchoolApi } from '@/lib/api'
import type { CoBuildScenario } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { StatusBadge } from '@/components/shared/status-badge'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { formatDateTime } from '@/lib/format-utils'

export default function PartnerCoBuildScenesPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const [schoolFilter, setSchoolFilter] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)

  // 已确认合作（active）的学校：用于顶部筛选与"新建"弹窗选学校
  const { data: schoolsData } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerSchoolApi.list({ limit: 200 })
      return (res.items || []).filter((s) => s.status === 'active')
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )
  const activeSchools = schoolsData ?? []

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerCobuildScenarioApi.list({
        schoolTenantId: schoolFilter || undefined,
        limit: 200,
      })
      return res.items || []
    },
    { deps: [authLoading, user?.id, schoolFilter], onError: () => true },
  )

  const scenes = data ?? []

  const doTransition = async (item: CoBuildScenario, action: 'submit' | 'withdraw') => {
    setActingId(item.id)
    try {
      if (action === 'submit') {
        await partnerCobuildScenarioApi.submit(item.id)
        toast({ title: t('已提交审核') })
      } else {
        await partnerCobuildScenarioApi.withdraw(item.id)
        toast({ title: t('已撤回') })
      }
      await refresh()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: t('操作失败'),
        description: e instanceof Error ? e.message : t('未知错误'),
      })
    } finally {
      setActingId(null)
    }
  }

  // 学校授权资源：编辑前先创建编辑稿（draft 副本），编辑稿提交学校审批后覆盖原资源
  const doEditSource = async (item: CoBuildScenario) => {
    setActingId(item.id)
    try {
      const draft = await partnerCobuildScenarioApi.editSource(item.id)
      toast({ title: t('已创建编辑稿，编辑完成后提交学校审批') })
      router.push(`/partner/co-build/scenes/${draft.id}/edit`)
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: t('创建编辑稿失败'),
        description: e.message,
      })
    } finally {
      setActingId(null)
    }
  }

  const schoolSelector = (value: string, onChange: (v: string) => void, includeAll: boolean) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder={t('选择合作学校')} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{t('全部学校')}</SelectItem>}
        {activeSchools.map((s) => (
          <SelectItem key={s.tenantId} value={s.tenantId}>
            {s.schoolName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <PortalCrudPage
      title={t('场景共建')}
      description={t('为已确认合作的学校创建场景资源，提交后由学校审批生效。')}
      entityLabel={t('场景')}
      searchPlaceholder={t('搜索场景名称...')}
      createButtonLabel={t('新建场景')}
      items={scenes}
      loading={loading || authLoading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, search) =>
        items.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
      }
      searchRight={schoolSelector(
        schoolFilter || 'all',
        (v) => setSchoolFilter(v === 'all' ? '' : v),
        true,
      )}
      colSpan={5}
      emptyContent={
        activeSchools.length === 0 ? (
          <div className="py-4">
            <p>{t('暂无已确认合作的学校，无法共建场景。')}</p>
            <Link href="/partner/schools" className="text-primary hover:underline">
              {t('前往合作学校页确认合作')}
            </Link>
          </div>
        ) : undefined
      }
      createDefault={() => ({ id: '', schoolTenantId: '' }) as CoBuildScenario}
      renderForm={(item, setItem) => (
        <div className="grid gap-2">
          <Label>{t('合作学校')}</Label>
          {activeSchools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('暂无已确认合作的学校，请先在合作学校页确认合作。')}
            </p>
          ) : (
            schoolSelector(
              item.schoolTenantId,
              (v) => setItem({ ...item, schoolTenantId: v }),
              false,
            )
          )}
          <p className="text-xs text-muted-foreground">
            {t('创建后将生成草稿「未命名场景」，并跳转到编辑页完善内容。')}
          </p>
        </div>
      )}
      onSave={async (item) => {
        if (!item.schoolTenantId) throw new Error(t('请选择合作学校'))
        const created = await partnerCobuildScenarioApi.create({
          schoolTenantId: item.schoolTenantId,
          name: t('未命名场景'),
        })
        router.push(`/partner/co-build/scenes/${created.id}/edit?new=true`)
      }}
      renderTableHeader={() => (
        <>
          <TableHead>{t('名称')}</TableHead>
          <TableHead>{t('合作学校')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('更新时间')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(s: CoBuildScenario, actions) => (
        <>
          <TableCell className="font-medium">{s.name}</TableCell>
          <TableCell>{s.schoolName || '-'}</TableCell>
          <TableCell>
            <StatusBadge status={s.status} />
          </TableCell>
          <TableCell>{formatDateTime(s.updatedAt)}</TableCell>
          <TableRowActions>
            {s.sourceType === 'enterprise' ? (
              <Link href={`/partner/co-build/scenes/${s.id}/edit`}>
                <Button variant="ghost" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t('编辑')}
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={actingId === s.id}
                onClick={() => doEditSource(s)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {actingId === s.id ? t('创建中...') : t('编辑')}
              </Button>
            )}
            {(s.status === 'draft' || s.status === 'rejected') && (
              <Button
                variant="ghost"
                size="sm"
                disabled={actingId === s.id}
                onClick={() => doTransition(s, 'submit')}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                {t('提交审核')}
              </Button>
            )}
            {s.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={actingId === s.id}
                onClick={() => doTransition(s, 'withdraw')}
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                {t('撤回')}
              </Button>
            )}
            {(s.status === 'draft' || s.status === 'rejected') && (
              <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('删除')}
              </Button>
            )}
          </TableRowActions>
        </>
      )}
      getDeleteDescription={(item) => <>{t('确定要删除场景 {name} 吗？', { name: item.name })}</>}
      onDelete={async (item) => {
        await partnerCobuildScenarioApi.delete(item.id)
        toast({ title: t('已删除') })
        await refresh()
      }}
    />
  )
}
