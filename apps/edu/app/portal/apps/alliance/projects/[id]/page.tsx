'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/shared/date-input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TableCell, TableHead } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import {
  portalRequest,
  allianceAchievementApi,
  allianceAgreementApi,
  allianceProjectApi,
} from '@/lib/api'
import { syncAgreementProjectLinks } from '@/lib/alliance-links'
import { formatYMD } from '@/lib/format-utils'
import { useToast, EmptyState, TableEmptyRow, FormDialogFooter } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { Plus, Pencil, Trash2, Link2 } from 'lucide-react'
import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  AllianceProject,
  AllianceProjectMilestone,
  AllianceAgreement,
  AllianceAchievement,
} from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

export default function AllianceProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const [project, setProject] = useState<AllianceProject | null>(null)
  const [milestones, setMilestones] = useState<AllianceProjectMilestone[]>([])
  const [allAgreements, setAllAgreements] = useState<AllianceAgreement[]>([])
  const [achievements, setAchievements] = useState<AllianceAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [savingM, setSavingM] = useState(false)
  const [milestoneDialog, setMilestoneDialog] = useState<{
    open: boolean
    edit?: AllianceProjectMilestone
  }>({ open: false })
  const [mForm, setMForm] = useState({
    name: '',
    description: '',
    dueDate: '',
  })
  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkSelected, setLinkSelected] = useState<string[]>([])
  const [achLinkDialog, setAchLinkDialog] = useState(false)
  const [achLinkSelected, setAchLinkSelected] = useState<string[]>([])
  const [savingA, setSavingA] = useState(false)

  const loadData = () => {
    if (!tenantId || !id) return
    Promise.all([
      allianceProjectApi.get(id),
      allianceProjectApi.listMilestones(id),
      allianceAgreementApi.list({ limit: 200 }),
      allianceAchievementApi.list({ limit: 200 }),
    ])
      .then(([p, m, agr, ach]) => {
        setProject(p)
        setMilestones(m.items || [])
        setAllAgreements(agr.items || [])
        setAchievements(ach.items || [])
      })
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [tenantId, id]) // eslint-disable-line

  const saveLinkAgr = async () => {
    setSavingA(true)
    try {
      // 双向同步：项目.agreement_ids ↔ 协议.project_ids
      for (const aid of linkSelected) {
        const agreement = allAgreements.find((a) => a.id === aid)
        if (!agreement) continue
        await syncAgreementProjectLinks(
          aid,
          [...new Set([...(agreement.projectIds ?? []), id])],
        )
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

  const unlinkAgr = async (aid: string) => {
    try {
      const agreement = allAgreements.find((a) => a.id === aid)
      if (agreement) {
        await syncAgreementProjectLinks(
          aid,
          (agreement.projectIds ?? []).filter((x) => x !== id),
        )
      }
      toast({ title: t('已取消关联') })
      loadData()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  /** 关联成果：写入成果.project_ids（单向，成果侧字段） */
  const saveLinkAch = async () => {
    setSavingA(true)
    try {
      for (const achId of achLinkSelected) {
        const achievement = achievements.find((a) => a.id === achId)
        if (!achievement) continue
        await allianceAchievementApi.update(achId, {
          ...achievement,
          projectIds: [...new Set([...(achievement.projectIds ?? []), id])],
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

  const unlinkAch = async (achId: string) => {
    const achievement = achievements.find((a) => a.id === achId)
    if (!achievement) return
    try {
      await allianceAchievementApi.update(achId, {
        ...achievement,
        projectIds: (achievement.projectIds ?? []).filter((x) => x !== id),
      })
      toast({ title: t('已取消关联') })
      loadData()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  const openMForm = (m?: AllianceProjectMilestone) => {
    setMForm(
      m
        ? {
            name: m.name,
            description: m.description || '',
            dueDate: m.dueDate || '',
          }
        : { name: '', description: '', dueDate: '' },
    )
    setMilestoneDialog({ open: true, edit: m })
  }
  const saveMilestone = async () => {
    setSavingM(true)
    try {
      const edit = milestoneDialog.edit
      if (edit) {
        await portalRequest(`/alliance/projects/${id}/milestones/${edit.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...edit, ...mForm }),
        })
        toast({ title: t('里程碑已更新') })
      } else {
        await portalRequest(`/alliance/projects/${id}/milestones`, {
          method: 'POST',
          body: JSON.stringify(mForm),
        })
        toast({ title: t('里程碑已创建') })
      }
      setMilestoneDialog({ open: false })
      loadData()
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSavingM(false)
    }
  }
  const deleteMilestone = async (mid: string) => {
    try {
      await portalRequest(`/alliance/projects/${id}/milestones/${mid}`, { method: 'DELETE' })
      toast({ title: t('已删除') })
      loadData()
    } catch (e: any) {
      toast({ title: t('删除失败'), description: e.message, variant: 'destructive' })
    }
  }
  /** 里程碑完成开关：点击立即保存；切为完成时完成日期自动填当天，切回未完成时清空 */
  const toggleMilestone = async (m: AllianceProjectMilestone) => {
    const next = !m.isCompleted
    const today = formatYMD(new Date())
    setTogglingMilestone(m.id)
    try {
      await portalRequest(`/alliance/projects/${id}/milestones/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isCompleted: next,
          completedDate: next ? today : '',
        }),
      })
      setMilestones((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, isCompleted: next, completedDate: next ? today : '' } : x,
        ),
      )
      toast({ title: next ? t('已标记完成') : t('已标记未完成') })
    } catch (e: any) {
      toast({ title: t('更新失败'), description: e.message, variant: 'destructive' })
    } finally {
      setTogglingMilestone(null)
    }
  }

  // 总体进度：每个里程碑均分 100%，未完成计 0、已完成获得均分（与全站口径一致）
  const milestoneProgress =
    milestones.length > 0
      ? Math.round((milestones.filter((m) => m.isCompleted).length / milestones.length) * 100)
      : 0

  if (!project && !loading) {
    return (
      <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/projects" />
    )
  }

  // 项目协议（双向合并：协议.project_ids 或 项目.agreement_ids 任一关联即展示）
  const linkedAgreements = allAgreements.filter(
    (a) => (a.projectIds ?? []).includes(id) || (project?.agreementIds ?? []).includes(a.id),
  )
  const linkableAgreements = allAgreements.filter(
    (a) => !(a.projectIds ?? []).includes(id) && !(project?.agreementIds ?? []).includes(a.id),
  )
  const linkedAchievements = achievements.filter((a) => (a.projectIds ?? []).includes(id))

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
                <span className="text-muted-foreground">{t('项目类型：')}</span>
                {project?.type || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('项目阶段：')}</span>
                {allianceLabel('projectPhase', project?.phase)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('公开显示：')}</span>
                {project?.isPublic ? t('是') : t('否')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('时间信息')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{t('开始日期：')}</span>
                {project?.startDate || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('结束日期：')}</span>
                {project?.endDate || '-'}
              </p>
              <p>
                <span className="text-muted-foreground">{t('预算：')}</span>
                {project?.budget || '-'}
              </p>
            </CardContent>
          </Card>
          {project?.description && (
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>{t('项目描述')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{project.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'milestones',
      label: t('里程碑'),
      badge: milestones.length,
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{t('总体进度')}</span>
              <span className="text-sm text-muted-foreground">
                {t('{done}/{total} 个里程碑已完成', {
                  done: milestones.filter((m) => m.isCompleted).length,
                  total: milestones.length,
                })}
              </span>
            </div>
            <div className="flex items-center gap-3 w-1/2">
              <Progress value={milestoneProgress} className="h-2 flex-1" />
              <span className="text-sm font-medium w-10 text-right">{milestoneProgress}%</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openMForm()}>
              <Plus className="h-4 w-4 mr-1" />
              {t('新增里程碑')}
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <TableHead>{t('里程碑名称')}</TableHead>
                  <TableHead>{t('描述')}</TableHead>
                  <TableHead>{t('截止日期')}</TableHead>
                  <TableHead>{t('完成日期')}</TableHead>
                  <TableHead>{t('完成状态')}</TableHead>
                  <TableHead>{t('操作')}</TableHead>
                </tr>
              </thead>
              <tbody>
                {milestones.length === 0 ? (
                  <TableEmptyRow colSpan={6} className="py-8">
                    {t('暂无里程碑')}
                  </TableEmptyRow>
                ) : (
                  milestones.map((m) => (
                    <tr key={m.id} className="border-b">
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.description || '-'}
                      </TableCell>
                      <TableCell>{m.dueDate || '-'}</TableCell>
                      <TableCell>{m.completedDate || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={m.isCompleted}
                            disabled={togglingMilestone === m.id}
                            onCheckedChange={() => toggleMilestone(m)}
                          />
                          <span
                            className={
                              m.isCompleted
                                ? 'text-xs font-medium text-green-600'
                                : 'text-xs text-muted-foreground'
                            }
                          >
                            {m.isCompleted ? t('已完成') : t('未完成')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openMForm(m)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => deleteMilestone(m.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
      key: 'agreements',
      label: t('项目协议'),
      badge: linkedAgreements.length,
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
            >
              <Link2 className="h-4 w-4 mr-1" />
              {t('关联已有协议')}
            </Button>
            <Button size="sm" asChild>
              <Link href={`/portal/apps/alliance/agreements/new?projectId=${id}`}>
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
                {linkedAgreements.length === 0 ? (
                  <TableEmptyRow colSpan={5} className="py-8">
                    {t('暂无项目协议')}
                  </TableEmptyRow>
                ) : (
                  linkedAgreements.map((agreement) => (
                    <tr key={agreement.id} className="border-b">
                      <TableCell className="font-medium">{agreement.name}</TableCell>
                      <TableCell>{agreement.type || '-'}</TableCell>
                      <TableCell>{allianceLabel('agreementStatus', agreement.status)}</TableCell>
                      <TableCell>
                        {agreement.startDate || '-'} ~ {agreement.endDate || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => unlinkAgr(agreement.id)}
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
      label: t('关联成果'),
      badge: linkedAchievements.length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAchLinkSelected([])
                setAchLinkDialog(true)
              }}
            >
              <Link2 className="h-4 w-4 mr-1" />
              {t('关联已有成果')}
            </Button>
            <Button size="sm" asChild>
              <Link href={`/portal/apps/alliance/achievements/new?projectId=${id}`}>
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
                {linkedAchievements.length === 0 ? (
                  <TableEmptyRow colSpan={4} className="py-8">
                    {t('暂无关联成果')}
                  </TableEmptyRow>
                ) : (
                  linkedAchievements.map((a) => (
                    <tr key={a.id} className="border-b">
                      <TableCell className="font-medium">
                        <Link
                          href={`/portal/apps/alliance/achievements/${a.id}`}
                          className="hover:underline"
                        >
                          {a.title}
                        </Link>
                      </TableCell>
                      <TableCell>{allianceLabel('achievementType', a.type)}</TableCell>
                      <TableCell>{allianceLabel('achievementStatus', a.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/portal/apps/alliance/achievements/${a.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Pencil className="h-3 w-3 mr-1" />
                              {t('编辑')}
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => unlinkAch(a.id)}
                          >
                            {t('取消关联')}
                          </Button>
                        </div>
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
  ]

  return (
    <>
      <AllianceDetailShell
        title={project?.name || ''}
        statusBadge={
          project ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary">
              {allianceLabel('projectPhase', project.phase)}
            </span>
          ) : undefined
        }
        backHref="/portal/apps/alliance/projects"
        editHref={`/portal/apps/alliance/projects/${id}/edit`}
        tabs={tabs}
        defaultTab="info"
        loading={loading}
      />

      <Dialog
        open={milestoneDialog.open}
        onOpenChange={(o) => !o && setMilestoneDialog({ open: false })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('{action}里程碑', { action: milestoneDialog.edit ? t('编辑') : t('新增') })}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveMilestone()
            }}
            className="grid gap-4"
          >
            <div className="space-y-4">
            <FormFieldRow label={t('名称')} required>
              <Input
                value={mForm.name}
                onChange={(e) => setMForm({ ...mForm, name: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('描述')}>
              <Textarea
                value={mForm.description}
                onChange={(e) => setMForm({ ...mForm, description: e.target.value })}
                rows={2}
              />
            </FormFieldRow>
            <FormFieldRow label={t('截止日期')}>
              <DateInput
                type="date"
                value={mForm.dueDate}
                onChange={(e) => setMForm({ ...mForm, dueDate: e.target.value })}
              />
            </FormFieldRow>
          </div>
          <FormDialogFooter
            onCancel={() => setMilestoneDialog({ open: false })}
            loading={savingM}
          />
          </form>
        </DialogContent>
      </Dialog>
      {/* 关联已有协议 */}
      <Dialog open={linkDialog} onOpenChange={(o) => !o && setLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('关联已有协议')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveLinkAgr()
            }}
            className="grid gap-4"
          >
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {linkableAgreements.map((a) => (
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
            {linkableAgreements.length === 0 && (
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
      {/* 关联已有成果 */}
      <Dialog open={achLinkDialog} onOpenChange={(o) => !o && setAchLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('关联已有成果')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveLinkAch()
            }}
            className="grid gap-4"
          >
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {achievements
              .filter((a) => !(a.projectIds ?? []).includes(id))
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
            {achievements.filter((a) => !(a.projectIds ?? []).includes(id)).length === 0 && (
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
