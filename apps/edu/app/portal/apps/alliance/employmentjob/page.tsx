'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { SearchInput } from '@/components/shared/search-input'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { Loader2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import {
  allianceEmploymentAdminApi,
  allianceEmploymentProjectApi,
  allianceEnterpriseApi,
} from '@/lib/api'
import { useToast, useAsync, UnderlineTabs, TableEmptyRow } from '@zhiyu/ui'
import { formatDateTime } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import {
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  type EmploymentJob,
  type EmploymentApplication,
} from '@/lib/types'

const PAGE_SIZE = 20

function jobStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'published') return 'default'
  if (status === 'closed') return 'outline'
  return 'secondary'
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0">{label}：</span>
      <span className="break-all">{value || '-'}</span>
    </div>
  )
}

function JobsOverviewTab({ tenantId }: { tenantId?: string }) {
  const t = useT()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [projectId, setProjectId] = useState('all')
  const [enterpriseId, setEnterpriseId] = useState('all')
  const [page, setPage] = useState(1)

  const { data: projects } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEmploymentProjectApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [tenantId], onError: () => true },
  )

  const { data: enterprises } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEnterpriseApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [tenantId], onError: () => true },
  )

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (!tenantId) return { items: [], total: 0 }
      const res = await allianceEmploymentAdminApi.listJobs({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        projectId: projectId === 'all' ? undefined : projectId,
        enterpriseId: enterpriseId === 'all' ? undefined : enterpriseId,
      })
      return { items: res.items || [], total: res.total }
    },
    { deps: [tenantId, page, search, status, projectId, enterpriseId], onError: () => true },
  )

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const changeStatus = async (job: EmploymentJob) => {
    if (job.status === 'draft') return
    const next = job.status === 'published' ? 'closed' : 'published'
    try {
      await allianceEmploymentAdminApi.setJobStatus(job.id, next)
      toast({ title: next === 'closed' ? t('已下架') : t('已恢复') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          wrapperClassName="w-full sm:max-w-xs"
          placeholder={t('搜索岗位名称...')}
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('全部状态')}</SelectItem>
            {(['draft', 'published', 'closed'] as const).map((v) => (
              <SelectItem key={v} value={v}>
                {EMPLOYMENT_JOB_STATUS_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={projectId}
          onValueChange={(v) => {
            setProjectId(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('全部项目')}</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={enterpriseId}
          onValueChange={(v) => {
            setEnterpriseId(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('全部企业')}</SelectItem>
            {(enterprises ?? []).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table className="min-w-[860px]">
          <TableHeader className="bg-muted/50 border-b">
            <TableRow>
              <TableHead>{t('岗位')}</TableHead>
              <TableHead>{t('企业')}</TableHead>
              <TableHead>{t('项目')}</TableHead>
              <TableHead>{t('类型')}</TableHead>
              <TableHead>{t('状态')}</TableHead>
              <TableHead>{t('投递数')}</TableHead>
              <TableHead>{t('创建时间')}</TableHead>
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
            ) : items.length === 0 ? (
              <TableEmptyRow colSpan={8} className="py-8">
                {t('暂无岗位')}
              </TableEmptyRow>
            ) : (
              items.map((job) => (
                <TableRow key={job.id} className="border-b">
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>{job.enterpriseName || '-'}</TableCell>
                  <TableCell>{job.projectName || t('独立岗位')}</TableCell>
                  <TableCell>{EMPLOYMENT_JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</TableCell>
                  <TableCell>
                    <Badge variant={jobStatusVariant(job.status) as any}>
                      {EMPLOYMENT_JOB_STATUS_LABELS[job.status] ?? job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{job.applicationCount}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(job.createdAt)}</TableCell>
                  <TableCell>
                    {job.status === 'draft' ? (
                      <span className="text-sm text-muted-foreground">-</span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => changeStatus(job)}>
                        {job.status === 'published' ? t('下架') : t('恢复')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {error && (
          <div className="p-4 text-center text-sm text-muted-foreground">{error.message}</div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('共 {total} 条记录', { total })}</span>
        <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}

function ApplicationsOverviewTab({ tenantId }: { tenantId?: string }) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('all')
  const [enterpriseId, setEnterpriseId] = useState('all')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<EmploymentApplication | null>(null)

  const { data: projects } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEmploymentProjectApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [tenantId], onError: () => true },
  )

  const { data: enterprises } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEnterpriseApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [tenantId], onError: () => true },
  )

  const { data, loading, error } = useAsync(
    async () => {
      if (!tenantId) return { items: [], total: 0 }
      const res = await allianceEmploymentAdminApi.listApplications({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        projectId: projectId === 'all' ? undefined : projectId,
        enterpriseId: enterpriseId === 'all' ? undefined : enterpriseId,
      })
      return { items: res.items || [], total: res.total }
    },
    { deps: [tenantId, page, search, projectId, enterpriseId], onError: () => true },
  )

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            wrapperClassName="w-full sm:max-w-xs"
            placeholder={t('搜索学生姓名...')}
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
          />
          <Select
            value={projectId}
            onValueChange={(v) => {
              setProjectId(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('全部项目')}</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={enterpriseId}
            onValueChange={(v) => {
              setEnterpriseId(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('全部企业')}</SelectItem>
              {(enterprises ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table className="min-w-[960px]">
            <TableHeader className="bg-muted/50 border-b">
              <TableRow>
                <TableHead>{t('学生')}</TableHead>
                <TableHead>{t('学号')}</TableHead>
                <TableHead>{t('专业')}</TableHead>
                <TableHead>{t('班级')}</TableHead>
                <TableHead>{t('岗位')}</TableHead>
                <TableHead>{t('企业')}</TableHead>
                <TableHead>{t('项目')}</TableHead>
                <TableHead>{t('投递时间')}</TableHead>
                <TableHead>{t('操作')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableEmptyRow colSpan={9} className="py-8">
                  {t('暂无投递')}
                </TableEmptyRow>
              ) : (
                items.map((a) => (
                  <TableRow key={a.id} className="border-b">
                    <TableCell className="font-medium">{a.studentName || '-'}</TableCell>
                    <TableCell>{a.studentNo || '-'}</TableCell>
                    <TableCell>{a.majorName || '-'}</TableCell>
                    <TableCell>{a.className || '-'}</TableCell>
                    <TableCell>{a.jobTitle || '-'}</TableCell>
                    <TableCell>{a.enterpriseName || '-'}</TableCell>
                    <TableCell>{a.projectName || '-'}</TableCell>
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
            <div className="p-4 text-center text-sm text-muted-foreground">{error.message}</div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('共 {total} 条记录', { total })}</span>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
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

export default function EmploymentJobOverviewPage() {
  const { tenantId } = usePortalAuth()
  const t = useT()
  const [activeTab, setActiveTab] = useState('jobs')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('岗位与投递')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('管理服务大厅岗位发布状态，查看学生投递记录。')}
        </p>
      </div>

      <UnderlineTabs
        items={[
          { key: 'jobs', label: t('岗位') },
          { key: 'applications', label: t('投递') },
        ]}
        activeKey={activeTab}
        onSelect={setActiveTab}
      />

      {activeTab === 'jobs' ? (
        <JobsOverviewTab tenantId={tenantId} />
      ) : (
        <ApplicationsOverviewTab tenantId={tenantId} />
      )}
    </div>
  )
}
