'use client'

import { useState } from 'react'
import { Link } from 'react-router'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Send, Archive } from 'lucide-react'
import { useAsync, useToast, FormDialogFooter, ComboboxSelect } from '@zhiyu/ui'
import { partnerEmploymentApi } from '@/lib/api'
import {
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  type EmploymentJob,
} from '@/lib/types'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDateTime } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerEmploymentJobsPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const { toast } = useToast()
  const t = useT()

  const [statusFilter, setStatusFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  // 发布弹窗：选择绑定项目（可空 = 不绑定）
  const [publishTarget, setPublishTarget] = useState<EmploymentJob | null>(null)
  const [publishProjectId, setPublishProjectId] = useState('')
  const [publishing, setPublishing] = useState(false)

  // 关闭确认
  const [closeTarget, setCloseTarget] = useState<EmploymentJob | null>(null)
  const [closing, setClosing] = useState(false)

  const { data: projectsData } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerEmploymentApi.listProjects()
      return res.items || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )
  const projects = projectsData ?? []

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerEmploymentApi.listJobs({
        projectId: projectFilter || undefined,
        status: statusFilter || undefined,
      })
      return res.items || []
    },
    { deps: [authLoading, user?.id, statusFilter, projectFilter], onError: () => true },
  )
  const jobs = data ?? []

  const openPublish = (job: EmploymentJob) => {
    setPublishProjectId(job.projectId ?? '')
    setPublishTarget(job)
  }

  const handlePublish = async () => {
    if (!publishTarget) return
    setPublishing(true)
    try {
      await partnerEmploymentApi.setJobStatus(publishTarget.id, 'publish', publishProjectId || undefined)
      toast({ title: t('已发布') })
      setPublishTarget(null)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('发布失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
      setPublishing(false)
      return
    }
    setPublishing(false)
    try {
      await refresh()
    } catch {
      /* 列表刷新失败不误报 */
    }
  }

  const handleClose = async () => {
    if (!closeTarget) return
    setClosing(true)
    try {
      await partnerEmploymentApi.setJobStatus(closeTarget.id, 'close')
      toast({ title: t('已关闭') })
      setCloseTarget(null)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('关闭失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
      setClosing(false)
      return
    }
    setClosing(false)
    try {
      await refresh()
    } catch {
      /* 列表刷新失败不误报 */
    }
  }

  return (
    <>
      <PortalCrudPage
        title={t('就业岗位')}
        description={t('录入本企业岗位，可挂靠就业项目或作为独立岗位；仅绑定项目并发布后才会出现在学校供需大厅。')}
        entityLabel={t('岗位')}
        createButtonLabel={t('新建岗位')}
        createHref="/partner/employment-jobs/new"
        items={jobs}
        loading={loading || authLoading}
        error={error?.message ?? null}
        onRetry={refresh}
        searchPlaceholder={t('搜索岗位名称...')}
        filterItems={(items, term) => {
          const q = term.trim().toLowerCase()
          if (!q) return items
          return items.filter((j) => j.title.toLowerCase().includes(q))
        }}
        searchRight={
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t('全部状态')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('全部状态')}</SelectItem>
                {Object.entries(EMPLOYMENT_JOB_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ComboboxSelect
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              value={projectFilter}
              onChange={setProjectFilter}
              placeholder={t('全部项目')}
              searchPlaceholder={t('搜索项目')}
              className="w-full sm:w-56"
            />
          </div>
        }
        colSpan={7}
        renderTableHeader={() => (
          <>
            <TableHead>{t('岗位名称')}</TableHead>
            <TableHead className="w-44">{t('所属项目')}</TableHead>
            <TableHead className="w-24">{t('类型')}</TableHead>
            <TableHead className="w-24">{t('状态')}</TableHead>
            <TableHead className="w-24">{t('投递数')}</TableHead>
            <TableHead className="w-32">{t('创建时间')}</TableHead>
            <TableHead className="w-56">{t('操作')}</TableHead>
          </>
        )}
        renderTableRow={(job, actions) => (
          <>
            <TableCell className="font-medium">
              <Link
                to={`/partner/employment-jobs/${job.id}`}
                className="text-foreground hover:text-indigo-600 hover:underline"
              >
                {job.title}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{job.projectName || t('独立岗位')}</TableCell>
            <TableCell className="text-muted-foreground">
              {EMPLOYMENT_JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
            </TableCell>
            <TableCell>
              <StatusBadge status={job.status} label={EMPLOYMENT_JOB_STATUS_LABELS[job.status]} />
            </TableCell>
            <TableCell>{job.applicationCount}</TableCell>
            <TableCell className="text-muted-foreground">{formatDateTime(job.createdAt)}</TableCell>
            <TableRowActions>
              <Link to={`/partner/employment-jobs/${job.id}/edit`}>
                <Button variant="ghost" size="sm">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t('编辑')}
                </Button>
              </Link>
              {(job.status === 'draft' || job.status === 'closed') && (
                <Button variant="ghost" size="sm" onClick={() => openPublish(job)}>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {t('发布')}
                </Button>
              )}
              {job.status === 'published' && (
                <Button variant="ghost" size="sm" onClick={() => setCloseTarget(job)}>
                  <Archive className="h-3.5 w-3.5 mr-1" />
                  {t('关闭')}
                </Button>
              )}
              {job.status === 'draft' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={actions.delete}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t('删除')}
                </Button>
              )}
            </TableRowActions>
          </>
        )}
        getDeleteDescription={(item) => <>{t('确定要删除岗位 {title} 吗？', { title: item.title })}</>}
        onDelete={async (item) => {
          await partnerEmploymentApi.deleteJob(item.id)
          toast({ title: t('已删除') })
          await refresh()
        }}
      />

      {/* 发布：选择绑定项目 */}
      <Dialog open={!!publishTarget} onOpenChange={(open) => !open && setPublishTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('发布岗位')}</DialogTitle>
            <DialogDescription>{publishTarget?.title ?? ''}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handlePublish()
            }}
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label>{t('绑定就业项目')}</Label>
              <ComboboxSelect
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={publishProjectId}
                onChange={setPublishProjectId}
                placeholder={t('不绑定项目')}
                searchPlaceholder={t('搜索项目')}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {t('仅绑定项目后岗位才会出现在学校供需大厅。')}
              </p>
            </div>
            <FormDialogFooter
              onCancel={() => setPublishTarget(null)}
              confirmText={t('发布')}
              cancelText={t('取消')}
              loading={publishing}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* 关闭确认 */}
      <ConfirmDialog
        open={!!closeTarget}
        onOpenChange={(open) => !open && setCloseTarget(null)}
        title={t('确认关闭')}
        description={<>{t('确定要关闭岗位 {title} 吗？关闭后学生大厅将不再展示。', { title: closeTarget?.title ?? '' })}</>}
        pending={closing}
        variant="destructive"
        confirmText={closing ? t('关闭中...') : t('关闭')}
        onConfirm={handleClose}
      />
    </>
  )
}
