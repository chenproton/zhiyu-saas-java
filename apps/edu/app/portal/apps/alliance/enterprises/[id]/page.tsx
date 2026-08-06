'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TableCell, TableHead } from '@/components/ui/table'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import {
  allianceEnterpriseApi,
  allianceAgreementApi,
  allianceProjectApi,
  allianceAchievementApi,
} from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { Link2, Plus, Loader2 } from 'lucide-react'
import type {
  AllianceEnterprise,
  AllianceAgreement,
  AllianceProject,
  AllianceAchievement,
} from '@/lib/types'

export default function AllianceEnterpriseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const [enterprise, setEnterprise] = useState<AllianceEnterprise | null>(null)
  const [agreements, setAgreements] = useState<AllianceAgreement[]>([])
  const [allAgreements, setAllAgreements] = useState<AllianceAgreement[]>([])
  const [projects, setProjects] = useState<AllianceProject[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [savingA, setSavingA] = useState(false)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkSelected, setLinkSelected] = useState<string[]>([])
  const [newDialog, setNewDialog] = useState(false)
  const [aForm, setAForm] = useState({
    name: '',
    type: '',
    startDate: '',
    endDate: '',
    status: 'draft',
    content: '',
  })

  const loadData = () => {
    if (!tenantId || !id) return
    Promise.all([
      allianceEnterpriseApi.get(id),
      allianceAgreementApi.list({ limit: 200 }),
      allianceProjectApi.list({ limit: 200 }),
      allianceAchievementApi.list({ limit: 200 }),
    ])
      .then(([ent, agr, proj, ach]) => {
        setEnterprise(ent)
        setAllAgreements(agr.items || [])
        setAgreements((agr.items || []).filter((a) => (a.enterpriseIds || []).includes?.(id)))
        setProjects(
          proj.items?.filter((p: AllianceProject) => (p.enterpriseIds as any)?.includes?.(id)) ||
            [],
        )
        setAchievements(
          ach.items?.filter((a: AllianceAchievement) => (a.enterpriseIds as any)?.includes?.(id)) ||
            [],
        )
      })
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [tenantId, id]) // eslint-disable-line

  const saveLink = async () => {
    setSavingA(true)
    try {
      for (const aid of linkSelected) {
        const agreement = allAgreements.find((a) => a.id === aid)
        if (!agreement) continue
        const ids = [...(agreement.enterpriseIds || []), id]
        await allianceAgreementApi.update(aid, { ...agreement, enterpriseIds: ids })
      }
      toast({ title: t('已关联 {count} 份协议', { count: linkSelected.length }) })
      setLinkDialog(false)
      setLinkSelected([])
      loadData()
    } catch (e: any) {
      toast({ title: t('关联失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSavingA(false)
    }
  }

  const createAgreement = async () => {
    if (!aForm.name) {
      toast({ title: t('请填写协议名称'), variant: 'destructive' })
      return
    }
    setSavingA(true)
    try {
      await allianceAgreementApi.create({ ...aForm, enterpriseIds: [id] })
      toast({ title: t('协议已创建并关联') })
      setNewDialog(false)
      setAForm({ name: '', type: '', startDate: '', endDate: '', status: 'draft', content: '' })
      loadData()
    } catch (e: any) {
      toast({ title: t('创建失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSavingA(false)
    }
  }

  const unlinkAgreement = async (aid: string) => {
    const agreement = allAgreements.find((a) => a.id === aid)
    if (!agreement) return
    try {
      await allianceAgreementApi.update(aid, {
        ...agreement,
        enterpriseIds: (agreement.enterpriseIds || []).filter((x) => x !== id),
      })
      toast({ title: t('已取消关联') })
      loadData()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  if (!enterprise && !loading) {
    return (
      <AllianceDetailShell
        title=""
        tabs={[]}
        notFound
        backHref="/portal/apps/alliance/enterprises"
      />
    )
  }

  const availableForLink = allAgreements.filter((a) => !(a.enterpriseIds || []).includes?.(id))

  const tabs = [
    {
      key: 'info',
      label: t('基本信息'),
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('基础信息')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('企业类型：')}</span>
                {allianceLabel('enterpriseType', enterprise?.enterpriseType)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('所属行业：')}</span>
                {enterprise?.industry || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('所在地区：')}</span>
                {enterprise?.region || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('统一社会信用代码：')}</span>
                {(enterprise as any)?.unifiedSocialCreditCode || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('成立年份：')}</span>
                {(enterprise as any)?.establishedYear || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('企业规模：')}</span>
                {(enterprise as any)?.employeeCount
                  ? t('{count}人', { count: (enterprise as any).employeeCount })
                  : '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('合作评级：')}</span>
                {allianceLabel('enterpriseRating', enterprise?.rating)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('关联二级学院：')}</span>
                {((enterprise as any)?.secondaryColleges || []).join('、') || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('前台展示：')}</span>
                {enterprise?.isPublic ? t('是') : t('否')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('联系信息')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('联系人：')}</span>
                {enterprise?.contactPerson || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('电话：')}</span>
                {enterprise?.contactPhone || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('邮箱：')}</span>
                {enterprise?.contactEmail || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('地址：')}</span>
                {enterprise?.address || '-'}
              </p>
            </CardContent>
          </Card>
          {(enterprise as any)?.businessLicensePhotos?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('营业执照')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {((enterprise as any).businessLicensePhotos || []).map((u: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={u}
                    alt={t('营业执照 {n}', { n: i + 1 })}
                    className="w-24 h-16 object-cover rounded border"
                  />
                ))}
              </CardContent>
            </Card>
          )}
          {(enterprise as any)?.intellectualPropertyPhotos?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('企业知识产权')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {((enterprise as any).intellectualPropertyPhotos || []).map(
                  (u: string, i: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={u}
                      alt={t('知识产权 {n}', { n: i + 1 })}
                      className="w-24 h-16 object-cover rounded border"
                    />
                  ),
                )}
              </CardContent>
            </Card>
          )}
          {(enterprise as any)?.qualificationPhotos?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('企业荣誉资质')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {((enterprise as any).qualificationPhotos || []).map((u: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={u}
                    alt={t('荣誉资质 {n}', { n: i + 1 })}
                    className="w-24 h-16 object-cover rounded border"
                  />
                ))}
              </CardContent>
            </Card>
          )}
          {enterprise?.description && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{t('企业简介')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{enterprise.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'agreements',
      label: t('合作协议'),
      badge: agreements.length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLinkSelected([])
                setLinkDialog(true)
              }}
              disabled={availableForLink.length === 0}
            >
              <Link2 className="h-4 w-4 mr-1" />
              {t('关联已有协议')}
            </Button>
            <Button size="sm" onClick={() => setNewDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('新增协议')}
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <TableHead>{t('协议名称')}</TableHead>
                  <TableHead>{t('类型')}</TableHead>
                  <TableHead>{t('状态')}</TableHead>
                  <TableHead>{t('起止日期')}</TableHead>
                  <TableHead>{t('操作')}</TableHead>
                </tr>
              </thead>
              <tbody>
                {agreements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('暂无合作协议，可点击右上角关联或新增')}
                    </td>
                  </tr>
                ) : (
                  agreements.map((a) => (
                    <tr key={a.id} className="border-b">
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.type || '-'}</TableCell>
                      <TableCell>{allianceLabel('agreementStatus', a.status)}</TableCell>
                      <TableCell>
                        {a.startDate || '-'} ~ {a.endDate || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => unlinkAgreement(a.id)}
                        >
                          {t('取消关联')}
                        </Button>
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      key: 'projects',
      label: t('合作项目'),
      badge: projects.length,
      content: (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <TableHead>{t('项目名称')}</TableHead>
                <TableHead>{t('阶段')}</TableHead>
                <TableHead>{t('开始日期')}</TableHead>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-muted-foreground">
                    {t('暂无合作项目')}
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{allianceLabel('projectPhase', p.phase)}</TableCell>
                    <TableCell>{p.startDate || '-'}</TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: 'achievements',
      label: t('合作成果'),
      badge: achievements.length,
      content: (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <TableHead>{t('成果名称')}</TableHead>
                <TableHead>{t('类型')}</TableHead>
                <TableHead>{t('状态')}</TableHead>
              </tr>
            </thead>
            <tbody>
              {achievements.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-muted-foreground">
                    {t('暂无合作成果')}
                  </td>
                </tr>
              ) : (
                achievements.map((a) => (
                  <tr key={a.id} className="border-b">
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{allianceLabel('achievementType', a.type)}</TableCell>
                    <TableCell>{allianceLabel('achievementStatus', a.status)}</TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ),
    },
  ]

  return (
    <>
      <AllianceDetailShell
        title={enterprise?.name || ''}
        statusBadge={
          enterprise ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary">
              {allianceLabel('enterpriseStatus', enterprise.status)}
            </span>
          ) : undefined
        }
        backHref="/portal/apps/alliance/enterprises"
        editHref={`/portal/apps/alliance/enterprises/${id}/edit`}
        tabs={tabs}
        defaultTab="info"
        loading={loading}
      />

      {/* 关联已有协议 */}
      <Dialog open={linkDialog} onOpenChange={(o) => !o && setLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('关联已有协议')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {availableForLink.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer"
              >
                <Checkbox
                  checked={linkSelected.includes(a.id)}
                  onCheckedChange={(v) =>
                    setLinkSelected((prev) =>
                      v ? [...prev, a.id] : prev.filter((x) => x !== a.id),
                    )
                  }
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.type || t('未分类')} · {allianceLabel('agreementStatus', a.status)}
                  </p>
                </div>
              </label>
            ))}
            {availableForLink.length === 0 && (
              <p className="text-center py-6 text-sm text-muted-foreground">
                {t('暂无可关联的协议')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>
              {t('取消')}
            </Button>
            <Button onClick={saveLink} disabled={savingA || linkSelected.length === 0}>
              {savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('关联 ({count})', { count: linkSelected.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增协议（自动关联当前企业） */}
      <Dialog open={newDialog} onOpenChange={(o) => !o && setNewDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('新增协议（自动关联当前企业）')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>{t('协议名称 *')}</Label>
              <Input
                value={aForm.name}
                onChange={(e) => setAForm({ ...aForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('协议类型')}</Label>
              <Input
                value={aForm.type}
                onChange={(e) => setAForm({ ...aForm, type: e.target.value })}
                placeholder={t('如：战略合作协议')}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('协议状态')}</Label>
              <Select value={aForm.status} onValueChange={(v) => setAForm({ ...aForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('草稿')}</SelectItem>
                  <SelectItem value="active">{t('生效中')}</SelectItem>
                  <SelectItem value="expired">{t('已失效')}</SelectItem>
                  <SelectItem value="renewed">{t('已续签')}</SelectItem>
                  <SelectItem value="terminated">{t('已终止')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('开始日期')}</Label>
                <Input
                  type="date"
                  value={aForm.startDate}
                  onChange={(e) => setAForm({ ...aForm, startDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('结束日期')}</Label>
                <Input
                  type="date"
                  value={aForm.endDate}
                  onChange={(e) => setAForm({ ...aForm, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)}>
              {t('取消')}
            </Button>
            <Button onClick={createAgreement} disabled={savingA}>
              {savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('创建并关联')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
