'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pencil, Trash2, ExternalLink, Save } from 'lucide-react'
import Link from 'next/link'
import { partnerExpertApi } from '@/lib/api'
import { useToast, useAsync, LoadingView } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import type { PartnerExpert } from '@/lib/api'
import {
  PartnerExpertForm,
  PartnerExpertSettingsCard,
  emptyPartnerExpertForm,
  type PartnerExpertFormState,
} from './_components/expert-form'

// 专家（enterprise_member）我的档案视图：只能查看/编辑本人档案
function MyExpertProfile() {
  const t = useT()
  const { toast } = useToast()
  const { loading: authLoading } = usePartnerAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState<PartnerExpertFormState>(emptyPartnerExpertForm)

  useEffect(() => {
    if (authLoading) return
    partnerExpertApi
      .me()
      .then((expert) =>
        setItem({
          name: expert.name || '',
          gender: expert.gender || 'male',
          age: expert.age,
          city: expert.city || '',
          title: expert.title || '',
          position: expert.position || '',
          experienceYears: expert.experienceYears,
          education: expert.education || '',
          industry: expert.industry || '',
          specialties: expert.specialties || [],
          introduction: expert.introduction || '',
          workExperience: expert.workExperience || '',
          avatarUrl: expert.avatarUrl || '',
          coverImage: expert.coverImage || '',
          attachments: expert.attachments || [],
          status: expert.status || 'active',
          isPublic: expert.isPublic || false,
        }),
      )
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [authLoading, toast, t])

  const handleSave = async () => {
    if (!item.name) {
      toast({ title: t('请填写姓名'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await partnerExpertApi.updateMe(item)
      toast({ title: t('档案已更新') })
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) return <LoadingView />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('我的专家档案')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('维护你的专家档案，档案将共享给引入本企业的合作学校（学校端只读）。')}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <PartnerExpertForm item={item} onChange={setItem} />
        </div>
        <div className="space-y-6">
          <PartnerExpertSettingsCard item={item} onChange={setItem} />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{t('保存')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? t('保存中...') : t('保存档案')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function PartnerExpertsPage() {
  const { user, isAdmin, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user || !isAdmin) return []
      const res = await partnerExpertApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [authLoading, user?.id, isAdmin], onError: () => true },
  )

  const experts = data ?? []

  // 专家（member）只展示我的档案
  if (!isAdmin) return <MyExpertProfile />

  return (
    <PortalCrudPage
      title={t('专家资源')}
      description={t('维护企业专家档案，档案将共享给引入本企业的合作学校（学校端只读）。')}
      entityLabel={t('专家')}
      searchPlaceholder={t('搜索姓名、头衔或行业...')}
      createButtonLabel={t('新建专家')}
      items={experts}
      loading={loading || authLoading}
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
      createHref={isAdmin ? '/partner/experts/new' : undefined}
      hideCreate={!isAdmin}
      colSpan={8}
      renderTableHeader={() => (
        <>
          <TableHead>{t('姓名')}</TableHead>
          <TableHead>{t('头衔')}</TableHead>
          <TableHead>{t('职位')}</TableHead>
          <TableHead>{t('行业')}</TableHead>
          <TableHead>{t('所在城市')}</TableHead>
          <TableHead>{t('状态')}</TableHead>
          <TableHead>{t('对外展示')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(e: PartnerExpert, actions) => (
        <>
          <TableCell className="font-medium">
            <Link href={`/partner/experts/${e.id}`} className="hover:underline">
              {e.name}
            </Link>
          </TableCell>
          <TableCell>{e.title || '-'}</TableCell>
          <TableCell>{e.position || '-'}</TableCell>
          <TableCell>{e.industry || '-'}</TableCell>
          <TableCell>{e.city || '-'}</TableCell>
          <TableCell>{allianceLabel('expertStatus', e.status)}</TableCell>
          <TableCell>{e.isPublic ? t('是') : t('否')}</TableCell>
          <TableRowActions>
            <Link href={`/partner/experts/${e.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {t('查看')}
              </Button>
            </Link>
            {isAdmin && (
              <>
                <Link href={`/partner/experts/${e.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {t('编辑')}
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={actions.delete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t('删除')}
                </Button>
              </>
            )}
          </TableRowActions>
        </>
      )}
      getDeleteDescription={(item) => <>{t('确定要删除专家 {name} 吗？', { name: item.name })}</>}
      onDelete={
        isAdmin
          ? async (item) => {
              await partnerExpertApi.delete(item.id)
              toast({ title: t('已删除') })
              await refresh()
            }
          : undefined
      }
    />
  )
}
