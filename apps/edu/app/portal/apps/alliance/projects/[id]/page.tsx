'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/shared/date-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  portalRequest,
  allianceAchievementApi,
  allianceAgreementApi,
  allianceProjectApi,
} from '@/lib/api'
import { syncAgreementProjectLinks } from '@/lib/alliance-links'
import { useToast } from '@zhiyu/ui'
import { allianceLabel } from '@zhiyu/shared-types'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { StatusBadge } from '@/components/shared/status-badge'
import { Plus, Pencil, Trash2, Loader2, Link2 } from 'lucide-react'
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
    completedDate: '',
    isCompleted: false,
  })
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkSelected, setLinkSelected] = useState<string[]>([])
  const [achLinkDialog, setAchLinkDialog] = useState(false)
  const [achLinkSelected, setAchLinkSelected] = useState<string[]>([])
  const [newAgrDialog, setNewAgrDialog] = useState(false)
  const [aForm, setAForm] = useState({
    name: '',
    type: '',
    startDate: '',
    endDate: '',
    status: 'draft',
    content: '',
  })
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

  const createProjectAgreement = async () => {
    if (!aForm.name) {
      toast({ title: t('请填写协议名称'), variant: 'destructive' })
      return
    }
    setSavingA(true)
    try {
      const data = await allianceAgreementApi.create(aForm)
      await syncAgreementProjectLinks(data.id, [id])
      toast({ title: t('协议已创建并关联项目') })
      setNewAgrDialog(false)
      setAForm({ name: '', type: '', startDate: '', endDate: '', status: 'draft', content: '' })
      loadData()
    } catch (e: any) {
      toast({ title: t('创建失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSavingA(false)
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
            completedDate: m.completedDate || '',
            isCompleted: m.isCompleted || false,
          }
        : { name: '', description: '', dueDate: '', completedDate: '', isCompleted: false },
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

  if (!project && !loading) {
    return (
      <AllianceDetailShell title="" tabs={[]} notFound backHref="/portal/apps/alliance/projects" />
    )
  }

  // 项目协议（双向合并：协议.project_ids 或 项目.agreement_ids 任一关联即展示）
  const linkedAgreements = allAgreements.filter(
    (a) => (a.projectIds ?? []).includes(id) || (project?.agreementIds ?? []).includes(a.id),
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
                  <TableHead>{t('状态')}</TableHead>
                  <TableHead>{t('操作')}</TableHead>
                </tr>
              </thead>
              <tbody>
                {milestones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('暂无里程碑')}
                    </td>
                  </tr>
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
                        <StatusBadge status={m.isCompleted ? 'completed' : 'pending'} />
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
            <Button size="sm" onClick={() => setNewAgrDialog(true)}>
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
                {linkedAgreements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t('暂无项目协议')}
                    </td>
                  </tr>
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
          <div className="flex justify-end">
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
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t('暂无关联成果')}
                    </td>
                  </tr>
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
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>{t('名称 *')}</Label>
              <Input
                value={mForm.name}
                onChange={(e) => setMForm({ ...mForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('描述')}</Label>
              <Textarea
                value={mForm.description}
                onChange={(e) => setMForm({ ...mForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('截止日期')}</Label>
                <DateInput
                  type="date"
                  value={mForm.dueDate}
                  onChange={(e) => setMForm({ ...mForm, dueDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('完成日期')}</Label>
                <DateInput
                  type="date"
                  value={mForm.completedDate}
                  onChange={(e) => setMForm({ ...mForm, completedDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneDialog({ open: false })}>
              {t('取消')}
            </Button>
            <Button onClick={saveMilestone} disabled={savingM}>
              {savingM ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 关联已有协议 */}
      <Dialog open={linkDialog} onOpenChange={(o) => !o && setLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('关联已有协议')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {allAgreements.map((a) => (
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
            {allAgreements.length === 0 && (
              <p className="text-center py-6 text-sm text-muted-foreground">
                {t('暂无可关联的协议')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>
              {t('取消')}
            </Button>
            <Button onClick={saveLinkAgr} disabled={savingA || linkSelected.length === 0}>
              {savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('关联 ({count})', { count: linkSelected.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增协议（自动关联当前项目） */}
      <Dialog open={newAgrDialog} onOpenChange={(o) => !o && setNewAgrDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('新增协议（自动关联当前项目）')}</DialogTitle>
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
                <DateInput
                  type="date"
                  value={aForm.startDate}
                  onChange={(e) => setAForm({ ...aForm, startDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('结束日期')}</Label>
                <DateInput
                  type="date"
                  value={aForm.endDate}
                  onChange={(e) => setAForm({ ...aForm, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAgrDialog(false)}>
              {t('取消')}
            </Button>
            <Button onClick={createProjectAgreement} disabled={savingA}>
              {savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('创建并关联')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 关联已有成果 */}
      <Dialog open={achLinkDialog} onOpenChange={(o) => !o && setAchLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('关联已有成果')}</DialogTitle>
          </DialogHeader>
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
              <p className="text-center py-6 text-sm text-muted-foreground">
                {t('暂无可关联的成果')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAchLinkDialog(false)}>
              {t('取消')}
            </Button>
            <Button
              onClick={saveLinkAch}
              disabled={savingA || achLinkSelected.length === 0}
            >
              {savingA ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('关联 ({count})', { count: achLinkSelected.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
