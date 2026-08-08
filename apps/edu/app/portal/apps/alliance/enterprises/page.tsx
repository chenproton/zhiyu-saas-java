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
import { Pencil, ExternalLink, Link2, Search, Loader2, Unlink } from 'lucide-react'
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
import type { AllianceEnterprise } from '@/lib/types'

const SECONDARY_COLLEGES = [
  '智能制造学院',
  '信息技术学院',
  '经济管理学院',
  '艺术设计学院',
  '新能源工程学院',
  '生物医药学院',
  '现代服务学院',
  '国际教育学院',
  '创新创业学院',
  '继续教育学院',
  '基础教育学院',
  '马克思主义学院',
]

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
          <Button size="sm" onClick={() => setLinkDialog(true)}>
            <Link2 className="h-4 w-4 mr-1" />
            {t('引入企业')}
          </Button>
        }
        hideCreate
        colSpan={13}
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
            <TableHead>{t('引入时间')}</TableHead>
            <TableHead>{t('更新时间')}</TableHead>
            <TableHead>{t('操作')}</TableHead>
          </>
        )}
        renderTableRow={(enterprise: AllianceEnterprise, actions: any) => (
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
            <TableCell>{formatDate(enterprise.createdAt)}</TableCell>
            <TableCell>{formatDate(enterprise.updatedAt)}</TableCell>
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
            <FormFieldRow label={t('关联二级学院')}>
              <MultiSelect
                options={SECONDARY_COLLEGES}
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
