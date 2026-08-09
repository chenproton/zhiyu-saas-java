'use client'

// 成员账号管理：仅 enterprise_admin 可见（侧栏已隐藏，页面再兜底一次）
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { Pencil, Trash2 } from 'lucide-react'
import { partnerMemberApi } from '@/lib/api'
import { useToast, useAsync } from '@zhiyu/ui'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { formatDate } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import type { PartnerMember } from '@/lib/api'

type MemberForm = PartnerMember & { password?: string }

export default function PartnerMembersPage() {
  const router = useRouter()
  const { user, isAdmin, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()

  // 仅 enterprise_admin 可访问
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/partner/workspace')
  }, [authLoading, isAdmin, router])

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !isAdmin) return []
      const res = await partnerMemberApi.list()
      return res.items || []
    },
    { deps: [authLoading, isAdmin], onError: () => true },
  )

  // 后端返回 domain.User，角色在 roleCodes 数组；补出单数 roleCode 供表格/编辑表单使用
  const members = (data ?? []).map((m) => ({
    ...m,
    roleCode: (m.roleCodes?.[0] ?? m.roleCode) as MemberForm['roleCode'],
  }))

  return (
    <PortalCrudPage<MemberForm>
      title={t('成员账号')}
      description={t('管理企业成员登录账号：管理员可维护全部企业数据，成员仅可查看。')}
      entityLabel={t('成员')}
      searchPlaceholder={t('搜索用户名或姓名...')}
      createButtonLabel={t('新建成员')}
      items={members}
      loading={loading || authLoading}
      error={error?.message ?? null}
      onRetry={refresh}
      filterItems={(items, search) =>
        items.filter(
          (m) =>
            !search ||
            m.username.toLowerCase().includes(search.toLowerCase()) ||
            (m.name || '').toLowerCase().includes(search.toLowerCase()),
        )
      }
      colSpan={7}
      renderTableHeader={() => (
        <>
          <TableHead>{t('用户名')}</TableHead>
          <TableHead>{t('姓名')}</TableHead>
          <TableHead>{t('手机号')}</TableHead>
          <TableHead>{t('角色')}</TableHead>
          <TableHead>{t('最近登录')}</TableHead>
          <TableHead>{t('创建时间')}</TableHead>
          <TableHead>{t('操作')}</TableHead>
        </>
      )}
      renderTableRow={(m, actions) => (
        <>
          <TableCell className="font-medium">{m.username}</TableCell>
          <TableCell>{m.name || '-'}</TableCell>
          <TableCell>{m.phone || '-'}</TableCell>
          <TableCell>
            {(m.roleCodes?.[0] ?? m.roleCode) === 'enterprise_admin' ? t('企业管理员') : t('企业成员')}
          </TableCell>
          <TableCell>{formatDate(m.lastLoginAt)}</TableCell>
          <TableCell>{formatDate(m.createdAt)}</TableCell>
          <TableRowActions>
            <Button variant="ghost" size="sm" onClick={actions.edit}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {t('编辑')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={actions.delete}
              disabled={m.id === user?.id}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t('删除')}
            </Button>
          </TableRowActions>
        </>
      )}
      createDefault={() =>
        ({
          id: '',
          username: '',
          name: '',
          phone: '',
          email: '',
          roleCode: 'enterprise_member',
          status: 'active',
          password: '',
          createdAt: '',
        }) as MemberForm
      }
      renderForm={(item, setItem) => (
        <div className="space-y-4">
          <FormFieldRow label={t('用户名')} required>
            <Input
              value={item.username}
              onChange={(e) => setItem({ ...item, username: e.target.value })}
              disabled={!!item.id}
            />
          </FormFieldRow>
          <FormFieldRow label={t('姓名')} required>
            <Input
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label={t('手机号')}>
            <Input
              value={item.phone || ''}
              onChange={(e) => setItem({ ...item, phone: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label={t('邮箱')}>
            <Input
              value={item.email || ''}
              onChange={(e) => setItem({ ...item, email: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldRow label={t('角色')}>
            <Select
              value={item.roleCode}
              onValueChange={(v) => setItem({ ...item, roleCode: v as MemberForm['roleCode'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enterprise_member">{t('企业成员（只读）')}</SelectItem>
                <SelectItem value="enterprise_admin">{t('企业管理员')}</SelectItem>
              </SelectContent>
            </Select>
          </FormFieldRow>
          <FormFieldRow label={item.id ? t('重置密码（留空不修改）') : t('初始密码')} required={!item.id}>
            <Input
              type="password"
              value={item.password || ''}
              onChange={(e) => setItem({ ...item, password: e.target.value })}
              autoComplete="new-password"
            />
          </FormFieldRow>
        </div>
      )}
      getDeleteDescription={(item) => (
        <>{t('确定要删除成员 {name} 吗？该账号将无法再登录企业服务台。', { name: item.username })}</>
      )}
      onSave={async (item, isEdit) => {
        if (isEdit) {
          await partnerMemberApi.update(item.id, {
            name: item.name,
            phone: item.phone || undefined,
            email: item.email || undefined,
            roleCode: item.roleCode,
            password: item.password || undefined,
          })
        } else {
          if (!item.password) throw new Error(t('请设置初始密码'))
          await partnerMemberApi.create({
            username: item.username,
            name: item.name,
            phone: item.phone || undefined,
            email: item.email || undefined,
            roleCode: item.roleCode,
            password: item.password,
          })
        }
        toast({ title: t('成员已{action}', { action: isEdit ? t('更新') : t('创建') }) })
        await refresh()
      }}
      onDelete={async (item) => {
        await partnerMemberApi.delete(item.id)
        toast({ title: t('成员已删除') })
        await refresh()
      }}
    />
  )
}
