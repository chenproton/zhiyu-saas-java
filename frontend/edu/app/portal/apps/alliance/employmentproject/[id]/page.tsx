'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/shared/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  allianceEmploymentProjectApi,
  fileApi,
  allianceEmploymentAdminApi,
  allianceEnterpriseApi,
} from '@/lib/api'
import { useToast, useAsync, ComboboxSelect, TableEmptyRow } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { AllianceDetailShell } from '@/components/shared/alliance-detail-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useOrgTree } from '@/hooks/use-org-tree'
import { OrgNodePicker } from '@/components/shared/org-node-picker'
import { MajorSelect } from '@/components/shared/major-select'
import { formatDate, formatDateTime } from '@/lib/format-utils'
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  deriveEmploymentProjectPhase,
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  type EmploymentProject,
  type EmploymentTargetGroup,
  type EmploymentApplication,
} from '@/lib/types'

const PROJECT_TYPES = ['spring', 'autumn', 'directed', 'order']

function employmentTypeLabel(type: string | undefined): string {
  if (!type) return '-'
  if (type.startsWith('custom:')) return type.slice('custom:'.length)
  return EMPLOYMENT_PROJECT_TYPE_LABELS[type] ?? type
}

function targetGroupSummary(g: EmploymentTargetGroup): string {
  const parts: string[] = []
  if (g.orgNodeName || g.orgNodeId) parts.push(g.orgNodeName || g.orgNodeId || '')
  if (g.majorName || g.majorId) parts.push(g.majorName || g.majorId || '')
  if (g.graduateYear) parts.push(String(g.graduateYear))
  return parts.length > 0 ? parts.join(' · ') : '-'
}

function jobStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'published') return 'default'
  if (status === 'closed') return 'outline'
  return 'secondary'
}

/** 项目下岗位列表（详情页 tab）。 */
function ProjectJobsTab({ projectId, tenantId }: { projectId: string; tenantId?: string }) {
  const t = useT()
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEmploymentAdminApi.listJobs({ projectId, limit: 200 })
      return res.items || []
    },
    { deps: [projectId, tenantId], onError: () => true },
  )
  const jobs = data ?? []

  return (
    <div className="rounded-md border">
      <Table className="min-w-[720px]">
        <TableHeader className="bg-muted/50 border-b">
          <TableRow>
            <TableHead>{t('岗位名称')}</TableHead>
            <TableHead>{t('企业')}</TableHead>
            <TableHead>{t('类型')}</TableHead>
            <TableHead>{t('状态')}</TableHead>
            <TableHead>{t('投递数')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : jobs.length === 0 ? (
            <TableEmptyRow colSpan={5} className="py-8">
              {t('暂无岗位')}
            </TableEmptyRow>
          ) : (
            jobs.map((j) => (
              <TableRow key={j.id} className="border-b">
                <TableCell className="font-medium">{j.title}</TableCell>
                <TableCell>{j.enterpriseName || '-'}</TableCell>
                <TableCell>{EMPLOYMENT_JOB_TYPE_LABELS[j.jobType] ?? j.jobType}</TableCell>
                <TableCell>
                  <Badge variant={jobStatusVariant(j.status) as any}>
                    {EMPLOYMENT_JOB_STATUS_LABELS[j.status] ?? j.status}
                  </Badge>
                </TableCell>
                <TableCell>{j.applicationCount}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {error && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {error.message}
          <Button variant="link" size="sm" className="ml-2" onClick={() => refresh()}>
            {t('重试')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** 项目下投递列表（详情页 tab）。 */
function ProjectApplicationsTab({ projectId, tenantId }: { projectId: string; tenantId?: string }) {
  const t = useT()
  const [viewing, setViewing] = useState<EmploymentApplication | null>(null)
  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEmploymentAdminApi.listApplications({ projectId, limit: 200 })
      return res.items || []
    },
    { deps: [projectId, tenantId], onError: () => true },
  )
  const applications = data ?? []

  return (
    <>
      <div className="rounded-md border">
        <Table className="min-w-[820px]">
          <TableHeader className="bg-muted/50 border-b">
            <TableRow>
              <TableHead>{t('学生')}</TableHead>
              <TableHead>{t('学号')}</TableHead>
              <TableHead>{t('专业')}</TableHead>
              <TableHead>{t('班级')}</TableHead>
              <TableHead>{t('岗位')}</TableHead>
              <TableHead>{t('企业')}</TableHead>
              <TableHead>{t('投递时间')}</TableHead>
              <TableHead>{t('操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : applications.length === 0 ? (
              <TableEmptyRow colSpan={8} className="py-8">
                {t('暂无投递')}
              </TableEmptyRow>
            ) : (
              applications.map((a) => (
                <TableRow key={a.id} className="border-b">
                  <TableCell className="font-medium">{a.studentName || '-'}</TableCell>
                  <TableCell>{a.studentNo || '-'}</TableCell>
                  <TableCell>{a.majorName || '-'}</TableCell>
                  <TableCell>{a.className || '-'}</TableCell>
                  <TableCell>{a.jobTitle || '-'}</TableCell>
                  <TableCell>{a.enterpriseName || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(a.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setViewing(a)}>
                      {t('查看')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {error && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {error.message}
            <Button variant="link" size="sm" className="ml-2" onClick={() => refresh()}>
              {t('重试')}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('投递详情')}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="grid gap-2 text-sm max-h-[60vh] overflow-y-auto">
              <Field label={t('学生')} value={viewing.studentName} />
              <Field label={t('学号')} value={viewing.studentNo} />
              <Field label={t('专业')} value={viewing.majorName} />
              <Field label={t('班级')} value={viewing.className} />
              <Field label={t('联系电话')} value={viewing.phone} />
              <Field label={t('邮箱')} value={viewing.email} />
              <Field label={t('岗位')} value={viewing.jobTitle} />
              <Field label={t('企业')} value={viewing.enterpriseName} />
              <Field label={t('项目')} value={viewing.projectName} />
              <Field label={t('投递时间')} value={formatDateTime(viewing.createdAt)} />
              <div className="pt-2">
                <p className="text-muted-foreground">{t('求职信')}</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
                  {viewing.coverLetter || '-'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0">{label}：</span>
      <span className="break-all">{value || '-'}</span>
    </div>
  )
}

export default function EmploymentProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const { orgMap } = useOrgTree(tenantId)

  const [project, setProject] = useState<EmploymentProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'spring',
    customType: '',
    organizer: '',
    enterpriseIds: [] as string[],
    targetGroups: [] as EmploymentTargetGroup[],
    startDate: '',
    endDate: '',
    publishStatus: 'draft' as 'draft' | 'published',
    description: '',
    coverImage: '',
  })

  const { data: enterprises } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEnterpriseApi.list({ limit: 200 })
      return (res.items || [])
        .filter((e) => e.status !== 'terminated')
        .map((e) => ({ label: e.name, value: e.id }))
    },
    { deps: [tenantId], onError: () => true },
  )

  // 初始 loading=true 由 useState 承担，effect 内不做同步 setState（react-hooks 规范）；
  // 重新加载经 finally 异步收尾即可。
  const loadData = () => {
    if (!tenantId || !id) return
    allianceEmploymentProjectApi
      .get(id)
      .then((p) => setProject(p))
      .catch((e) =>
        toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [tenantId, id]) // eslint-disable-line

  const entName = (eid: string) =>
    (enterprises ?? []).find((e) => e.value === eid)?.label || eid

  const startEdit = () => {
    if (!project) return
    const isCustom = (project.type || '').startsWith('custom:')
    setEditForm({
      name: project.name || '',
      type: isCustom ? 'custom' : project.type || 'spring',
      customType: isCustom ? project.type.slice('custom:'.length) : '',
      organizer: project.organizer || '',
      enterpriseIds: project.enterpriseIds || [],
      targetGroups: project.targetGroups || [],
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      publishStatus: project.publishStatus || 'draft',
      description: project.description || '',
      coverImage: project.coverImage || '',
    })
    setEditing(true)
  }

  const setEditField = (field: string, value: any) =>
    setEditForm({ ...editForm, [field]: value })

  const [coverUploading, setCoverUploading] = useState(false)
  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      setEditForm((prev) => ({ ...prev, coverImage: res.url }))
      toast({ title: t('封面上传成功') })
    } catch (e: any) {
      toast({ title: t('上传失败'), description: e.message, variant: 'destructive' })
    } finally {
      setCoverUploading(false)
    }
  }
  const addTargetGroup = () =>
    setEditForm({ ...editForm, targetGroups: [...editForm.targetGroups, {}] })
  const removeTargetGroup = (idx: number) =>
    setEditForm({ ...editForm, targetGroups: editForm.targetGroups.filter((_, i) => i !== idx) })
  const updateTargetGroup = (idx: number, patch: Partial<EmploymentTargetGroup>) =>
    setEditForm({
      ...editForm,
      targetGroups: editForm.targetGroups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    })

  const saveEdit = async () => {
    if (!project) return
    if (!editForm.name.trim()) {
      toast({ title: t('项目名称不能为空'), variant: 'destructive' })
      return
    }
    if (editForm.type === 'custom' && !editForm.customType.trim()) {
      toast({ title: t('请填写自定义项目类型'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: editForm.name.trim(),
        type: editForm.type === 'custom' ? `custom:${editForm.customType.trim()}` : editForm.type,
        organizer: editForm.organizer.trim() || undefined,
        description: editForm.description || undefined,
        coverImage: editForm.coverImage || undefined,
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
        publishStatus: editForm.publishStatus,
        enterpriseIds: editForm.enterpriseIds,
        targetGroups: editForm.targetGroups.filter(
          (g) => g.orgNodeId || g.majorId || g.graduateYear,
        ),
      }
      const updated = await allianceEmploymentProjectApi.update(project.id, payload)
      toast({ title: t('已保存') })
      setProject(updated)
      setEditing(false)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!project && !loading) {
    return (
      <AllianceDetailShell
        title=""
        tabs={[]}
        notFound
        backHref="/portal/apps/alliance/employmentproject"
      />
    )
  }

  const phase = project ? deriveEmploymentProjectPhase(project) : 'ongoing'
  const phaseVariant = phase === 'ongoing' ? 'default' : phase === 'ended' ? 'outline' : 'secondary'

  const tabs = [
    {
      key: 'info',
      label: t('项目信息'),
      content: editing ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('编辑项目')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormFieldGrid>
                <FormFieldRow label={t('项目名称')} required>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditField('name', e.target.value)}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('项目类型')} required>
                  <Select value={editForm.type} onValueChange={(v) => setEditField('type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {EMPLOYMENT_PROJECT_TYPE_LABELS[v]}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">{t('自定义')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormFieldRow>
                {editForm.type === 'custom' && (
                  <FormFieldRow label={t('自定义类型')} required>
                    <Input
                      value={editForm.customType}
                      onChange={(e) => setEditField('customType', e.target.value)}
                    />
                  </FormFieldRow>
                )}
                <FormFieldRow label={t('发起单位')}>
                  <Input
                    value={editForm.organizer}
                    onChange={(e) => setEditField('organizer', e.target.value)}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('开始日期')}>
                  <DateInput
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditField('startDate', e.target.value)}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('结束日期')}>
                  <DateInput
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditField('endDate', e.target.value)}
                  />
                </FormFieldRow>
              </FormFieldGrid>
              <div className="mt-4">
                <CoverImageUpload
                  imageUrl={editForm.coverImage}
                  uploading={coverUploading}
                  label={t('项目封面（展示在服务大厅与联盟首页，建议 16:9 横图）')}
                  alt={t('项目封面')}
                  onUpload={handleCoverUpload}
                  onRemove={() => setEditField('coverImage', '')}
                />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">{t('发布到服务大厅')}</span>
                <Switch
                  checked={editForm.publishStatus === 'published'}
                  onCheckedChange={(v) =>
                    setEditField('publishStatus', v ? 'published' : 'draft')
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('参与企业')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ComboboxSelect
                multiple
                className="w-full"
                options={enterprises ?? []}
                value={editForm.enterpriseIds}
                onChange={(v) => setEditField('enterpriseIds', v)}
                placeholder={t('选择参与企业')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('面向学生群体')}</CardTitle>
              <Button size="sm" variant="outline" onClick={addTargetGroup}>
                <Plus className="h-4 w-4 mr-1" />
                {t('添加条件组')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {editForm.targetGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('未添加条件组，面向全校')}</p>
              )}
              {editForm.targetGroups.map((g, idx) => (
                <div
                  key={idx}
                  className="rounded-md border p-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_auto] gap-3 items-end"
                >
                  <FormFieldRow label={t('组织节点')}>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">
                        <OrgNodePicker
                          tenantId={tenantId}
                          value={g.orgNodeId}
                          onChange={(v) =>
                            updateTargetGroup(idx, {
                              orgNodeId: v,
                              orgNodeName: v ? orgMap.get(v)?.name : undefined,
                            })
                          }
                          placeholder={t('不限制')}
                        />
                      </div>
                      {g.orgNodeId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground shrink-0"
                          onClick={() =>
                            updateTargetGroup(idx, { orgNodeId: undefined, orgNodeName: undefined })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </FormFieldRow>
                  <FormFieldRow label={t('专业')}>
                    <div className="flex items-center gap-1">
                      <MajorSelect
                        tenantId={tenantId}
                        value={g.majorId}
                        onChange={(v, major) =>
                          updateTargetGroup(idx, { majorId: v, majorName: major?.name })
                        }
                        placeholder={t('不限制')}
                        className="w-full"
                      />
                      {g.majorId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground shrink-0"
                          onClick={() =>
                            updateTargetGroup(idx, { majorId: undefined, majorName: undefined })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </FormFieldRow>
                  <FormFieldRow label={t('毕业年份')}>
                    <Input
                      type="number"
                      value={g.graduateYear ?? ''}
                      onChange={(e) =>
                        updateTargetGroup(idx, {
                          graduateYear: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </FormFieldRow>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => removeTargetGroup(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('项目简介')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditField('description', e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t('取消')}
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('保存')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button size="sm" onClick={startEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              {t('编辑')}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('基础信息')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {project?.coverImage && (
                  <img
                    src={project.coverImage}
                    alt={t('项目封面')}
                    className="w-full h-32 object-cover rounded-md mb-2"
                  />
                )}
                <p>
                  <span className="text-muted-foreground">{t('项目类型：')}</span>
                  {employmentTypeLabel(project?.type)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('发起单位：')}</span>
                  {project?.organizer || '-'}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('参与企业：')}</span>
                  {(project?.enterpriseIds || []).map(entName).join('、') || '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('时间与状态')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{t('起止日期：')}</span>
                  {formatDate(project?.startDate)} ~ {formatDate(project?.endDate)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('展示状态：')}</span>
                  <Badge variant={phaseVariant as any} className="ml-1">
                    {EMPLOYMENT_PROJECT_PHASE_LABELS[phase]}
                  </Badge>
                </p>
                <p>
                  <span className="text-muted-foreground">{t('发布状态：')}</span>
                  <Badge
                    variant={project?.publishStatus === 'published' ? 'default' : 'secondary'}
                    className="ml-1"
                  >
                    {project?.publishStatus === 'published' ? t('已发布') : t('草稿')}
                  </Badge>
                </p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t('面向学生群体')}</CardTitle>
              </CardHeader>
              <CardContent>
                {(project?.targetGroups || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('面向全校')}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {(project?.targetGroups || []).map((g, i) => (
                      <li key={i}>
                        {t('条件组 {n}：{cond}', { n: i + 1, cond: targetGroupSummary(g) })}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            {project?.description && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>{t('项目简介')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{project.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'jobs',
      label: t('岗位'),
      badge: project?.jobCount ?? 0,
      content: <ProjectJobsTab projectId={id} tenantId={tenantId} />,
    },
    {
      key: 'applications',
      label: t('投递'),
      badge: project?.applicationCount ?? 0,
      content: <ProjectApplicationsTab projectId={id} tenantId={tenantId} />,
    },
  ]

  return (
    <AllianceDetailShell
      title={project?.name || ''}
      statusBadge={
        project ? (
          <span className="flex items-center gap-2">
            <Badge variant={phaseVariant as any}>
              {EMPLOYMENT_PROJECT_PHASE_LABELS[phase]}
            </Badge>
            <Badge variant={project.publishStatus === 'published' ? 'default' : 'secondary'}>
              {project.publishStatus === 'published' ? t('已发布') : t('草稿')}
            </Badge>
          </span>
        ) : undefined
      }
      backHref="/portal/apps/alliance/employmentproject"
      tabs={tabs}
      defaultTab="info"
      loading={loading}
    />
  )
}
