'use client'

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAsync, LoadingView, ErrorState, ComboboxSelect, SearchInput } from '@zhiyu/ui'
import { partnerEmploymentApi, partnerSchoolApi } from '@/lib/api'
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  deriveEmploymentProjectPhase,
  allianceLabel,
} from '@/lib/types'
import { formatDate } from '@/lib/format-utils'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

export default function PartnerEmploymentProjectsPage() {
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()
  const navigate = useNavigate()
  const [schoolFilter, setSchoolFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: schoolsData } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerSchoolApi.list({ limit: 200 })
      return (res.items || []).filter((s) => s.status === 'active')
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )
  const schools = schoolsData ?? []

  const { data, loading, error, refresh } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerEmploymentApi.listProjects(schoolFilter || undefined)
      return res.items || []
    },
    { deps: [authLoading, user?.id, schoolFilter], onError: () => true },
  )
  const projects = useMemo(() => data ?? [], [data])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, search])

  if (authLoading || loading) return <LoadingView />
  if (error) return <ErrorState description={error.message} onRetry={refresh} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('就业项目')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('查看合作学校分配给本企业的就业项目；点击项目名称可查看详情并在项目下录入岗位。')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput
          wrapperClassName="w-full sm:max-w-md"
          placeholder={t('搜索项目名称...')}
          value={search}
          onChange={setSearch}
        />
        <ComboboxSelect
          options={schools.map((s) => ({ value: s.tenantId, label: s.schoolName }))}
          value={schoolFilter}
          onChange={setSchoolFilter}
          placeholder={t('全部学校')}
          searchPlaceholder={t('搜索学校')}
          className="w-full sm:w-56"
        />
      </div>

      <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>{t('项目名称')}</TableHead>
              <TableHead className="w-28">{t('类型')}</TableHead>
              <TableHead className="w-24">{t('状态')}</TableHead>
              <TableHead className="w-44">{t('起止日期')}</TableHead>
              <TableHead className="w-40">{t('发起单位')}</TableHead>
              <TableHead className="w-24">{t('发布状态')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const phase = deriveEmploymentProjectPhase(p)
              return (
                <TableRow key={p.id} className="border-border">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => navigate(`/partner/employment-projects/${p.id}`)}
                      className="text-left font-medium text-indigo-600 transition-colors hover:text-indigo-800 hover:underline"
                    >
                      {p.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {EMPLOYMENT_PROJECT_TYPE_LABELS[p.type] ?? p.type}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-gray-200 text-muted-foreground">
                      {EMPLOYMENT_PROJECT_PHASE_LABELS[phase]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.startDate)} ~ {formatDate(p.endDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.organizer || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        p.publishStatus === 'published'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 text-muted-foreground'
                      }
                    >
                      {allianceLabel('publishStatus', p.publishStatus)}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {t('暂无分配给本企业的就业项目。')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
