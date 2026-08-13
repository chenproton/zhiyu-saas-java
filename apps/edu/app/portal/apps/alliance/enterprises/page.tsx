'use client'

import { useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { MultiSelect } from '@/components/ui/multi-select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Pencil,
  ExternalLink,
  Link2,
  Search,
  Loader2,
  Unlink,
  Building2,
  PlusCircle,
} from 'lucide-react'
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
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { formatDate } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'
import { useAllianceDictionary, mergeDictOptions } from '@/lib/alliance-dicts'
import type { AllianceEnterprise } from '@/lib/types'

export default function AllianceEnterprisesPage() {
  const { tenantId, loading: authLoading } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const { colleges: secondaryCollegeOptions } = useSecondaryColleges(tenantId)
  const { items: statusItems } = useAllianceDictionary('enterprise_status', tenantId)
  const { items: ratingItems } = useAllianceDictionary('cooperation_rating', tenantId)
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

  // ── 引入企业（全局企业池搜索 → link） ─────────────────────
  const [linkDialog, setLinkDialog] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<AllianceEnterprise[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  const doSearch = async () => {
    setSearching(true)
    try {
      const res = await allianceEnterpriseApi.search(searchKeyword)
      setSearchResults(res.items || [])
    } catch (e: any) {
      toast({ title: t('搜索失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSearching(false)
    }
  }

  const doLink = async (id: string) => {
    setLinkingId(id)
    try {
      await allianceEnterpriseApi.link(id)
      toast({ title: t('企业已引入') })
      setLinkDialog(false)
      setSearchResults(null)
      setSearchKeyword('')
      await refresh()
    } catch (e: any) {
      toast({ title: t('引入失败'), description: e.message, variant: 'destructive' })
    } finally {
      setLinkingId(null)
    }
  }

  // ── 代注册企业（学校为企业创建租户+账号，直接建立合作关联） ───────
  const [registerDialog, setRegisterDialog] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [reg, setReg] = useState({
    enterpriseName: '',
    unifiedSocialCreditCode: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    username: '',
    password: '',
    confirmPassword: '',
  })

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reg.password !== reg.confirmPassword) {
      toast({ title: t('两次输入的密码不一致'), variant: 'destructive' })
      return
    }
    setRegistering(true)
    try {
      await allianceEnterpriseApi.register({
        enterpriseName: reg.enterpriseName,
        unifiedSocialCreditCode: reg.unifiedSocialCreditCode || undefined,
        contactPerson: reg.contactPerson || undefined,
        contactPhone: reg.contactPhone || undefined,
        contactEmail: reg.contactEmail || undefined,
        username: reg.username,
        password: reg.password,
      })
      toast({
        title: t('代注册成功'),
        description: t(
          '已创建企业账号 {username}，请将用户名和密码转交企业，企业即可登录企业服务台',
          {
            username: reg.username,
          },
        ),
      })
      setRegisterDialog(false)
      setReg({
        enterpriseName: '',
        unifiedSocialCreditCode: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        username: '',
        password: '',
        confirmPassword: '',
      })
      await refresh()
    } catch (err: any) {
      toast({
        title: t('代注册失败'),
        description: err.message || t('未知错误'),
        variant: 'destructive',
      })
    } finally {
      setRegistering(false)
    }
  }

  // ── 解除引入 ──────────────────────────────────────────────
  const [unlinkTarget, setUnlinkTarget] = useState<AllianceEnterprise | null>(null)
  const [unlinking, setUnlinking] = useState(false)

  const confirmUnlink = async () => {
    if (!unlinkTarget) return
    setUnlinking(true)
    try {
      await allianceEnterpriseApi.unlink(unlinkTarget.id)
      toast({ title: t('已解除引入') })
      setUnlinkTarget(null)
      await refresh()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    } finally {
      setUnlinking(false)
    }
  }

  const countBy = (arr: any[], field: string, id: string) =>
    arr.filter((x) => (x[field] || []).includes?.(id)).length

  const linkedIds = new Set((enterprises ?? []).map((e) => e.id))

  return (
    <>
      <PortalCrudPage
        title={t('合作企业管理')}
        description={t('从全局企业池引入合作企业，维护本校合作关系（评级/状态/前台展示）。')}
        entityLabel={t('合作企业')}
        searchPlaceholder={t('搜索企业名称或行业...')}
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
        headerActions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setRegisterDialog(true)}>
              <Building2 className="h-4 w-4 mr-1" />
              {t('代注册企业')}
            </Button>
            <Button size="sm" onClick={() => setLinkDialog(true)}>
              <Link2 className="h-4 w-4 mr-1" />
              {t('引入企业')}
            </Button>
          </div>
        }
        hideCreate
        colSpan={11}
        renderTableHeader={() => (
          <>
            <TableHead>{t('企业名称')}</TableHead>
            <TableHead>{t('前台展示')}</TableHead>
            <TableHead>{t('类型')}</TableHead>
            <TableHead>{t('地址')}</TableHead>
            <TableHead>{t('状态')}</TableHead>
            <TableHead>{t('评级')}</TableHead>
            <TableHead>{t('合作协议')}</TableHead>
            <TableHead>{t('合作项目')}</TableHead>
            <TableHead>{t('合作成果')}</TableHead>
            <TableHead>{t('更新时间')}</TableHead>
            <TableHead>{t('操作')}</TableHead>
          </>
        )}
        renderTableRow={(enterprise: AllianceEnterprise, actions: any) => (
          <>
            <TableCell className="font-medium max-w-[180px] truncate">
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
            <TableCell className="max-w-[140px] truncate">{enterprise.address || '-'}</TableCell>
            <TableCell>{allianceLabel('enterpriseStatus', enterprise.status)}</TableCell>
            {/* 评级：与编辑弹窗一致，未设置时按默认评级 general 展示 */}
            <TableCell>
              {allianceLabel('enterpriseRating', enterprise.rating || 'general')}
            </TableCell>
            <TableCell>
              <Link
                href={`/portal/apps/alliance/enterprises/${enterprise.id}?tab=agreements`}
                className="text-primary hover:underline"
              >
                {
                  (agreements ?? []).filter((a) =>
                    (a.enterpriseIds || []).includes?.(enterprise.id),
                  ).length
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
            <TableCell className="whitespace-nowrap">{formatDate(enterprise.updatedAt)}</TableCell>
            <TableRowActions>
              <Link href={`/portal/apps/alliance/enterprises/${enterprise.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  {t('查看')}
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={actions.edit}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                {t('编辑')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => setUnlinkTarget(enterprise)}
              >
                <Unlink className="h-3.5 w-3.5 mr-1" />
                {t('解除引入')}
              </Button>
            </TableRowActions>
          </>
        )}
        createDefault={() => ({}) as AllianceEnterprise}
        renderForm={(item: any, setItem: any) => (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('企业主体信息由企业侧维护，此处仅维护本校合作关系字段。')}
            </p>
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
            <FormFieldRow label={t('合作状态')}>
              <Select
                value={item.status || 'negotiating'}
                onValueChange={(v: any) => setItem({ ...item, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mergeDictOptions(statusItems, item.status || 'negotiating').map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </SelectItem>
                  ))}
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
                  {mergeDictOptions(ratingItems, item.rating || 'general').map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label={t('关联二级学院')}>
              <MultiSelect
                options={secondaryCollegeOptions}
                value={item.secondaryColleges || []}
                onChange={(v: string[]) => setItem({ ...item, secondaryColleges: v })}
                placeholder={t('选择归属学院')}
              />
            </FormFieldRow>
            <div className="flex items-center gap-2">
              <Switch
                checked={item.isPublic || false}
                onCheckedChange={(v: any) => setItem({ ...item, isPublic: v })}
              />
              <Label>{t('在本校前台展示')}</Label>
            </div>
          </div>
        )}
        onSave={async (item: any) => {
          await allianceEnterpriseApi.update(item.id, {
            enterpriseType: item.enterpriseType,
            status: item.status,
            rating: item.rating,
            isPublic: item.isPublic,
            secondaryColleges: item.secondaryColleges,
          })
          toast({ title: t('合作关系已更新') })
          await refresh()
        }}
        onToggleEnabled={async (item: any) => {
          await allianceEnterpriseApi.update(item.id, { isPublic: !item.isPublic })
          await refresh()
        }}
      />

      {/* 引入企业：全局企业池搜索 */}
      <Dialog
        open={linkDialog}
        onOpenChange={(o) => {
          setLinkDialog(o)
          if (!o) {
            setSearchResults(null)
            setSearchKeyword('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('引入企业')}</DialogTitle>
            <DialogDescription>
              {t('从全局企业池搜索已注册的企业，引入后建立校企合作关系。')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                autoComplete="off"
                placeholder={t('输入企业名称关键词...')}
                className="pl-9"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), doSearch())}
              />
            </div>
            <Button variant="outline" onClick={doSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : t('搜索')}
            </Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {searchResults === null ? (
              <p className="text-center py-6 text-sm text-muted-foreground">
                {t('输入关键词搜索企业')}
              </p>
            ) : searchResults.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">
                {t('未找到匹配的企业')}
              </p>
            ) : (
              searchResults.map((e) => (
                <div key={e.id} className="flex items-center gap-2 p-2 rounded border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[e.industry, e.region].filter(Boolean).join(' · ') || t('未填写行业地区')}
                    </p>
                  </div>
                  {linkedIds.has(e.id) ? (
                    <span className="text-xs text-muted-foreground shrink-0">{t('已引入')}</span>
                  ) : (
                    <Button size="sm" onClick={() => doLink(e.id)} disabled={linkingId !== null}>
                      {linkingId === e.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('引入')
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>
              {t('关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 代注册企业：学校为企业创建租户+管理员账号 */}
      <Dialog
        open={registerDialog}
        onOpenChange={(o) => {
          setRegisterDialog(o)
          if (!o)
            setReg({
              enterpriseName: '',
              unifiedSocialCreditCode: '',
              contactPerson: '',
              contactPhone: '',
              contactEmail: '',
              username: '',
              password: '',
              confirmPassword: '',
            })
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('代注册企业')}</DialogTitle>
            <DialogDescription>
              {t('为企业创建账号，注册后直接建立本校合作关联；请将用户名和密码转交企业。')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={doRegister} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                {t('企业名称')} <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={t('请输入企业全称')}
                value={reg.enterpriseName}
                onChange={(e) => setReg((p) => ({ ...p, enterpriseName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('统一社会信用代码')}</Label>
              <Input
                placeholder={t('如：91320594MA1P7XXXX1')}
                value={reg.unifiedSocialCreditCode}
                onChange={(e) => setReg((p) => ({ ...p, unifiedSocialCreditCode: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('联系人')}</Label>
                <Input
                  placeholder={t('请输入联系人姓名')}
                  value={reg.contactPerson}
                  onChange={(e) => setReg((p) => ({ ...p, contactPerson: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('手机号')}</Label>
                <Input
                  placeholder={t('请输入手机号')}
                  value={reg.contactPhone}
                  onChange={(e) => setReg((p) => ({ ...p, contactPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('联系邮箱（选填）')}</Label>
              <Input
                type="email"
                placeholder={t('请输入联系邮箱')}
                value={reg.contactEmail}
                onChange={(e) => setReg((p) => ({ ...p, contactEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('用户名')} <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={t('设置登录用户名（企业内唯一）')}
                value={reg.username}
                onChange={(e) => setReg((p) => ({ ...p, username: e.target.value }))}
                autoComplete="username"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  {t('密码')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  placeholder={t('设置登录密码')}
                  value={reg.password}
                  onChange={(e) => setReg((p) => ({ ...p, password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t('确认密码')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  placeholder={t('再次输入密码')}
                  value={reg.confirmPassword}
                  onChange={(e) => setReg((p) => ({ ...p, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterDialog(false)}
                disabled={registering}
              >
                {t('取消')}
              </Button>
              <Button type="submit" disabled={registering}>
                {registering ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4 mr-1" />
                )}
                {t('代注册并关联')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 解除引入确认 */}
      <ConfirmDialog
        open={unlinkTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnlinkTarget(null)
        }}
        title={t('解除引入')}
        description={
          unlinkTarget
            ? t('确定要解除与 {name} 的引入关系吗？历史协议/项目/成果引用保留，但页面不再展示。', {
                name: unlinkTarget.name,
              })
            : ''
        }
        pending={unlinking}
        variant="destructive"
        confirmText={unlinking ? t('解除中...') : t('解除引入')}
        onConfirm={confirmUnlink}
      />
    </>
  )
}
