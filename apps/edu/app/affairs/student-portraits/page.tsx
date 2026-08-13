'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FolderTree, Loader2, ChevronDown, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { usePortalUsers } from '@/hooks/use-portal-users'
import { useOrgTree, findOrgAncestor } from '@/hooks/use-org-tree'
import {
  OrgFilterTree,
  collectOrgSubtreeIds,
} from '@/components/shared/_components/org-filter-tree'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { SearchInput } from '@/components/shared/search-input'
import { ErrorState } from '@/components/shared/error-state'
import { TableEmptyRow, StatusBadge } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import type { Organization } from '@/lib/types/backend'

const DEPT_TYPE = '二级学院'

interface Student {
  id: string
  name: string
  loginAccount: string
  className: string
  department: string
  orgNodeId?: string
  status: '正常' | '禁用' | '毕业'
}

function mapStudentStatus(status: string): Student['status'] {
  if (status === 'active') return '正常'
  if (status === 'disabled') return '禁用'
  if (status === 'graduated') return '毕业'
  return '正常'
}

function toStatusBadgeKey(status: Student['status']): string {
  if (status === '正常') return 'active'
  if (status === '禁用') return 'disabled'
  if (status === '毕业') return 'graduated'
  return status
}

function getOrgTypeName(
  org: Organization | undefined,
  orgTypeMap: Map<string, { name: string }>,
): string | undefined {
  if (!org) return undefined
  return orgTypeMap.get(org.typeId)?.name
}

export default function StudentPortraitsPage() {
  const t = useT()
  const { institution, tenantId } = usePortalAuth()
  const { users, total, page, pageSize, setPage, loading, error, refetch } = usePortalUsers({
    roleCode: 'student',
  })
  const { orgs, orgMap, orgTypeMap, loading: orgLoading } = useOrgTree(tenantId)

  const [students, setStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState<string | null>(null)
  const [orgTreeOpen, setOrgTreeOpen] = useState(false)

  const [previewStudent, setPreviewStudent] = useState<Student | null>(null)

  useEffect(() => {
    ;(async () => {
      setStudents(
        users.map((u) => {
          const classNode = u.orgNodeId ? orgMap.get(u.orgNodeId) : undefined
          const className = classNode?.name || '—'
          let departmentName = institution?.name || '—'
          if (classNode) {
            const deptNode = findOrgAncestor(
              orgMap,
              classNode.id,
              (org) => getOrgTypeName(org, orgTypeMap) === DEPT_TYPE,
            )
            departmentName = deptNode?.name || institution?.name || '—'
          }
          return {
            id: u.id,
            name: u.name,
            loginAccount: u.username || u.loginName || '',
            className,
            department: departmentName,
            orgNodeId: u.orgNodeId,
            status: mapStudentStatus(u.status),
          }
        }),
      )
    })()
  }, [users, institution, orgMap, orgTypeMap])

  const selectedOrgIds = useMemo(() => {
    if (!selectedOrgNodeId) return null
    return collectOrgSubtreeIds(orgMap, selectedOrgNodeId)
  }, [selectedOrgNodeId, orgMap])

  const filteredStudents = useMemo(() => {
    let result = students.filter((s) => {
      if (!searchTerm) return true
      return s.name.includes(searchTerm) || s.loginAccount.includes(searchTerm)
    })
    if (selectedOrgIds) {
      result = result.filter((s) => !!s.orgNodeId && selectedOrgIds.has(s.orgNodeId))
    }
    return result
  }, [students, searchTerm, selectedOrgIds])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      <div className="min-h-full">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('学生画像')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('按组织架构筛选学生，点击「查看画像」查看学生能力画像')}
            </p>
          </div>
        </div>

        {error && <ErrorState description={error} onRetry={refetch} />}

        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* 移动端组织架构开关 */}
          <button
            type="button"
            onClick={() => setOrgTreeOpen((v) => !v)}
            className="md:hidden w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-100 bg-white shadow-sm text-muted-foreground hover:text-foreground"
          >
            <FolderTree className="h-4 w-4 text-primary" />
            {t('组织架构筛选')}
            <ChevronDown
              className={cn('h-4 w-4 ml-auto transition-transform', orgTreeOpen && 'rotate-180')}
            />
          </button>

          <div
            className={cn(
              'w-full md:w-64 md:block shrink-0 rounded-lg border border-gray-100 bg-white shadow-sm p-4',
              orgTreeOpen ? 'block' : 'hidden',
            )}
          >
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <FolderTree className="h-4 w-4 text-primary" />
              {t('组织架构')}
            </h3>
            <ScrollArea className="h-[300px] md:h-[500px]">
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedOrgNodeId(null)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors',
                    selectedOrgNodeId === null
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  {t('全部学生')}
                </button>
                {orgLoading ? (
                  <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t('加载中...')}
                  </div>
                ) : (
                  <OrgFilterTree
                    nodes={orgs}
                    orgTypeMap={orgTypeMap}
                    selectedId={selectedOrgNodeId}
                    onSelect={setSelectedOrgNodeId}
                  />
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex-1 space-y-4 min-w-0">
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-4">
              <SearchInput
                wrapperClassName="w-full sm:max-w-sm"
                placeholder={t('搜索姓名、登录账号...')}
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>

            <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-32">{t('登录账号（学号）')}</TableHead>
                    <TableHead className="w-28">{t('姓名')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('所属院系')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('班级')}</TableHead>
                    <TableHead className="w-24">{t('状态')}</TableHead>
                    <TableHead className="w-28 text-right">{t('操作')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">{t('加载中...')}</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id} className="border-border group">
                          <TableCell className="font-mono text-sm">
                            {student.loginAccount}
                          </TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {student.department}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {student.className}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={toStatusBadgeKey(student.status)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setPreviewStudent(student)}
                            >
                              <UserRound className="mr-1 h-3 w-3" />
                              {t('查看画像')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredStudents.length === 0 && (
                        <TableEmptyRow colSpan={6} className="py-8">
                          {searchTerm
                            ? t('未找到匹配的{entityLabel}', { entityLabel: t('学生') })
                            : t('暂无{entityLabel}数据', { entityLabel: t('学生') })}
                        </TableEmptyRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
              <span>{t('共 {total} 条记录', { total })}</span>
              <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={!!previewStudent}
        onOpenChange={(open) => {
          if (!open) setPreviewStudent(null)
        }}
      >
        <DialogContent size="xl" className="p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle>
              {previewStudent ? `${previewStudent.name}（${previewStudent.loginAccount}）` : ''}
              {t('学生画像')}
            </DialogTitle>
            <DialogDescription>{t('学生能力画像详情')}</DialogDescription>
          </DialogHeader>
          <div className="h-[calc(100dvh-11rem)] min-h-[480px] px-6 pb-6">
            {previewStudent && (
              <iframe
                key={previewStudent.id}
                src={`/student_portrait.html?userId=${encodeURIComponent(previewStudent.id)}`}
                title={t('学生画像')}
                className="w-full h-full border rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
