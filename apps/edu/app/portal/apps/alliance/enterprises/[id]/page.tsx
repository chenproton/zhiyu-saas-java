'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
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
import { fetchAllPages } from '@zhiyu/api-client'
import { useToast, EmptyState, TableEmptyRow, FormDialogFooter } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { useT } from '@/lib/i18n/locale-provider'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { Link2, Plus } from 'lucide-react'
import Link from 'next/link'
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
  const [allProjects, setAllProjects] = useState<AllianceProject[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [allAchievements, setAllAchievements] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [savingA, setSavingA] = useState(false)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkSelected, setLinkSelected] = useState<string[]>([])
  const [projLinkDialog, setProjLinkDialog] = useState(false)
  const [projLinkSelected, setProjLinkSelected] = useState<string[]>([])
  const [achLinkDialog, setAchLinkDialog] = useState(false)
  const [achLinkSelected, setAchLinkSelected] = useState<string[]>([])

  // 全量候选列表是否已按需补全（关联弹窗候选需要完整集合；初始只取有界首页）
  const fullAgreementsRef = useRef(false)
  const fullProjectsRef = useRef(false)
  const fullAchievementsRef = useRef(false)

  /** 按需补全协议全量列表：仅关联弹窗打开时触发，避免每次加载全租户无界分页扫描 */
  const ensureFullAgreements = async () => {
    if (fullAgreementsRef.current) return
    try {
      const items = await fetchAllPages((page, pageSize) =>
        allianceAgreementApi.list({ limit: pageSize, offset: page * pageSize }),
      )
      fullAgreementsRef.current = true
      setAllAgreements(items)
    } catch {
      // 补全失败保持已有数据，弹窗仍可用
    }
  }

  /** 按需补全项目全量列表（同 ensureFullAgreements） */
  const ensureFullProjects = async () => {
    if (fullProjectsRef.current) return
    try {
      const items = await fetchAllPages((page, pageSize) =>
        allianceProjectApi.list({ limit: pageSize, offset: page * pageSize }),
      )
      fullProjectsRef.current = true
      setAllProjects(items)
    } catch {
      // 补全失败保持已有数据，弹窗仍可用
    }
  }

  /** 按需补全成果全量列表（同 ensureFullAgreements） */
  const ensureFullAchievements = async () => {
    if (fullAchievementsRef.current) return
    try {
      const items = await fetchAllPages((page, pageSize) =>
        allianceAchievementApi.list({ limit: pageSize, offset: page * pageSize }),
      )
      fullAchievementsRef.current = true
      setAllAchievements(items)
    } catch {
      // 补全失败保持已有数据，弹窗仍可用
    }
  }

  const loadData = () => {
    if (!tenantId || !id) return
    // 初始加载取有界首页（limit 200，与 projects/[id] 页一致）：表格/徽标即时可用；
    // 全量候选由关联弹窗打开时按需补全（ensureFull*），避免每次加载全租户无界分页扫描
    fullAgreementsRef.current = false
    fullProjectsRef.current = false
    fullAchievementsRef.current = false
    Promise.all([
      allianceEnterpriseApi.get(id),
      allianceAgreementApi.list({ limit: 200 }),
      allianceProjectApi.list({ limit: 200 }),
      allianceAchievementApi.list({ limit: 200 }),
    ])
      .then(([ent, agr, proj, ach]) => {
        setEnterprise(ent)
        setAllAgreements(agr.items || [])
        setAllProjects(proj.items || [])
        setAllAchievements(ach.items || [])
        // 本企业直接关联的项目（企业项目集，供协议/成果二次关联过滤）
        const enterpriseProjects = (proj.items || []).filter((p: AllianceProject) =>
          (p.enterpriseIds as any)?.includes?.(id),
        )
        const projectIds = enterpriseProjects.map((p) => p.id)
        setProjects(enterpriseProjects)
        // 协议/成果：直接关联 + 经项目二次关联（去重）
        setAgreements(
          (agr.items || []).filter(
            (a) =>
              (a.enterpriseIds || []).includes?.(id) ||
              (a.projectIds || []).some((pid) => projectIds.includes(pid)),
          ),
        )
        setAchievements(
          (ach.items || []).filter(
            (a: AllianceAchievement) =>
              (a.enterpriseIds as any)?.includes?.(id) ||
              (a.projectIds || []).some((pid) => projectIds.includes(pid)),
          ),
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
        const ids = [...new Set([...(agreement.enterpriseIds || []), id])]
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

  /** 关联已有项目：写入项目.enterprise_ids */
  const saveLinkProjects = async () => {
    setSavingA(true)
    try {
      for (const pid of projLinkSelected) {
        const project = allProjects.find((p) => p.id === pid)
        if (!project) continue
        await allianceProjectApi.update(pid, {
          ...project,
          enterpriseIds: [...new Set([...(project.enterpriseIds || []), id])],
        })
      }
      toast({ title: t('已关联 {count} 个项目', { count: projLinkSelected.length }) })
      setProjLinkDialog(false)
      setProjLinkSelected([])
      loadData()
    } catch (e: any) {
      toast({ title: t('关联失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSavingA(false)
    }
  }

  const unlinkProject = async (pid: string) => {
    const project = allProjects.find((p) => p.id === pid)
    if (!project) return
    try {
      await allianceProjectApi.update(pid, {
        ...project,
        enterpriseIds: (project.enterpriseIds || []).filter((x) => x !== id),
      })
      toast({ title: t('已取消关联') })
      loadData()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  /** 关联已有成果：写入成果.enterprise_ids */
  const saveLinkAchievements = async () => {
    setSavingA(true)
    try {
      for (const achId of achLinkSelected) {
        const achievement = allAchievements.find((a) => a.id === achId)
        if (!achievement) continue
        await allianceAchievementApi.update(achId, {
          ...achievement,
          enterpriseIds: [...new Set([...(achievement.enterpriseIds || []), id])],
        })
      }
      toast({ title: t('已关联 {count} 项成果', { count: achLinkSelected.length }) })
      setAchLinkDialog(false)
      setAchLinkSelected([])
      loadData()
    } catch (e: any) {
      toast({ title: t('关联失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSavingA(false)
    }
  }

  const unlinkAchievement = async (achId: string) => {
    const achievement = allAchievements.find((a) => a.id === achId)
    if (!achievement) return
    try {
      await allianceAchievementApi.update(achId, {
        ...achievement,
        enterpriseIds: (achievement.enterpriseIds || []).filter((x) => x !== id),
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
                    alt={t('营业执照 {index}', { index: i + 1 })}
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
                      alt={t('知识产权 {index}', { index: i + 1 })}
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
                    alt={t('荣誉资质 {index}', { index: i + 1 })}
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
                void ensureFullAgreements()
              }}
              disabled={availableForLink.length === 0}
            >
              <Link2 className="h-4 w-4 mr-1" />
              {t('关联已有协议')}
            </Button>
            <Button size="sm" asChild>
              <Link href={`/portal/apps/alliance/agreements/new?enterpriseId=${id}`}>
                <Plus className="h-4 w-4 mr-1" />
                {t('新增协议')}
              </Link>
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
                  <TableEmptyRow colSpan={5} className="py-8">
                    {t('暂无合作协议，可点击右上角关联或新增')}
                  </TableEmptyRow>
                ) : (
                  agreements.map((a) => {
                    // 直接关联（enterprise_ids）可取消；经项目二次关联仅展示
                    const direct = (a.enterpriseIds || []).includes(id)
                    return (
                      <tr key={a.id} className="border-b">
                        <TableCell className="font-medium">
                          {a.name}
                          {!direct && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              （{t('经项目关联')}）
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{a.type || '-'}</TableCell>
                        <TableCell>{allianceLabel('agreementStatus', a.status)}</TableCell>
                        <TableCell>
                          {a.startDate || '-'} ~ {a.endDate || '-'}
                        </TableCell>
                        <TableCell>
                          {direct && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => unlinkAgreement(a.id)}
                            >
                              {t('取消关联')}
                            </Button>
                          )}
                        </TableCell>
                      </tr>
                    )
                  })
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setProjLinkSelected([])
                setProjLinkDialog(true)
                void ensureFullProjects()
              }}
              disabled={allProjects.filter((p) => !(p.enterpriseIds || []).includes?.(id)).length === 0}
            >
              <Link2 className="h-4 w-4 mr-1" />
              {t('关联已有项目')}
            </Button>
            <Button size="sm" asChild>
              <Link href={`/portal/apps/alliance/projects/new?enterpriseId=${id}`}>
                <Plus className="h-4 w-4 mr-1" />
                {t('新增项目')}
              </Link>
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <TableHead>{t('项目名称')}</TableHead>
                  <TableHead>{t('阶段')}</TableHead>
                  <TableHead>{t('开始日期')}</TableHead>
                  <TableHead>{t('操作')}</TableHead>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <TableEmptyRow colSpan={4} className="py-8">
                    {t('暂无合作项目')}
                  </TableEmptyRow>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id} className="border-b">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{allianceLabel('projectPhase', p.phase)}</TableCell>
                      <TableCell>{p.startDate || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => unlinkProject(p.id)}
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
      key: 'achievements',
      label: t('合作成果'),
      badge: achievements.length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAchLinkSelected([])
                setAchLinkDialog(true)
                void ensureFullAchievements()
              }}
              disabled={
                allAchievements.filter((a) => !(a.enterpriseIds || []).includes?.(id)).length === 0
              }
            >
              <Link2 className="h-4 w-4 mr-1" />
              {t('关联已有成果')}
            </Button>
            <Button size="sm" asChild>
              <Link href={`/portal/apps/alliance/achievements/new?enterpriseId=${id}`}>
                <Plus className="h-4 w-4 mr-1" />
                {t('新增成果')}
              </Link>
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <TableHead>{t('成果名称')}</TableHead>
                  <TableHead>{t('类型')}</TableHead>
                  <TableHead>{t('状态')}</TableHead>
                  <TableHead>{t('操作')}</TableHead>
                </tr>
              </thead>
              <tbody>
                {achievements.length === 0 ? (
                  <TableEmptyRow colSpan={4} className="py-8">
                    {t('暂无合作成果')}
                  </TableEmptyRow>
                ) : (
                  achievements.map((a) => {
                    const direct = (a.enterpriseIds || []).includes(id)
                    return (
                      <tr key={a.id} className="border-b">
                        <TableCell className="font-medium">
                          {a.title}
                          {!direct && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              （{t('经项目关联')}）
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{allianceLabel('achievementType', a.type)}</TableCell>
                        <TableCell>{allianceLabel('achievementStatus', a.status)}</TableCell>
                        <TableCell>
                          {direct && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => unlinkAchievement(a.id)}
                            >
                              {t('取消关联')}
                            </Button>
                          )}
                        </TableCell>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveLink()
            }}
            className="grid gap-4"
          >
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
              <EmptyState title={t('暂无可关联的协议')} className="py-6" />
            )}
          </div>
          <FormDialogFooter
            onCancel={() => setLinkDialog(false)}
            confirmText={t('关联 ({count})', { count: linkSelected.length })}
            loading={savingA}
            confirmDisabled={linkSelected.length === 0}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* 关联已有项目 */}
      <Dialog open={projLinkDialog} onOpenChange={(o) => !o && setProjLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('关联已有项目')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveLinkProjects()
            }}
            className="grid gap-4"
          >
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {allProjects
              .filter((p) => !(p.enterpriseIds || []).includes?.(id))
              .map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={projLinkSelected.includes(p.id)}
                    onCheckedChange={(v) =>
                      setProjLinkSelected((prev) =>
                        v ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                      )
                    }
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {allianceLabel('projectPhase', p.phase)}
                    </p>
                  </div>
                </label>
              ))}
            {allProjects.filter((p) => !(p.enterpriseIds || []).includes?.(id)).length === 0 && (
              <EmptyState title={t('暂无可关联的项目')} className="py-6" />
            )}
          </div>
          <FormDialogFooter
            onCancel={() => setProjLinkDialog(false)}
            confirmText={t('关联 ({count})', { count: projLinkSelected.length })}
            loading={savingA}
            confirmDisabled={projLinkSelected.length === 0}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* 关联已有成果 */}
      <Dialog open={achLinkDialog} onOpenChange={(o) => !o && setAchLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('关联已有成果')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveLinkAchievements()
            }}
            className="grid gap-4"
          >
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {allAchievements
              .filter((a) => !(a.enterpriseIds || []).includes?.(id))
              .map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 p-2 rounded border hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={achLinkSelected.includes(a.id)}
                    onCheckedChange={(v) =>
                      setAchLinkSelected((prev) =>
                        v ? [...prev, a.id] : prev.filter((x) => x !== a.id),
                      )
                    }
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {allianceLabel('achievementType', a.type)} ·{' '}
                      {allianceLabel('achievementStatus', a.status)}
                    </p>
                  </div>
                </label>
              ))}
            {allAchievements.filter((a) => !(a.enterpriseIds || []).includes?.(id)).length ===
              0 && (
              <EmptyState title={t('暂无可关联的成果')} className="py-6" />
            )}
          </div>
          <FormDialogFooter
            onCancel={() => setAchLinkDialog(false)}
            confirmText={t('关联 ({count})', { count: achLinkSelected.length })}
            loading={savingA}
            confirmDisabled={achLinkSelected.length === 0}
          />
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
